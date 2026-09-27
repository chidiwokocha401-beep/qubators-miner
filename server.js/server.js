// Qubators Cloud Miner — backend (Node.js + Express + Supabase)
// npm install express @supabase/supabase-js node-fetch cors dotenv express-rate-limit

const express = require('express');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// --- Environment validation ---
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Please fill in your Supabase credentials in server.js/.env');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Rate limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', apiLimiter);

// --- Health check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- Supabase client (service-role, server-side only) ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CACHE_TTL_MS = 60 * 1000;

// --- Logger ---
function log(level, msg, meta) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }));
}

// --- Auth middleware ---
async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Invalid session' });
  req.userId = data.user.id;
  next();
}

// --- Auth endpoints (proxy to Supabase Auth) ---
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'Email, password, and display name are required' });
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { display_name: displayName },
    email_confirm: true,
  });
  if (error) return res.status(400).json({ error: error.message });
  // Create profile
  await supabase.from('profiles').upsert({
    id: data.user.id,
    display_name: displayName,
  });
  res.json({ user: { id: data.user.id, email: data.user.email, displayName } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', data.user.id)
    .single();
  res.json({
    accessToken: data.session.access_token,
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: profile?.display_name || 'Miner',
    },
  });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await supabase.auth.signOut();
  res.json({ ok: true });
});

// --- GET /api/market-data ---
app.get('/api/market-data', async (req, res) => {
  try {
    const { data: rows } = await supabase.from('market_data_cache').select('*');
    const cache = Object.fromEntries((rows || []).map(r => [r.key, r]));
    const now = Date.now();
    const stale = !cache.btc_price || (now - new Date(cache.btc_price.fetched_at).getTime()) > CACHE_TTL_MS;

    if (stale) {
      const [priceRes, diffRes, hashRes] = await Promise.all([
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'),
        fetch('https://mempool.space/api/v1/difficulty-adjustment'),
        fetch('https://mempool.space/api/v1/mining/hashrate/1w'),
      ]);
      const priceJson = await priceRes.json();
      const diffJson = await diffRes.json();
      const hashJson = await hashRes.json();

      const btcPrice = priceJson.bitcoin.usd;
      const difficultyChangePct = diffJson.difficultyChange;
      const networkHashrate = hashJson.hashrate || null;

      const upserts = [
        { key: 'btc_price', value: btcPrice, fetched_at: new Date().toISOString() },
        { key: 'difficulty_change_pct', value: difficultyChangePct, fetched_at: new Date().toISOString() },
      ];
      if (networkHashrate) {
        upserts.push({ key: 'network_hashrate', value: networkHashrate, fetched_at: new Date().toISOString() });
      }
      await supabase.from('market_data_cache').upsert(upserts);
      return res.json({
        btc_price: btcPrice,
        difficulty_change_pct: difficultyChangePct,
        network_hashrate: networkHashrate,
        fetched_at: new Date().toISOString(),
        source: 'live',
      });
    }

    res.json({
      btc_price: cache.btc_price.value,
      difficulty_change_pct: cache.difficulty_change_pct?.value ?? null,
      network_hashrate: cache.network_hashrate?.value ?? null,
      fetched_at: cache.btc_price.fetched_at,
      source: 'cache',
    });
  } catch (err) {
    log('error', 'market-data fetch failed', { error: err.message });
    res.status(502).json({ error: 'Failed to fetch market data' });
  }
});

// --- GET /api/progress ---
app.get('/api/progress', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ progress: data });
});

// --- POST /api/progress ---
app.post('/api/progress', requireAuth, async (req, res) => {
  const { stage_id, completed, quiz_score } = req.body;
  if (!['stage1', 'stage2', 'stage3'].includes(stage_id)) {
    return res.status(400).json({ error: 'Invalid stage_id' });
  }
  const { error } = await supabase.from('progress').upsert({
    user_id: req.userId,
    stage_id,
    completed: !!completed,
    completed_at: completed ? new Date().toISOString() : null,
    quiz_score: quiz_score ?? null,
  });
  if (error) return res.status(500).json({ error: error.message });

  const { data: allProgress } = await supabase
    .from('progress')
    .select('stage_id, completed')
    .eq('user_id', req.userId);
  const allDone = ['stage1', 'stage2', 'stage3'].every(
    s => allProgress?.find(p => p.stage_id === s)?.completed
  );
  if (allDone) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', req.userId)
      .single();
    await supabase.from('leaderboard_cache').upsert({
      user_id: req.userId,
      display_name: profile?.display_name || 'Miner',
      metric: Date.now(),
      updated_at: new Date().toISOString(),
    });
    log('info', 'leaderboard updated', { userId: req.userId });
  }

  res.json({ ok: true });
});

// --- GET /api/farm-config ---
app.get('/api/farm-config', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('farm_config')
    .select('*')
    .eq('user_id', req.userId)
    .single();
  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
  res.json({ rig_ids: data?.rig_ids || [] });
});

// --- POST /api/farm-config ---
app.post('/api/farm-config', requireAuth, async (req, res) => {
  const { rig_ids } = req.body;
  if (!Array.isArray(rig_ids)) return res.status(400).json({ error: 'rig_ids must be an array' });
  const { error } = await supabase.from('farm_config').upsert({
    user_id: req.userId,
    rig_ids,
    updated_at: new Date().toISOString(),
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// --- GET /api/leaderboard ---
app.get('/api/leaderboard', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const { data, error } = await supabase
    .from('leaderboard_cache')
    .select('display_name, metric')
    .order('metric', { ascending: true })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ leaderboard: data });
});

// --- GET /api/certificate ---
app.get('/api/certificate', requireAuth, async (req, res) => {
  const { data: progress } = await supabase
    .from('progress')
    .select('stage_id, completed, completed_at')
    .eq('user_id', req.userId);
  const allDone = ['stage1', 'stage2', 'stage3'].every(
    s => progress?.find(p => p.stage_id === s)?.completed
  );
  if (!allDone) {
    return res.json({ complete: false, message: 'Complete all 3 stages to earn your certificate.' });
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', req.userId)
    .single();
  const certificateId = `QCM-${req.userId.slice(0, 8).toUpperCase()}`;
  res.json({
    complete: true,
    certificate: {
      id: certificateId,
      display_name: profile?.display_name || 'Miner',
      issued_at: new Date().toISOString(),
      url: `/certificate/${certificateId}`,
    },
  });
});

// --- Graceful shutdown ---
process.on('SIGTERM', () => { log('info', 'SIGTERM received'); process.exit(0); });
process.on('SIGINT', () => { log('info', 'SIGINT received'); process.exit(0); });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  log('info', `Qubators API listening on :${PORT}`);
});
