// Qubators Cloud Miner — Shared JS (auth, nav, API helpers)

const API_BASE = '';

// --- Auth state ---
let currentUser = null;
let authToken = localStorage.getItem('qubators_token') || null;

// --- API helper ---
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);
  return data;
}

// --- Auth functions ---
async function signUp(email, password, displayName) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Sign up failed');
  authToken = data.accessToken;
  localStorage.setItem('qubators_token', authToken);
  currentUser = data.user;
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Sign in failed');
  authToken = data.accessToken;
  localStorage.setItem('qubators_token', authToken);
  currentUser = data.user;
  return data;
}

async function signOut() {
  try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
  authToken = null;
  currentUser = null;
  localStorage.removeItem('qubators_token');
  window.location.href = '/login.html';
}

async function checkAuth() {
  if (!authToken) return false;
  try {
    await api('/progress');
    return true;
  } catch (e) {
    authToken = null;
    localStorage.removeItem('qubators_token');
    return false;
  }
}

// --- Navigation ---
function renderNav(activePage) {
  const pages = [
    { href: '/index.html', label: 'Home', key: 'home' },
    { href: '/basics.html', label: 'Basics', key: 'basics' },
    { href: '/economics.html', label: 'Economics', key: 'economics' },
    { href: '/network.html', label: 'Network', key: 'network' },
    { href: '/leaderboard.html', label: 'Leaderboard', key: 'leaderboard' },
    { href: '/certificate.html', label: 'Certificate', key: 'certificate' },
  ];
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.setAttribute('aria-label', 'Learning pages');
  pages.forEach(p => {
    const a = document.createElement('a');
    a.href = p.href;
    a.textContent = p.label;
    if (p.key === activePage) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
    nav.appendChild(a);
  });
  const spacer = document.createElement('span');
  spacer.className = 'spacer';
  nav.appendChild(spacer);
  if (currentUser || authToken) {
    const info = document.createElement('span');
    info.className = 'user-info';
    info.textContent = currentUser?.displayName || 'User';
    nav.appendChild(info);
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.textContent = 'Logout';
    logout.onclick = signOut;
    nav.appendChild(logout);
  } else {
    const login = document.createElement('a');
    login.href = '/login.html';
    login.textContent = 'Login';
    nav.appendChild(login);
  }
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) skipLink.after(nav);
  else document.body.prepend(nav);
}

// --- Market data ---
async function fetchMarketData() {
  const livebar = document.getElementById('livebar');
  const errBox = document.getElementById('marketError');
  const tsDiv = document.getElementById('marketTimestamp');
  if (!livebar) return null;
  errBox.innerHTML = '';
  livebar.innerHTML = '<div class="loading-box"><span class="spinner"></span> Loading live data...</div>';
  try {
    const data = await api('/market-data');
    const netHashEH = data.network_hashrate ? (data.network_hashrate / 1e18).toFixed(0) : '740';
    livebar.innerHTML = `
      <div>BTC price: <b>$${data.btc_price?.toLocaleString() || '—'}</b></div>
      <div>Difficulty change: <b>${data.difficulty_change_pct != null ? (data.difficulty_change_pct > 0 ? '+' : '') + data.difficulty_change_pct.toFixed(1) + '%' : '—'}</b></div>
      <div>Network hash rate: <b>~${netHashEH} EH/s</b></div>
    `;
    if (tsDiv) tsDiv.textContent = `Data as of ${new Date(data.fetched_at).toLocaleTimeString()} (${data.source})`;
    return data;
  } catch (e) {
    livebar.innerHTML = '<div>BTC price: <b>$109,200</b></div><div>Difficulty: <b>~102 T</b></div><div>Hash rate: <b>~740 EH/s</b></div>';
    if (tsDiv) tsDiv.textContent = 'Sample values (live data unavailable)';
    errBox.innerHTML = '<div class="error-box">Could not load live data. Showing sample values.</div>';
    return null;
  }
}

// --- Progress ---
async function loadProgress() {
  try {
    const { progress } = await api('/progress');
    return progress;
  } catch (e) {
    return [];
  }
}

async function saveProgress(stageId, completed, quizScore) {
  const result = await api('/progress', {
    method: 'POST',
    body: JSON.stringify({ stage_id: stageId, completed, quiz_score: quizScore }),
  });
  return result;
}

// --- Auth gate: redirect to login if not authenticated ---
async function requireAuth() {
  if (!authToken) {
    window.location.href = '/login.html';
    return false;
  }
  try {
    await api('/progress');
    return true;
  } catch (e) {
    authToken = null;
    localStorage.removeItem('qubators_token');
    window.location.href = '/login.html';
    return false;
  }
}

// --- Helpers ---
function showBadge(areaId, text) {
  const el = document.getElementById(areaId);
  if (!el || el.dataset.shown) return;
  el.dataset.shown = '1';
  el.innerHTML = `<div class="badge">${text}</div>`;
}

function showError(areaId, message) {
  const el = document.getElementById(areaId);
  if (!el) return;
  const errorBox = document.createElement('div');
  errorBox.className = 'error-box';
  errorBox.textContent = message;
  if (el.getAttribute('role') !== 'alert') errorBox.setAttribute('role', 'alert');
  el.replaceChildren(errorBox);
}
