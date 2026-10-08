// Shared data layer — works from Netlify Functions AND the local Express server.
// Uses Netlify DB (Neon Postgres). No Supabase anywhere.
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

let _db = null;

function db() {
  const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) return null;
  if (!_db) _db = neon(url);
  return _db;
}

function configured() {
  return !!(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);
}

// --- Passwords (scrypt, built-in crypto, no extra deps) ---
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return 'scrypt$' + s + '$' + hash;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const h = crypto.scryptSync(password, parts[1], 64).toString('hex');
  const a = Buffer.from(h);
  const b = Buffer.from(parts[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

// --- Users & sessions ---
async function createUser(email, password, displayName) {
  const sql = db();
  const id = crypto.randomUUID();
  try {
    await sql`INSERT INTO users (id, email, password_hash, display_name)
              VALUES (${id}, ${email.toLowerCase()}, ${hashPassword(password)}, ${displayName})`;
  } catch (e) {
    if (e && (e.code === '23505' || /duplicate|unique/i.test(e.message || ''))) {
      const err = new Error('Email already registered');
      err.code = 'EXISTS';
      throw err;
    }
    throw e;
  }
  return { id, email: email.toLowerCase(), displayName };
}

async function verifyUser(email, password) {
  const sql = db();
  const rows = await sql`SELECT id, email, password_hash, display_name FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
  if (!rows.length) return null;
  if (!verifyPassword(password, rows[0].password_hash)) return null;
  return { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name };
}

async function createSession(userId) {
  const sql = db();
  const token = newToken();
  await sql`INSERT INTO sessions (token, user_id, expires_at)
            VALUES (${token}, ${userId}, NOW() + INTERVAL '30 days')`;
  return token;
}

async function getUserByToken(token) {
  if (!token) return null;
  const sql = db();
  const rows = await sql`SELECT u.id, u.email, u.display_name
                         FROM sessions s JOIN users u ON u.id = s.user_id
                         WHERE s.token = ${token} AND s.expires_at > NOW() LIMIT 1`;
  if (!rows.length) return null;
  return { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name };
}

async function deleteSession(token) {
  const sql = db();
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

// --- Progress ---
async function getProgress(userId) {
  const sql = db();
  return sql`SELECT user_id, stage_id, completed, completed_at, quiz_score FROM progress WHERE user_id = ${userId}`;
}

async function upsertProgress(userId, stageId, completed, quizScore) {
  const sql = db();
  await sql`INSERT INTO progress (user_id, stage_id, completed, completed_at, quiz_score)
            VALUES (${userId}, ${stageId}, ${!!completed}, ${completed ? new Date().toISOString() : null}, ${quizScore == null ? null : quizScore})
            ON CONFLICT (user_id, stage_id) DO UPDATE SET
              completed = EXCLUDED.completed,
              completed_at = EXCLUDED.completed_at,
              quiz_score = EXCLUDED.quiz_score`;
}

async function allStagesComplete(userId) {
  const rows = await getProgress(userId);
  return ['stage1', 'stage2', 'stage3'].every((s) => rows.find((p) => p.stage_id === s && p.completed));
}

// --- Leaderboard ---
async function upsertLeaderboard(userId, displayName) {
  const sql = db();
  await sql`INSERT INTO leaderboard_cache (user_id, display_name, metric, updated_at)
            VALUES (${userId}, ${displayName}, ${Date.now()}, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
              display_name = EXCLUDED.display_name,
              updated_at = EXCLUDED.updated_at`;
}

async function getLeaderboard(limit) {
  const sql = db();
  const n = Math.min(parseInt(limit, 10) || 20, 100);
  return sql`SELECT display_name, metric FROM leaderboard_cache ORDER BY metric ASC LIMIT ${n}`;
}

// --- Farm config ---
async function getFarmConfig(userId) {
  const sql = db();
  const rows = await sql`SELECT rig_ids FROM farm_config WHERE user_id = ${userId} LIMIT 1`;
  return (rows.length && rows[0].rig_ids) || [];
}

async function setFarmConfig(userId, rigIds) {
  const sql = db();
  await sql`INSERT INTO farm_config (user_id, rig_ids, updated_at)
            VALUES (${userId}, ${JSON.stringify(rigIds)}, NOW())
            ON CONFLICT (user_id) DO UPDATE SET rig_ids = EXCLUDED.rig_ids, updated_at = NOW()`;
}

// --- Market data cache ---
async function getMarketCache() {
  const sql = db();
  const rows = await sql`SELECT key, value, fetched_at FROM market_data_cache`;
  const cache = {};
  rows.forEach((r) => { cache[r.key] = { value: Number(r.value), fetchedAt: r.fetched_at }; });
  return cache;
}

async function setMarketCache(entries) {
  const sql = db();
  for (const e of entries) {
    await sql`INSERT INTO market_data_cache (key, value, fetched_at)
              VALUES (${e.key}, ${e.value}, ${new Date().toISOString()})
              ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, fetched_at = EXCLUDED.fetched_at`;
  }
}

// --- Certificates ---
async function issueCertificate(userId, displayName) {
  const sql = db();
  const id = 'QCM-' + String(userId).slice(0, 8).toUpperCase();
  await sql`INSERT INTO certificates (id, user_id, display_name, issued_at)
            VALUES (${id}, ${userId}, ${displayName}, NOW())
            ON CONFLICT (id) DO NOTHING`;
  return id;
}

module.exports = {
  db,
  configured,
  hashPassword,
  verifyPassword,
  newToken,
  createUser,
  verifyUser,
  createSession,
  getUserByToken,
  deleteSession,
  getProgress,
  upsertProgress,
  allStagesComplete,
  upsertLeaderboard,
  getLeaderboard,
  getFarmConfig,
  setFarmConfig,
  getMarketCache,
  setMarketCache,
  issueCertificate,
};
