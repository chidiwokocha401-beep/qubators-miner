// Qubators Cloud Miner — local dev server (Node.js + Express)
// Uses the SAME shared store as the Netlify Function: Netlify DB (Neon Postgres).
// Set DATABASE_URL (or NETLIFY_DATABASE_URL) in server.js/.env — no Supabase anywhere.
// npm install express cors dotenv express-rate-limit node-fetch @neondatabase/serverless

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const store = require('../netlify/functions/lib/store');
require('dotenv').config();

if (!store.configured()) {
  console.warn('Warning: no DATABASE_URL / NETLIFY_DATABASE_URL set.');
  console.warn('The server will start but database features will not work.');
  console.warn('Add DATABASE_URL to server.js/.env to enable all features.\n');
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

// --- Health check (no database needed) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), db: store.configured() });
});

// --- Database guard: every other /api route needs a database ---
app.use('/api/', (req, res, next) => {
  if (req.originalUrl.split('?')[0] === '/api/health') return next();
  if (!store.configured()) {
    return res.status(500).json({ error: 'Server misconfigured: database URL missing (DATABASE_URL)' });
  }
  next();
});

// --- Logger ---
function log(level, msg, meta) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }));
}

// --- Auth middleware ---
async function requireAuth(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const user = await store.getUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

// --- Auth endpoints ---
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }
    if (String(password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }
    try {
      const user = await store.createUser(email, password, displayName);
      const accessToken = await store.createSession(user.id);
      res.json({ accessToken, user });
    } catch (e) {
      if (e && e.code === 'EXISTS') return res.status(409).json({ error: e.message });
      throw e;
    }
  } catch (err) {
    log('error', 'signup failed', { error: err.message });
    res.status(500).json({ error: 'Sign up failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await store.verifyUser(email, password);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const accessToken = await store.createSession(user.id);
    res.json({ accessToken, user });
  } catch (err) {
    log('error', 'login failed', { error: err.message });
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token) await store.deleteSession(token);
  res.json({ ok: true });
});

const CACHE_TTL_MS = 60 * 1000;

// --- GET /api/market-data ---
app.get('/api/market-data', async (req, res) => {
  try {
    const cache = await store.getMarketCache();
    const now = Date.now();
    const stamped = cache.btc_price && cache.btc_price.fetchedAt;
    const stale = !stamped || now - new Date(stamped).getTime() > CACHE_TTL_MS;

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
        { key: 'btc_price', value: btcPrice },
        { key: 'difficulty_change_pct', value: difficultyChangePct },
      ];
      if (networkHashrate) upserts.push({ key: 'network_hashrate', value: networkHashrate });
      await store.setMarketCache(upserts);
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
      difficulty_change_pct: cache.difficulty_change_pct ? cache.difficulty_change_pct.value : null,
      network_hashrate: cache.network_hashrate ? cache.network_hashrate.value : null,
      fetched_at: cache.btc_price.fetchedAt,
      source: 'cache',
    });
  } catch (err) {
    log('error', 'market-data fetch failed', { error: err.message });
    res.status(502).json({ error: 'Failed to fetch market data' });
  }
});

// --- GET /api/progress ---
app.get('/api/progress', requireAuth, async (req, res) => {
  try {
    res.json({ progress: await store.getProgress(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/progress ---
app.post('/api/progress', requireAuth, async (req, res) => {
  const { stage_id, completed, quiz_score } = req.body;
  if (!['stage1', 'stage2', 'stage3'].includes(stage_id)) {
    return res.status(400).json({ error: 'Invalid stage_id' });
  }
  try {
    await store.upsertProgress(req.user.id, stage_id, !!completed, quiz_score == null ? null : quiz_score);
    if (await store.allStagesComplete(req.user.id)) {
      await store.upsertLeaderboard(req.user.id, req.user.displayName || 'Miner');
      log('info', 'leaderboard updated', { userId: req.user.id });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/farm-config ---
app.get('/api/farm-config', requireAuth, async (req, res) => {
  try {
    res.json({ rig_ids: await store.getFarmConfig(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- POST /api/farm-config ---
app.post('/api/farm-config', requireAuth, async (req, res) => {
  const { rig_ids } = req.body;
  if (!Array.isArray(rig_ids)) return res.status(400).json({ error: 'rig_ids must be an array' });
  try {
    await store.setFarmConfig(req.user.id, rig_ids);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/leaderboard ---
app.get('/api/leaderboard', async (req, res) => {
  try {
    res.json({ leaderboard: await store.getLeaderboard(req.query.limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- GET /api/certificate ---
app.get('/api/certificate', requireAuth, async (req, res) => {
  try {
    const progress = await store.getProgress(req.user.id);
    const completedStages = progress.filter((p) => p.completed).map((p) => p.stage_id);
    const allDone = ['stage1', 'stage2', 'stage3'].every((s) => completedStages.includes(s));
    if (!allDone) {
      return res.json({ complete: false, message: 'Complete all 3 stages to earn your certificate.', completedStages });
    }
    const id = await store.issueCertificate(req.user.id, req.user.displayName || 'Miner');
    res.json({
      complete: true,
      certificate: {
        id,
        display_name: req.user.displayName || 'Miner',
        issued_at: new Date().toISOString(),
        url: '/certificate/' + id,
      },
    });
  } catch (err) {
    log('error', 'certificate fetch failed', { error: err.message });
    res.status(500).json({ error: 'Failed to check certificate status.' });
  }
});

// --- Frontend fallback: serve index.html for non-API routes (must be last) ---
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- Graceful shutdown ---
process.on('SIGTERM', () => { log('info', 'SIGTERM received'); process.exit(0); });
process.on('SIGINT', () => { log('info', 'SIGINT received'); process.exit(0); });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  log('info', `Qubators API listening on :${PORT}`);
});
