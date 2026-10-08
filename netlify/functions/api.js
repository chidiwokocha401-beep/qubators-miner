// Netlify Function — Qubators Cloud Miner API
// Backend lives entirely on Netlify: Netlify DB (Neon Postgres) + custom auth.
// No Supabase anywhere.
const fetch = require('node-fetch');
const store = require('./lib/store');

const CACHE_TTL_MS = 60 * 1000;

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
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

function getToken(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || '';
  return String(auth).replace(/^Bearer\s+/i, '');
}

async function requireAuth(event) {
  const user = await store.getUserByToken(getToken(event));
  if (!user) return { error: json(401, { error: 'Invalid session' }) };
  return { user };
}

exports.handler = async (event) => {
  const path = normalizeApiPath(event.path);
  const method = (event.httpMethod || 'GET').toUpperCase();
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  // --- Health check (no database needed) ---
  if (path === '/api/health' && method === 'GET') {
    return json(200, { status: 'ok', uptime: process.uptime(), db: store.configured() });
  }

  if (!store.configured()) {
    return json(500, { error: 'Server misconfigured: database URL missing (NETLIFY_DATABASE_URL)' });
  }

  // Auto-create tables on first use (idempotent).
  try {
    await store.ensureSchema();
  } catch (e) {
    console.log(JSON.stringify({ level: 'error', msg: 'Database setup failed', error: e.message }));
    return json(500, { error: 'Database setup failed: ' + e.message });
  }

  try {
    // --- Auth: sign up (creates account + logs straight in) ---
    if (path === '/api/auth/signup' && method === 'POST') {
      const { email, password, displayName } = body;
      if (!email || !password || !displayName) {
        return json(400, { error: 'Email, password, and display name are required' });
      }
      if (String(password).length < 4) {
        return json(400, { error: 'Password must be at least 4 characters' });
      }
      try {
        const user = await store.createUser(email, password, displayName);
        const accessToken = await store.createSession(user.id);
        return json(200, { accessToken, user });
      } catch (e) {
        if (e && e.code === 'EXISTS') return json(409, { error: e.message });
        throw e;
      }
    }

    // --- Auth: log in ---
    if (path === '/api/auth/login' && method === 'POST') {
      const { email, password } = body;
      if (!email || !password) {
        return json(400, { error: 'Email and password are required' });
      }
      const user = await store.verifyUser(email, password);
      if (!user) return json(401, { error: 'Invalid email or password' });
      const accessToken = await store.createSession(user.id);
      return json(200, { accessToken, user });
    }

    // --- Auth: log out ---
    if (path === '/api/auth/logout' && method === 'POST') {
      const token = getToken(event);
      if (token) await store.deleteSession(token);
      return json(200, { ok: true });
    }

    // --- Progress: read ---
    if (path === '/api/progress' && method === 'GET') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      const progress = await store.getProgress(auth.user.id);
      return json(200, { progress });
    }

    // --- Progress: save one stage ---
    if (path === '/api/progress' && method === 'POST') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      const { stage_id, completed, quiz_score } = body;
      if (!['stage1', 'stage2', 'stage3'].includes(stage_id)) {
        return json(400, { error: 'Invalid stage_id' });
      }
      await store.upsertProgress(auth.user.id, stage_id, !!completed, quiz_score == null ? null : quiz_score);
      if (await store.allStagesComplete(auth.user.id)) {
        await store.upsertLeaderboard(auth.user.id, auth.user.displayName || 'Miner');
      }
      return json(200, { ok: true });
    }

    // --- Farm config ---
    if (path === '/api/farm-config' && method === 'GET') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      return json(200, { rig_ids: await store.getFarmConfig(auth.user.id) });
    }

    if (path === '/api/farm-config' && method === 'POST') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      if (!Array.isArray(body.rig_ids)) return json(400, { error: 'rig_ids must be an array' });
      await store.setFarmConfig(auth.user.id, body.rig_ids);
      return json(200, { ok: true });
    }

    // --- Leaderboard (public) ---
    if (path === '/api/leaderboard' && method === 'GET') {
      const params = event.queryStringParameters || {};
      const leaderboard = await store.getLeaderboard(params.limit);
      return json(200, { leaderboard });
    }

    // --- Certificate ---
    if (path === '/api/certificate' && method === 'GET') {
      const auth = await requireAuth(event);
      if (auth.error) return auth.error;
      const progress = await store.getProgress(auth.user.id);
      const completedStages = progress.filter((p) => p.completed).map((p) => p.stage_id);
      const allDone = ['stage1', 'stage2', 'stage3'].every((s) => completedStages.includes(s));
      if (!allDone) {
        return json(200, { complete: false, message: 'Complete all 3 stages to earn your certificate.', completedStages });
      }
      const id = await store.issueCertificate(auth.user.id, auth.user.displayName || 'Miner');
      return json(200, {
        complete: true,
        certificate: {
          id,
          display_name: auth.user.displayName || 'Miner',
          issued_at: new Date().toISOString(),
          url: '/certificate/' + id,
        },
      });
    }

    // --- Market data (cached proxy to public price/network APIs) ---
    if (path === '/api/market-data' && method === 'GET') {
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
          return json(200, {
            btc_price: btcPrice,
            difficulty_change_pct: difficultyChangePct,
            network_hashrate: networkHashrate,
            fetched_at: new Date().toISOString(),
            source: 'live',
          });
        }

        return json(200, {
          btc_price: cache.btc_price.value,
          difficulty_change_pct: cache.difficulty_change_pct ? cache.difficulty_change_pct.value : null,
          network_hashrate: cache.network_hashrate ? cache.network_hashrate.value : null,
          fetched_at: cache.btc_price.fetchedAt,
          source: 'cache',
        });
      } catch (err) {
        console.log(JSON.stringify({ level: 'error', msg: 'market-data fetch failed', error: err.message }));
        return json(502, { error: 'Failed to fetch market data' });
      }
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', msg: 'API error', error: err.message, path, method }));
    return json(500, { error: 'Internal server error' });
  }
};
