// Netlify Function — Qubators Cloud Miner API
// Handles all API routes as a serverless function

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const CACHE_TTL_MS = 60 * 1000;

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function normalizeApiPath(rawPath) {
  let p = rawPath || '/';
  const prefix = '/.netlify/functions/api';
  if (p.startsWith(prefix)) p = p.slice(prefix.length) || '/';
  if (p !== '/' && !p.startsWith('/api/') && p !== '/api') {
    p = '/api' + (p.startsWith('/') ? p : '/' + p);
  }
  const q = p.indexOf('?');
  if (q !== -1) p = p.slice(0, q);
  return p || '/';
}

// --- Logger ---
function log(level, msg, meta) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta }));
}

// --- Auth middleware ---
async function requireAuth(event) {
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return { error: { statusCode: 401, body: JSON.stringify({ error: 'Missing token' }) } };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { error: { statusCode: 401, body: JSON.stringify({ error: 'Invalid session' }) } };
  return { userId: data.user.id };
}

// --- Main handler ---
exports.handler = async (event, context) => {
  const path = normalizeApiPath(event.path);
  const method = event.httpMethod.toUpperCase();
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  try {
    // --- Health check (no Supabase needed) ---
    if (path === '/api/health' && method === 'GET') {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ok', uptime: process.uptime() }) };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Server misconfigured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' }) };
    }

    // --- Auth endpoints ---
    if (path === '/api/auth/signup' && method === 'POST') {
      const { email, password, displayName } = body;
      if (!email || !password || !displayName) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Email, password, and display name are required' }) };
      }
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        user_metadata: { display_name: displayName },
        email_confirm: true,
      });
      if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
      await supabase.from('profiles').upsert({ id: data.user.id, display_name: displayName });
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        return { statusCode: 200, body: JSON.stringify({ user: { id: data.user.id, email: data.user.email, displayName }, needsLogin: true }) };
      }
      return {
        statusCode: 200,
        body: JSON.stringify({
          accessToken: sessionData.session.access_token,
          user: { id: data.user.id, email: data.user.email, displayName },
        }),
      };
    }

    if (path === '/api/auth/login' && method === 'POST') {
      const { email, password } = body;
      if (!email || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Email and password are required' }) };
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { statusCode: 401, body: JSON.stringify({ error: error.message }) };
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', data.user.id).single();
      return {
        statusCode: 200,
        body: JSON.stringify({
          accessToken: data.session.access_token,
          user: { id: data.user.id, email: data.user.email, displayName: profile?.display_name || 'Miner' },
        }),
      };
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      await supabase.auth.signOut();
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // --- Progress endpoints ---
    if (path === '/api/progress' && method === 'GET') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      const { data, error } = await supabase.from('progress').select('*').eq('user_id', auth.userId);
      if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ progress: data }) };
    }

    if (path === '/api/progress' && method === 'POST') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      const { stage_id, completed, quiz_score } = body;
      if (!['stage1', 'stage2', 'stage3'].includes(stage_id)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid stage_id' }) };
      }
      const { error } = await supabase.from('progress').upsert({
        user_id: auth.userId,
        stage_id,
        completed: !!completed,
        completed_at: completed ? new Date().toISOString() : null,
        quiz_score: quiz_score ?? null,
      });
      if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };

      const { data: allProgress } = await supabase.from('progress').select('stage_id, completed').eq('user_id', auth.userId);
      const allDone = ['stage1', 'stage2', 'stage3'].every(s => allProgress?.find(p => p.stage_id === s)?.completed);
      if (allDone) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', auth.userId).single();
        await supabase.from('leaderboard_cache').upsert({
          user_id: auth.userId,
          display_name: profile?.display_name || 'Miner',
          metric: Date.now(),
          updated_at: new Date().toISOString(),
        });
        log('info', 'leaderboard updated', { userId: auth.userId });
      }
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // --- Farm config endpoints ---
    if (path === '/api/farm-config' && method === 'GET') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      const { data, error } = await supabase.from('farm_config').select('*').eq('user_id', auth.userId).single();
      if (error && error.code !== 'PGRST116') return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ rig_ids: data?.rig_ids || [] }) };
    }

    if (path === '/api/farm-config' && method === 'POST') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      const { rig_ids } = body;
      if (!Array.isArray(rig_ids)) return { statusCode: 400, body: JSON.stringify({ error: 'rig_ids must be an array' }) };
      const { error } = await supabase.from('farm_config').upsert({
        user_id: auth.userId,
        rig_ids,
        updated_at: new Date().toISOString(),
      });
      if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // --- Leaderboard endpoint ---
    if (path === '/api/leaderboard' && method === 'GET') {
      const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 20, 100);
      const { data, error } = await supabase.from('leaderboard_cache').select('display_name, metric').order('metric', { ascending: true }).limit(limit);
      if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      return { statusCode: 200, body: JSON.stringify({ leaderboard: data }) };
    }

    // --- Certificate endpoint ---
    if (path === '/api/certificate' && method === 'GET') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      const { data: progress, error } = await supabase.from('progress').select('stage_id, completed, completed_at').eq('user_id', auth.userId);
      if (error) throw error;
      const completedStages = (progress || []).filter(p => p.completed).map(p => p.stage_id);
      const allDone = ['stage1', 'stage2', 'stage3'].every(s => completedStages.includes(s));
      if (!allDone) {
        return { statusCode: 200, body: JSON.stringify({ complete: false, message: 'Complete all 3 stages to earn your certificate.', completedStages }) };
      }
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', auth.userId).single();
      const certificateId = `QCM-${auth.userId.slice(0, 8).toUpperCase()}`;
      await supabase.from('certificates').upsert({
        id: certificateId,
        user_id: auth.userId,
        display_name: profile?.display_name || 'Miner',
        issued_at: new Date().toISOString(),
      });
      return {
        statusCode: 200,
        body: JSON.stringify({
          complete: true,
          certificate: {
            id: certificateId,
            display_name: profile?.display_name || 'Miner',
            issued_at: new Date().toISOString(),
            url: `/certificate/${certificateId}`,
          },
        }),
      };
    }

    // --- Market data endpoint ---
    if (path === '/api/market-data' && method === 'GET') {
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
          return {
            statusCode: 200,
            body: JSON.stringify({
              btc_price: btcPrice,
              difficulty_change_pct: difficultyChangePct,
              network_hashrate: networkHashrate,
              fetched_at: new Date().toISOString(),
              source: 'live',
            }),
          };
        }

        return {
          statusCode: 200,
          body: JSON.stringify({
            btc_price: cache.btc_price.value,
            difficulty_change_pct: cache.difficulty_change_pct?.value ?? null,
            network_hashrate: cache.network_hashrate?.value ?? null,
            fetched_at: cache.btc_price.fetched_at,
            source: 'cache',
          }),
        };
      } catch (err) {
        log('error', 'market-data fetch failed', { error: err.message });
        return { statusCode: 502, body: JSON.stringify({ error: 'Failed to fetch market data' }) };
      }
    }

    // --- 404 ---
    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    log('error', 'API error', { error: err.message, path, method });
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
