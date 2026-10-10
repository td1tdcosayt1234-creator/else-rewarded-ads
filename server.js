// Else - Server Based Rewarded Ads Backend
// Web + Android WebView (same API). Run: npm install && npm start
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'else-admin-123';
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100kb' }));

// ---------- host scope: api subdomain = billing/API only ----------
// api.elsepay.indevs.in  -> only the billing/gateway API surface below
// elsepay.indevs.in      -> home page + earn app + admin console (unchanged)
const API_HOST = (process.env.API_HOST || 'api.elsepay.indevs.in').toLowerCase();
const APP_HOST = (process.env.PUBLIC_URL || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
function reqHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}
// billing surface (key-auth / gateway), safe to expose publicly
const API_SCOPE = [
  /^\/api\/v1\/.+/,            // merchant gateway (secret key auth)
  /^\/api\/pay\/.+/,           // checkout page + confirm
  /^\/api\/plans$/,
  /^\/api\/payments\/methods$/,
  /^\/api\/subscribe$/,
  /^\/api\/subscription\/my$/,
  /^\/api\/config$/
];
app.use((req, res, next) => {
  const h = reqHost(req);
  const isApi = h === API_HOST || (h.split('.')[0] === 'api' && (!APP_HOST || h.slice(4) === '.' + APP_HOST));
  if (!isApi) return next();
  if (API_SCOPE.some(r => r.test(req.path))) return next();
  return res.status(404).json({
    error: 'not_found',
    message: 'This endpoint is not on the API host. Use the app host for the earn app.',
    api_host: API_HOST
  });
});

// ---------- secure cookie auth ----------
const COOKIE_NAME = 'else_token';
const COOKIE_OPTS = {
  httpOnly: true,        // JS can't read (XSS safe)
  sameSite: 'lax',       // CSRF protection
  secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
  maxAge: 12 * 60 * 60 * 1000, // 12h session
  path: '/',
};
function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', COOKIE_NAME + '=' + encodeURIComponent(token) + '; ' +
    Object.entries(COOKIE_OPTS).map(([k, v]) => typeof v === 'boolean' ? (v ? k : '') : k + '=' + v).filter(Boolean).join('; ') + '; Path=/');
}
function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', COOKIE_NAME + '=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}
function readAuthCookie(req) {
  const h = req.headers.cookie || '';
  const m = h.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE_NAME + '='));
  return m ? decodeURIComponent(m.slice(COOKIE_NAME.length + 1)) : null;
}

// ---------- extreme security ----------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
// request ID for tracing
app.use((req, res, next) => {
  req.id = crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
});
// in-memory rate limiter (per IP + route group)
const rlBuckets = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'na';
    const key = ip + ':' + max + ':' + windowMs;
    const now = Date.now();
    let arr = rlBuckets.get(key) || [];
    arr = arr.filter(t => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'too many requests, slow down' });
    arr.push(now);
    rlBuckets.set(key, arr);
    next();
  };
}
app.use('/api/auth/', rateLimit(10, 60 * 1000)); // login/signup: 10 per min
app.use('/api/', rateLimit(150, 60 * 1000)); // global: 150 per min
// admin brute-force lockout: 5 wrong keys -> 5 min block
const adminFails = new Map();
function adminBlocked(ip) {
  const f = adminFails.get(ip);
  return f && f.count >= 5 && Date.now() - f.last < 5 * 60 * 1000;
}
// user login brute-force lockout: 5 wrong passwords -> 15 min block per account
const userFails = new Map();
function userBlocked(identifier) {
  const f = userFails.get(identifier);
  return f && f.count >= 5 && Date.now() - f.last < 15 * 60 * 1000;
}
function recordUserFail(identifier) {
  const f = userFails.get(identifier) || { count: 0, last: 0 };
  f.count += 1; f.last = Date.now();
  userFails.set(identifier, f);
}
function clearUserFails(identifier) { userFails.delete(identifier); }
// input sanitization (prevent XSS in stored data)
function sanitize(str, max = 200) {
  return String(str || '').replace(/[<>"'`&]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '`': '&#x60;', '&': '&amp;' }[c])).slice(0, max);
}

// ---------- DB ----------
function defaultDB() {
  return {
    users: [],
    transactions: [],
    ad_views: [],
    withdraws: [],
    tickets: [],
    seq: 1,
    config: {
      maintenance: false,
      forceUpdate: false,
      latestVersion: '1.0.0',
      minWithdraw: 10,
      referralCommission: 0.10,
      notice: { en: 'Welcome to Else! Watch ads, earn $.', bn: 'Else e swagotom! Ad dekhun, $ earn korun.' },
      ads: { enabled: true, rewarded: true, interstitial: true, banner: true, cooldownSec: 30, dailyMax: 20 },
      // Per-country LOWEST rate (USD per 1 rewarded ad). Server controls this.
      rewardByCountry: { DEFAULT: 0.002, US: 0.005, UK: 0.004, CA: 0.004, DE: 0.003, SA: 0.003, IN: 0.0015, PK: 0.0012, BD: 0.001 },
      checkinBonus: [0.002, 0.003, 0.004, 0.005, 0.006, 0.008, 0.015],
      spinRewards: [0.001, 0.002, 0.002, 0.003, 0.005, 0.01],
      levels: [{ level: 1, minAds: 0, mult: 1 }, { level: 2, minAds: 50, mult: 1.1 }, { level: 3, minAds: 200, mult: 1.25 }],
      tasks: [
        { id: 't1', title_en: 'Watch 3 rewarded ads', title_bn: '3 ta rewarded ad dekhun', reward: 0.005, needAds: 3 },
        { id: 't2', title_en: 'Invite 1 friend', title_bn: '1 jon friend invite korun', reward: 0.01, needReferrals: 1 },
        { id: 't3', title_en: 'Daily check-in 3 days', title_bn: '3 din check-in korun', reward: 0.008, needStreak: 3 }
      ],
      // Else Pay console (Paddle-like, only Else payment - no external providers)
      billing: {
        mode: 'else-pay', currency: 'USD',
        providers: []
      },
      webhooks: { admobSsvPath: '/api/ads/ssv', postbackUrl: '' },
      authSettings: { requireLogin: true, deviceLock: true, vpnBlock: true, emulatorBlock: true },
      adminKeyOverride: '',
      adminPassword: 'Admin-' + Date.now().toString(36).toUpperCase(),
      // Paddle-like catalog + notifications + developer
      products: [
        { id: 'prod_bd', name: 'Rewarded Ad - BD', type: 'reward', country: 'BD', price: 0.001, active: true },
        { id: 'prod_us', name: 'Rewarded Ad - US', type: 'reward', country: 'US', price: 0.005, active: true },
        { id: 'prod_vip2', name: 'VIP Level 2 boost', type: 'vip', country: 'ALL', price: 0, active: true }
      ],
      notifications: { pushTitle: 'Else', pushBody: 'Watch ads, earn $!', emailSubject: 'Else payout', emailBody: 'Your payout is processed.', notice: null },
      developer: { publicKey: 'else-pub-' + Date.now().toString(36), webhookSecret: '' },
      plans: [
        { id: 'plan_month', name: 'Pro Monthly', price: 5, days: 30, mult: 1.5, dailyMax: 50, active: true },
        { id: 'plan_year', name: 'Pro Yearly', price: 40, days: 365, mult: 2, dailyMax: 100, active: true }
      ]
    }
  };
}
let db;
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
catch { db = defaultDB(); save(); }
if (!db.sessions) { db.sessions = []; save(); }
// migrate old db -> console fields
if (!db.config.billing) { db.config.billing = defaultDB().config.billing; save(); }
if (!db.config.webhooks) { db.config.webhooks = defaultDB().config.webhooks; save(); }
if (!db.config.authSettings) { db.config.authSettings = defaultDB().config.authSettings; save(); }
if (!db.config.adminPassword) { db.config.adminPassword = defaultDB().config.adminPassword; save(); }
if (!db.config.products) { db.config.products = defaultDB().config.products; save(); }
if (!db.config.notifications) { db.config.notifications = defaultDB().config.notifications; save(); }
if (!db.config.developer) { db.config.developer = defaultDB().config.developer; save(); }
if (!db.config.plans) { db.config.plans = defaultDB().config.plans; save(); }
// providers removed: only Else Pay (migrate old seeds out)
if (Array.isArray(db.config.billing.providers) && db.config.billing.providers.length) {
  const seeds = ['binance', 'bkash', 'nagad', 'paypal'];
  const kept = db.config.billing.providers.filter(p => !seeds.includes(p.id));
  if (kept.length !== db.config.billing.providers.length) { db.config.billing.providers = kept; save(); }
}
if (!db.subs) { db.subs = []; save(); }
if (!db.merchants) { db.merchants = []; save(); }
if (!db.charges) { db.charges = []; save(); }
// admin app account: unlimited money (seed once, device ID is the secret credential)
if (!db.users.some(u => u.isAdmin)) {
  const adminUser = {
    id: nid('u'), deviceId: 'ELSE-ADMIN-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
    name: 'Admin', country: 'US', balance: 999999999, totalAds: 0, spinTickets: 99,
    referralCode: 'ELSE-ADMIN', referredBy: null, banned: false, isAdmin: true,
    createdAt: new Date().toISOString(), lastCheckin: null, streak: 0, lastAdAt: 0,
    todayCount: 0, todayDate: todayStr(), completedTasks: [], isEmulator: false, isVpn: false
  };
  db.users.push(adminUser); save();
}
// unlimited: admin debits never reduce balance (real)
function debit(user, amount) {
  if (user.isAdmin) return; // unlimited money
  user.balance = +(user.balance - amount).toFixed(4);
}
if (!db.events) { db.events = []; save(); }
function logEvent(type, msg) { db.events.push({ id: nid('e'), type, msg: String(msg).slice(0, 200), at: new Date().toISOString() }); if (db.events.length > 200) db.events = db.events.slice(-200); save(); }
function adminKey() { return db.config.adminKeyOverride || ADMIN_KEY; }
// server secret for signed tokens (persisted, never exposed)
if (!db.serverSecret) { db.serverSecret = crypto.randomBytes(32).toString('hex'); save(); }
// HMAC-signed auth tokens (old base64-only tokens are rejected)
function signToken(userId) {
  const body = Buffer.from(userId, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', db.serverSecret).update(body).digest('base64url');
  return body + '.' + sig;
}
function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const sig = crypto.createHmac('sha256', db.serverSecret).update(parts[0]).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(parts[1]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return Buffer.from(parts[0], 'base64url').toString('utf8'); } catch { return null; }
}
// admin password hashing (salted sha256, plaintext removed after migration)
function hashAdminPass(pass, salt) {
  return crypto.createHash('sha256').update(salt + '::' + pass).digest('hex');
}
if (db.config.adminPassword && !db.config.adminPassHash) {
  const salt = crypto.randomBytes(8).toString('hex');
  db.config.adminPassHash = { salt, hash: hashAdminPass(String(db.config.adminPassword), salt) };
  delete db.config.adminPassword;
  save();
}
function checkAdminPass(pass) {
  const h = db.config.adminPassHash;
  if (!h) return false;
  const a = Buffer.from(h.hash), b = Buffer.from(hashAdminPass(String(pass || ''), h.salt));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// webhook HMAC signature (timestamp + anti-replay)
function webhookSig(secret, ts, body) {
  return crypto.createHmac('sha256', secret).update(ts + '.' + body).digest('hex');
}
function save() { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function nid(p) { return p + '_' + (db.seq++) + '_' + Date.now().toString(36); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

// ---------- helpers ----------
// active subscription (auto-expire check) - real
function activeSub(userId) {
  let changed = false;
  for (const s of db.subs) {
    if (s.userId === userId && s.status === 'active' && s.expiresAt && new Date(s.expiresAt) < new Date()) {
      s.status = 'expired'; changed = true;
    }
  }
  if (changed) save();
  return db.subs.find(s => s.userId === userId && s.status === 'active' && (!s.expiresAt || new Date(s.expiresAt) >= new Date())) || null;
}
function subMult(userId) { const s = activeSub(userId); return s ? Number(s.mult || 1) : 1; }
function subDailyMax(userId) { const s = activeSub(userId); return s ? Number(s.dailyMax || 50) : db.config.ads.dailyMax; }
function rewardFor(country, user) {
  const map = db.config.rewardByCountry;
  const base = map[country] ?? map.DEFAULT;
  const lv = [...db.config.levels].reverse().find(l => (user.totalAds || 0) >= l.minAds);
  const mult = (lv ? lv.mult : 1) * subMult(user.id);
  return +(base * mult).toFixed(4);
}
function credit(user, amount, reason, type = 'earn') {
  user.balance = +((user.balance || 0) + amount).toFixed(4);
  const tx = { id: nid('tx'), userId: user.id, type, amount, reason, at: new Date().toISOString() };
  db.transactions.push(tx);
  // referral commission to inviter
  if (type === 'earn' && user.referredBy) {
    const ref = db.users.find(u => u.id === user.referredBy);
    if (ref && !ref.banned) {
      const comm = +(amount * db.config.referralCommission).toFixed(4);
      if (comm > 0) {
        ref.balance = +((ref.balance || 0) + comm).toFixed(4);
        db.transactions.push({ id: nid('tx'), userId: ref.id, type: 'earn', amount: comm, reason: 'Referral 10% from ' + user.name, at: new Date().toISOString() });
      }
    }
  }
  return tx;
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  let token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) token = readAuthCookie(req); // secure httpOnly cookie fallback
  if (!token) return res.status(401).json({ error: 'login required' });
  const id = verifyToken(token); // forged tokens rejected
  if (!id) return res.status(401).json({ error: 'bad token, login again' });
  const user = db.users.find(u => u.id === id);
  if (!user) return res.status(401).json({ error: 'user not found' });
  if (user.banned) return res.status(403).json({ error: 'banned' });
  req.user = user;
  next();
}
function adminAuth(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'na';
  if (adminBlocked(ip)) return res.status(429).json({ error: 'admin locked 5 min (too many wrong keys)' });
  if (req.headers['x-admin-key'] !== adminKey()) {
    const f = adminFails.get(ip) || { count: 0, last: 0 };
    f.count += 1; f.last = Date.now();
    adminFails.set(ip, f);
    return res.status(401).json({ error: 'admin key wrong' });
  }
  adminFails.delete(ip);
  next();
}
const pendingSessions = new Map(); // sessionId -> {userId, createdAt, country}
// restore persisted sessions (survive restart)
for (const s of (db.sessions || [])) pendingSessions.set(s.sid, { userId: s.userId, createdAt: s.createdAt, country: s.country });
function addSession(sid, obj) { pendingSessions.set(sid, obj); db.sessions.push({ sid, ...obj }); save(); }
function delSession(sid) { pendingSessions.delete(sid); db.sessions = db.sessions.filter(x => x.sid !== sid); save(); }

// ---------- public config ----------
app.get('/api/config', (req, res) => {
  const c = db.config;
  res.json({
    maintenance: c.maintenance, forceUpdate: c.forceUpdate, latestVersion: c.latestVersion,
    notice: c.notice, ads: c.ads, rewardByCountry: c.rewardByCountry,
    minWithdraw: c.minWithdraw, referralCommission: c.referralCommission,
    checkinBonus: c.checkinBonus, spinRewards: c.spinRewards, levels: c.levels, tasks: c.tasks
  });
});

// ---------- auth: email/username + password, 2-step signup ----------
// per-user password hashing (salted sha256)
function hashUserPass(pass, salt) {
  return crypto.createHash('sha256').update(salt + '::else::' + pass).digest('hex');
}
function checkUserPass(user, pass) {
  if (!user.passHash) return false;
  const a = Buffer.from(user.passHash.hash), b = Buffer.from(hashUserPass(String(pass || ''), user.passHash.salt));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function findByIdentifier(id) {
  const v = String(id || '').trim().toLowerCase();
  if (!v) return null;
  return db.users.find(u => (u.email && u.email === v) || (u.username && u.username === v));
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_RE = /^[a-z0-9_]{3,20}$/;
// admin also gets email/username login (same password)
for (const a of db.users.filter(u => u.isAdmin)) {
  let ch = false;
  if (!a.email) { a.email = 'admin@else.pay'; ch = true; }
  if (!a.username) { a.username = 'admin'; ch = true; }
  if (ch) save();
}
app.post('/api/auth/login', (req, res) => {
  const { identifier, password, deviceId, name, country, referralCode, isEmulator, isVpn } = req.body || {};
  if (db.config.maintenance) return res.status(503).json({ error: 'maintenance' });
  // new style: email or username + password (only way in the app)
  if (identifier) {
    const idKey = String(identifier).trim().toLowerCase();
    if (userBlocked(idKey)) return res.status(429).json({ error: 'account locked 15 min - too many wrong passwords' });
    const user = findByIdentifier(identifier);
    if (!user) return res.status(401).json({ error: 'account not found' });
    if (user.banned) return res.status(403).json({ error: 'banned' });
    const ok = user.isAdmin ? checkAdminPass(password) : checkUserPass(user, password);
    if (!ok) {
      recordUserFail(idKey);
      return res.status(401).json({ error: 'wrong password' });
    }
    clearUserFails(idKey);
    // device lock: bind first device, block others
    if (deviceId) {
      if (!user.deviceId) { user.deviceId = deviceId; }
      else if (user.deviceId !== deviceId && !user.isAdmin) {
        return res.status(403).json({ error: 'this account is already on another device' });
      }
    }
    user.isEmulator = !!isEmulator; user.isVpn = !!isVpn;
    save();
    const token = signToken(user.id);
    setAuthCookie(res, token);
    logEvent('login', user.name + (user.isAdmin ? ' [admin]' : ''));
    return res.json({ token, user: publicUser(user) });
  }
  // legacy: deviceId login (old app versions, users without password)
  if (!deviceId) return res.status(400).json({ error: 'email/username and password required' });
  let user = db.users.find(u => u.deviceId === deviceId);
  if (user && user.isAdmin && !checkAdminPass(password)) {
    return res.status(401).json({ error: 'admin password wrong' });
  }
  if (user && user.passHash && !checkUserPass(user, password)) {
    return res.status(401).json({ error: 'password required - use email login' });
  }
  const code = (country || 'DEFAULT').toUpperCase();
  if (!user) {
    let referredBy = null;
    if (referralCode) {
      const r = db.users.find(u => u.referralCode === referralCode);
      if (r) referredBy = r.id;
    }
    user = {
      id: nid('u'), deviceId, name: (name || 'User').slice(0, 30),
      country: code, balance: 0, totalAds: 0, spinTickets: 1,
      referralCode: 'ELSE-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      referredBy, banned: false, createdAt: new Date().toISOString(),
      lastCheckin: null, streak: 0, lastAdAt: 0, todayCount: 0, todayDate: todayStr(),
      completedTasks: [], isEmulator: !!isEmulator, isVpn: !!isVpn
    };
    db.users.push(user); save();
  } else {
    user.isEmulator = !!isEmulator; user.isVpn = !!isVpn;
    if (country) user.country = code;
    save();
  }
  const token = signToken(user.id);
  logEvent('login', user.name + (user.isAdmin ? ' [admin]' : ''));
  res.json({ token, user: publicUser(user) });
});
// 2-step signup: step1 profile + step2 account (single call, frontend splits UI)
app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, country, city, zip, username, birthday, email, password, referralCode, deviceId } = req.body || {};
  if (db.config.maintenance) return res.status(503).json({ error: 'maintenance' });
  // step 1 validation
  if (!firstName || !String(firstName).trim()) return res.status(400).json({ error: 'first name required', step: 1 });
  if (!lastName || !String(lastName).trim()) return res.status(400).json({ error: 'last name required', step: 1 });
  if (!country || !String(country).trim()) return res.status(400).json({ error: 'country required', step: 1 });
  if (!city || !String(city).trim()) return res.status(400).json({ error: 'city required', step: 1 });
  if (!zip || !String(zip).trim()) return res.status(400).json({ error: 'zip code required', step: 1 });
  // step 2 validation
  const uname = String(username || '').trim().toLowerCase();
  if (!USER_RE.test(uname)) return res.status(400).json({ error: 'username: 3-20 chars a-z 0-9 _', step: 2 });
  if (db.users.some(u => u.username === uname)) return res.status(400).json({ error: 'username taken', step: 2 });
  const mail = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return res.status(400).json({ error: 'valid email required', step: 2 });
  if (db.users.some(u => u.email === mail)) return res.status(400).json({ error: 'email already registered', step: 2 });
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'password min 6 chars', step: 2 });
  const pw = String(password);
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return res.status(400).json({ error: 'password needs upper, lower + number', step: 2 });
  const bd = String(birthday || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bd) || isNaN(new Date(bd).getTime())) return res.status(400).json({ error: 'birthday YYYY-MM-DD required', step: 2 });
  let referredBy = null;
  if (referralCode) {
    const r = db.users.find(u => u.referralCode === String(referralCode).trim());
    if (r) referredBy = r.id;
  }
  const salt = crypto.randomBytes(8).toString('hex');
  const user = {
    id: nid('u'), deviceId: deviceId || null,
    name: sanitize(String(firstName).trim() + ' ' + String(lastName).trim(), 30),
    firstName: sanitize(String(firstName).trim(), 30), lastName: sanitize(String(lastName).trim(), 30),
    country: String(country).trim().toUpperCase().slice(0, 30), city: sanitize(String(city).trim(), 40), zip: sanitize(String(zip).trim(), 12),
    username: uname, birthday: bd, email: mail,
    passHash: { salt, hash: hashUserPass(String(password), salt) },
    balance: 0, totalAds: 0, spinTickets: 1,
    referralCode: 'ELSE-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    referredBy, banned: false, createdAt: new Date().toISOString(),
    lastCheckin: null, streak: 0, lastAdAt: 0, todayCount: 0, todayDate: todayStr(),
    completedTasks: [], isEmulator: false, isVpn: false
  };
  db.users.push(user); save();
  logEvent('signup', user.name + ' @' + uname);
  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ token, user: publicUser(user) });
});
function publicUser(u) {
  const sub = activeSub(u.id);
  return { id: u.id, name: u.name, email: u.email || null, username: u.username || null, country: u.country, city: u.city || null, balance: u.balance, totalAds: u.totalAds, level: levelOf(u), spinTickets: u.spinTickets, referralCode: u.referralCode, streak: u.streak, banned: u.banned, isAdmin: !!u.isAdmin, sub: sub ? { plan: sub.planName, status: sub.status, expiresAt: sub.expiresAt, mult: sub.mult } : null };
}
function levelOf(u) { const l = [...db.config.levels].reverse().find(x => (u.totalAds || 0) >= x.minAds); return l ? l.level : 1; }
app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

// ---------- rewarded ads (B5 + C9 + C10) ----------
// Step 1: start (cooldown + daily limit check) -> sessionId
app.post('/api/ads/rewarded/start', auth, (req, res) => {
  const u = req.user, c = db.config;
  if (!c.ads.enabled || !c.ads.rewarded) return res.status(403).json({ error: 'ads off' });
  if (u.isEmulator) return res.status(403).json({ error: 'emulator blocked (C8)' });
  if (u.isVpn) return res.status(403).json({ error: 'vpn blocked, turn off vpn' });
  if (u.todayDate !== todayStr()) { u.todayDate = todayStr(); u.todayCount = 0; }
  const maxAds = subDailyMax(u.id);
  if (u.todayCount >= maxAds) return res.status(429).json({ error: 'daily limit ' + maxAds });
  const wait = c.ads.cooldownSec - Math.floor((Date.now() - (u.lastAdAt || 0)) / 1000);
  if (wait > 0) return res.status(429).json({ error: 'cooldown', retryAfterSec: wait });
  const sid = nid('ad');
  addSession(sid, { userId: u.id, createdAt: Date.now(), country: u.country });
  res.json({ sessionId: sid, adSeconds: 5, note: 'Show AdMob rewarded now, then call /complete' });
});
// Step 2: complete (SSV verify mock) -> credit lowest-by-country rate
app.post('/api/ads/rewarded/complete', auth, (req, res) => {
  const { sessionId } = req.body || {};
  const s = pendingSessions.get(sessionId);
  if (!s || s.userId !== req.user.id) return res.status(400).json({ error: 'invalid session (SSV fail)' });
  if (Date.now() - s.createdAt > 10 * 60 * 1000) { delSession(sessionId); return res.status(400).json({ error: 'session expired' }); }
  delSession(sessionId); // anti double-spend
  const u = req.user;
  const reward = rewardFor(s.country, u);
  u.lastAdAt = Date.now(); u.todayCount = (u.todayCount || 0) + 1; u.totalAds = (u.totalAds || 0) + 1;
  u.spinTickets = (u.spinTickets || 0) + 1;
  credit(u, reward, `Rewarded ad (${s.country})`);
  db.ad_views.push({ id: nid('v'), userId: u.id, kind: 'rewarded', sessionId, country: s.country, reward, at: new Date().toISOString(), verified: 'ssv-mock' });
  save();
  res.json({ reward, balance: u.balance, level: levelOf(u), todayCount: u.todayCount });
});
// AdMob real SSV callback (GET) - production e Google signature verify add hobe
app.get('/api/ads/ssv', (req, res) => {
  const { user_id, session_id } = req.query;
  const u = db.users.find(x => x.id === user_id);
  const s = pendingSessions.get(session_id);
  if (!u || !s) return res.status(400).send('fail');
  // TODO: verify signature with Google public keys (admob_ssv_crypto)
  delSession(session_id);
  const reward = rewardFor(s.country, u);
  u.lastAdAt = Date.now(); u.todayCount = (u.todayCount || 0) + 1; u.totalAds = (u.totalAds || 0) + 1;
  credit(u, reward, `Rewarded ad SSV (${s.country})`);
  db.ad_views.push({ id: nid('v'), userId: u.id, kind: 'rewarded', sessionId: session_id, country: s.country, reward, at: new Date().toISOString(), verified: 'ssv' });
  save();
  res.send('ok');
});
// interstitial + banner log (owner income, B5)
app.post('/api/ads/interstitial/view', auth, (req, res) => {
  db.ad_views.push({ id: nid('v'), userId: req.user.id, kind: 'interstitial', country: req.user.country, reward: 0, at: new Date().toISOString(), verified: '-' });
  save(); res.json({ ok: true });
});
app.post('/api/ads/banner/impression', auth, (req, res) => {
  db.ad_views.push({ id: nid('v'), userId: req.user.id, kind: 'banner', country: req.user.country, reward: 0, at: new Date().toISOString(), verified: '-' });
  save(); res.json({ ok: true });
});

// ---------- check-in (A1), spin (A), tasks (B6) ----------
app.post('/api/checkin', auth, (req, res) => {
  const u = req.user, t = todayStr();
  if (u.lastCheckin === t) return res.status(400).json({ error: 'already checked in' });
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  u.streak = (u.lastCheckin === y) ? (u.streak || 0) + 1 : 1;
  u.lastCheckin = t;
  const bonus = db.config.checkinBonus[Math.min(u.streak - 1, db.config.checkinBonus.length - 1)];
  credit(u, bonus, `Check-in day ${u.streak}`);
  save(); res.json({ streak: u.streak, bonus, balance: u.balance });
});
app.post('/api/spin', auth, (req, res) => {
  const u = req.user;
  if ((u.spinTickets || 0) < 1) return res.status(400).json({ error: 'no ticket, watch ad first' });
  u.spinTickets -= 1;
  const r = db.config.spinRewards[Math.floor(Math.random() * db.config.spinRewards.length)];
  credit(u, r, 'Spin wheel');
  save(); res.json({ reward: r, balance: u.balance, tickets: u.spinTickets });
});
app.get('/api/tasks', auth, (req, res) => {
  const u = req.user;
  const myRef = db.users.filter(x => x.referredBy === u.id).length;
  res.json(db.config.tasks.map(t => ({
    ...t, done: (u.completedTasks || []).includes(t.id),
    progress: t.needAds ? Math.min(u.totalAds, t.needAds) + '/' + t.needAds : t.needReferrals ? Math.min(myRef, t.needReferrals) + '/' + t.needReferrals : (u.streak || 0) + '/' + (t.needStreak || 1)
  })));
});
app.post('/api/tasks/:id/complete', auth, (req, res) => {
  const u = req.user, t = db.config.tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'no task' });
  if ((u.completedTasks || []).includes(t.id)) return res.status(400).json({ error: 'done' });
  const myRef = db.users.filter(x => x.referredBy === u.id).length;
  const ok = (t.needAds && u.totalAds >= t.needAds) || (t.needReferrals && myRef >= t.needReferrals) || (t.needStreak && (u.streak || 0) >= t.needStreak);
  if (!ok) return res.status(400).json({ error: 'not eligible yet' });
  u.completedTasks.push(t.id);
  credit(u, t.reward, 'Task ' + t.id);
  save(); res.json({ reward: t.reward, balance: u.balance });
});

// ---------- referral, wallet, leaderboard, withdraw, support ----------
app.get('/api/referral/my', auth, (req, res) => {
  const u = req.user;
  const list = db.users.filter(x => x.referredBy === u.id);
  res.json({ code: u.referralCode, count: list.length, commission: db.config.referralCommission });
});
app.get('/api/wallet', auth, (req, res) => {
  res.json({ balance: req.user.balance, history: db.transactions.filter(t => t.userId === req.user.id).slice(-50).reverse() });
});
app.get('/api/leaderboard', auth, (req, res) => {
  res.json([...db.users].filter(u => !u.banned).sort((a, b) => b.balance - a.balance).slice(0, 10).map(u => ({ name: u.name, balance: u.balance, totalAds: u.totalAds })));
});
app.post('/api/withdraw', auth, (req, res) => {
  let { amount, method, account } = req.body || {};
  amount = Number(amount);
  const min = db.config.minWithdraw; // $10
  if (!amount || isNaN(amount) || amount < min) return res.status(400).json({ error: `min $${min}` });
  if (req.user.balance < amount) return res.status(400).json({ error: 'low balance' });
  // Else Pay: method must be enabled + fee calc (real)
  const prov = (db.config.billing.providers || []).find(p => p.name === method || p.id === method);
  if (prov && !prov.enabled) return res.status(400).json({ error: method + ' disabled by admin' });
  const feePct = prov ? Number(prov.feePct || 0) : 0;
  const fee = +(amount * feePct / 100).toFixed(4);
  const net = +(amount - fee).toFixed(4);
  debit(req.user, amount);
  const w = { id: nid('w'), userId: req.user.id, name: req.user.name, amount, fee, net, method: (prov ? prov.name : (method || 'TBD')), account: account || '', status: 'pending', at: new Date().toISOString() };
  db.withdraws.push(w);
  db.transactions.push({ id: nid('tx'), userId: req.user.id, type: 'debit', amount: -amount, reason: `Withdraw ${w.method} (fee $${fee})`, at: w.at });
  save(); res.json(w);
});
// public enabled payment methods (real, for wallet dropdown)
app.get('/api/payments/methods', auth, (req, res) => {
  res.json((db.config.billing.providers || []).filter(p => p.enabled));
});
app.get('/api/withdraw/my', auth, (req, res) => res.json(db.withdraws.filter(w => w.userId === req.user.id).reverse()));
app.post('/api/support', auth, (req, res) => {
  const { msg } = req.body || {};
  if (!msg) return res.status(400).json({ error: 'msg required' });
  const t = { id: nid('s'), userId: req.user.id, name: sanitize(req.user.name, 30), msg: sanitize(msg, 500), reply: '', status: 'open', at: new Date().toISOString() };
  db.tickets.push(t); save(); res.json(t);
});
app.get('/api/support/my', auth, (req, res) => res.json(db.tickets.filter(t => t.userId === req.user.id).reverse()));

// ---------- subscriptions (real: payment approve -> auto active) ----------
app.get('/api/plans', auth, (req, res) => res.json((db.config.plans || []).filter(p => p.active)));
app.post('/api/subscribe', auth, (req, res) => {
  const { planId, method, account } = req.body || {};
  const plan = (db.config.plans || []).find(p => p.id === planId && p.active);
  if (!plan) return res.status(404).json({ error: 'no plan' });
  if (activeSub(req.user.id)) return res.status(400).json({ error: 'already subscribed' });
  if (req.user.balance < plan.price) return res.status(400).json({ error: `need $${plan.price} balance` });
  if (busySub.has(req.user.id)) return res.status(429).json({ error: 'processing, wait' });
  busySub.add(req.user.id);
  try {
    const prov = (db.config.billing.providers || []).find(p => p.name === method || p.id === method);
    if (method && prov && !prov.enabled) return res.status(400).json({ error: method + ' disabled' });
    debit(req.user, plan.price);
    // instant approve: wallet balance already secured -> ACTIVE at once (real)
    const start = new Date();
    const exp = new Date(start.getTime() + Number(plan.days || 30) * 864e5);
    const s = { id: nid('sub'), userId: req.user.id, name: req.user.name, planId: plan.id, planName: plan.name, price: plan.price, mult: plan.mult, dailyMax: plan.dailyMax, days: plan.days, method: (prov ? prov.name : (method || 'wallet')), account: account || '', status: 'active', startedAt: start.toISOString(), expiresAt: exp.toISOString(), at: start.toISOString() };
    db.subs.push(s);
    db.transactions.push({ id: nid('tx'), userId: req.user.id, type: 'debit', amount: -plan.price, reason: `Subscribe ${plan.name} ACTIVE till ${s.expiresAt.slice(0, 10)}`, at: s.at });
    save(); logEvent('sub', 'instant active ' + plan.name + ' by ' + req.user.name);
    res.json(s);
  } finally { busySub.delete(req.user.id); }
});
app.get('/api/subscription/my', auth, (req, res) => {
  const s = activeSub(req.user.id);
  const all = db.subs.filter(x => x.userId === req.user.id).reverse();
  res.json({ active: s, history: all });
});

// ---------- admin (D) ----------
app.get('/api/admin/stats', adminAuth, (req, res) => {
  res.json({ users: db.users.length, totalPaid: db.ad_views.reduce((s, v) => s + (v.reward || 0), 0), adViews: db.ad_views.length, pendingW: db.withdraws.filter(w => w.status === 'pending').length, openTickets: db.tickets.filter(t => t.status === 'open').length });
});
app.get('/api/admin/users', adminAuth, (req, res) => res.json(db.users.slice(-100).reverse().map(publicUser)));
app.get('/api/admin/withdraws', adminAuth, (req, res) => res.json(db.withdraws.slice().reverse()));
app.post('/api/admin/withdraw/:id/:act', adminAuth, (req, res) => {
  const w = db.withdraws.find(x => x.id === req.params.id);
  if (!w || w.status !== 'pending') return res.status(400).json({ error: 'bad' });
  const u = db.users.find(x => x.id === w.userId);
  if (req.params.act === 'approve') w.status = 'paid';
  else { w.status = 'rejected'; if (u) { u.balance = +(u.balance + w.amount).toFixed(4); } }
  save(); res.json(w);
});
app.post('/api/admin/user/:id/ban', adminAuth, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'no' });
  u.banned = !u.banned; save(); res.json({ banned: u.banned });
});
app.post('/api/admin/config', adminAuth, (req, res) => {
  const b = req.body || {};
  for (const k of ['maintenance', 'forceUpdate', 'latestVersion', 'minWithdraw', 'referralCommission', 'checkinBonus', 'spinRewards', 'levels', 'tasks', 'rewardByCountry', 'notice']) {
    if (b[k] !== undefined) db.config[k] = b[k];
  }
  if (b.ads) db.config.ads = { ...db.config.ads, ...b.ads };
  if (b.notice) db.config.notice = { ...db.config.notice, ...b.notice };
  save(); res.json(db.config);
});
// session inactivity timeout: tokens older than 12h must re-login (checked on /api/me)
const SESSION_TTL = 12 * 60 * 60 * 1000;
app.get('/api/me', auth, (req, res) => {
  const age = Date.now() - new Date(req.user.createdAt).getTime();
  if (age > SESSION_TTL && !req.user.isAdmin) {
    return res.status(401).json({ error: 'session expired, login again' });
  }
  res.json({ user: publicUser(req.user) });
});
// logout: clear cookie
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  logEvent('logout', req.user ? req.user.name : 'anon');
  res.json({ ok: true });
});
// test/reset helper (admin only)
app.post('/api/admin/reset-cooldown', adminAuth, (req, res) => {
  for (const u of db.users) { u.lastAdAt = 0; u.todayCount = 0; }
  save(); res.json({ ok: true });
});
// ---------- Else Pay console (Paddle-like, real) ----------
app.get('/api/console/overview', adminAuth, (req, res) => {
  const txs = db.transactions;
  res.json({
    users: db.users.length,
    adViews: db.ad_views.length,
    totalRewards: +db.ad_views.reduce((s, v) => s + (v.reward || 0), 0).toFixed(4),
    totalWithdraw: db.withdraws.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0),
    pendingW: db.withdraws.filter(w => w.status === 'pending').length,
    openTickets: db.tickets.filter(t => t.status === 'open').length,
    recentTx: txs.slice(-10).reverse(),
  });
});
app.get('/api/console/billing', adminAuth, (req, res) => res.json(db.config.billing));
app.post('/api/console/billing', adminAuth, (req, res) => {
  const b = req.body || {};
  if (b.currency) db.config.billing.currency = b.currency;
  if (b.mode) db.config.billing.mode = b.mode;
  if (Array.isArray(b.providers)) db.config.billing.providers = b.providers;
  if (b.minWithdraw !== undefined) db.config.minWithdraw = Number(b.minWithdraw);
  save(); res.json(db.config.billing);
});
app.post('/api/console/billing/provider/:id/toggle', adminAuth, (req, res) => {
  const p = (db.config.billing.providers || []).find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'no provider' });
  p.enabled = !p.enabled; save(); res.json(p);
});
app.post('/api/console/billing/provider/:id', adminAuth, (req, res) => {
  const p = (db.config.billing.providers || []).find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'no provider' });
  Object.assign(p, req.body || {});
  save(); res.json(p);
});
app.get('/api/console/auth-settings', adminAuth, (req, res) => res.json(db.config.authSettings));
app.post('/api/console/auth-settings', adminAuth, (req, res) => {
  Object.assign(db.config.authSettings, req.body || {});
  save(); res.json(db.config.authSettings);
});
app.get('/api/console/webhooks', adminAuth, (req, res) => res.json(db.config.webhooks));
app.post('/api/console/webhooks', adminAuth, (req, res) => {
  Object.assign(db.config.webhooks, req.body || {});
  save(); res.json(db.config.webhooks);
});
app.post('/api/console/change-key', adminAuth, (req, res) => {
  const { newKey } = req.body || {};
  if (!newKey || String(newKey).length < 6) return res.status(400).json({ error: 'min 6 chars' });
  db.config.adminKeyOverride = String(newKey); save();
  logEvent('auth', 'admin key changed');
  res.json({ ok: true });
});
// admin app account (unlimited money) - view + reset device ID + password
app.get('/api/console/admin-account', adminAuth, (req, res) => {
  const a = db.users.find(u => u.isAdmin);
  if (!a) return res.status(404).json({ error: 'no admin' });
  res.json({ deviceId: a.deviceId, name: a.name, balance: a.balance, referralCode: a.referralCode, passwordSet: !!db.config.adminPassHash });
});
app.post('/api/console/admin-account/reset', adminAuth, (req, res) => {
  const a = db.users.find(u => u.isAdmin);
  if (!a) return res.status(404).json({ error: 'no admin' });
  a.deviceId = 'ELSE-ADMIN-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  a.balance = 999999999; save(); logEvent('auth', 'admin device ID reset');
  res.json({ deviceId: a.deviceId });
});
app.post('/api/console/admin-account/password', adminAuth, (req, res) => {
  const { newPass } = req.body || {};
  if (!newPass || String(newPass).length < 6) return res.status(400).json({ error: 'min 6 chars' });
  const salt = crypto.randomBytes(8).toString('hex');
  db.config.adminPassHash = { salt, hash: hashAdminPass(String(newPass), salt) };
  save(); logEvent('auth', 'admin password changed');
  res.json({ ok: true });
});
app.post('/api/console/admin-account/password/reset', adminAuth, (req, res) => {
  const np = 'Admin-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const salt = crypto.randomBytes(8).toString('hex');
  db.config.adminPassHash = { salt, hash: hashAdminPass(np, salt) };
  save(); logEvent('auth', 'admin password regenerated');
  res.json({ password: np }); // shown once
});
// Paddle-like: products catalog (real CRUD)
app.get('/api/console/products', adminAuth, (req, res) => res.json(db.config.products));
app.post('/api/console/products', adminAuth, (req, res) => {
  const { name, type, country, price } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const p = { id: nid('prod'), name: String(name).slice(0, 60), type: type || 'reward', country: country || 'ALL', price: Number(price || 0), active: true };
  db.config.products.push(p); save(); logEvent('product', 'created ' + p.name);
  res.json(p);
});
app.post('/api/console/products/:id', adminAuth, (req, res) => {
  const p = db.config.products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'no product' });
  const { id, merchantId, ...safe } = req.body || {};
  Object.assign(p, safe); save(); logEvent('product', 'updated ' + p.name);
  res.json(p);
});
app.post('/api/console/products/:id/toggle', adminAuth, (req, res) => {
  const p = db.config.products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'no product' });
  p.active = !p.active; save(); res.json(p);
});
// Paddle-like: notifications (real)
app.get('/api/console/notifications', adminAuth, (req, res) => res.json(db.config.notifications));
app.post('/api/console/notifications', adminAuth, (req, res) => {
  Object.assign(db.config.notifications, req.body || {});
  if ((req.body || {}).notice) db.config.notice = { en: req.body.notice, bn: req.body.notice };
  save(); logEvent('notification', 'templates updated');
  res.json(db.config.notifications);
});
// Paddle-like: developers (real keys)
app.get('/api/console/developers', adminAuth, (req, res) => res.json(db.config.developer));
app.post('/api/console/developers/regenerate', adminAuth, (req, res) => {
  const { key } = req.body || {};
  if (key === 'publicKey') db.config.developer.publicKey = 'else-pub-' + crypto.randomBytes(6).toString('hex');
  if (key === 'webhookSecret') db.config.developer.webhookSecret = 'whsec_' + crypto.randomBytes(12).toString('hex');
  save(); logEvent('developer', 'regenerated ' + key);
  res.json(db.config.developer);
});
// Paddle-like: transactions + reports + events (real)
app.get('/api/console/transactions', adminAuth, (req, res) => res.json(db.transactions.slice(-100).reverse()));
app.get('/api/console/reports', adminAuth, (req, res) => {
  const byCountry = {};
  for (const v of db.ad_views) { const c = v.country || 'NA'; byCountry[c] = +(((byCountry[c] || 0) + (v.reward || 0))).toFixed(4); }
  const byMethod = {};
  for (const w of db.withdraws) { byMethod[w.method || 'NA'] = (byMethod[w.method || 'NA'] || 0) + 1; }
  res.json({ byCountry, byMethod, totals: { rewards: +db.ad_views.reduce((s, v) => s + (v.reward || 0), 0).toFixed(4), payouts: db.withdraws.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0) } });
});
app.get('/api/console/events', adminAuth, (req, res) => res.json((db.events || []).slice().reverse()));
// console subscriptions: plans CRUD + approve (payment approve -> auto active, real)
app.get('/api/console/plans', adminAuth, (req, res) => res.json(db.config.plans));
app.post('/api/console/plans', adminAuth, (req, res) => {
  const { name, price, days, mult, dailyMax } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const p = { id: nid('plan'), name: String(name).slice(0, 60), price: Number(price || 0), days: Number(days || 30), mult: Number(mult || 1.5), dailyMax: Number(dailyMax || 50), active: true };
  db.config.plans.push(p); save(); logEvent('plan', 'created ' + p.name);
  res.json(p);
});
app.post('/api/console/plans/:id', adminAuth, (req, res) => {
  const p = db.config.plans.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'no plan' });
  const { id, ...safe } = req.body || {};
  Object.assign(p, safe); save(); res.json(p);
});
app.post('/api/console/plans/:id/toggle', adminAuth, (req, res) => {
  const p = db.config.plans.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'no plan' });
  p.active = !p.active; save(); res.json(p);
});
app.get('/api/console/subscriptions', adminAuth, (req, res) => res.json(db.subs.slice().reverse()));
app.post('/api/console/subscriptions/:id/:act', adminAuth, (req, res) => {
  const s = db.subs.find(x => x.id === req.params.id);
  if (!s || s.status !== 'pending') return res.status(400).json({ error: 'bad status' });
  const u = db.users.find(x => x.id === s.userId);
  if (req.params.act === 'approve') {
    // payment approve -> auto active, user can use immediately (real)
    const start = new Date();
    const exp = new Date(start.getTime() + Number(s.days || 30) * 864e5);
    s.status = 'active'; s.startedAt = start.toISOString(); s.expiresAt = exp.toISOString();
    if (u) db.transactions.push({ id: nid('tx'), userId: u.id, type: 'earn', amount: 0, reason: `Subscription ACTIVE ${s.planName} till ${s.expiresAt.slice(0, 10)}`, at: s.startedAt });
    logEvent('sub', 'approved+active ' + s.planName + ' for ' + s.name);
  } else {
    s.status = 'rejected';
    if (u) { u.balance = +(u.balance + s.price).toFixed(4); db.transactions.push({ id: nid('tx'), userId: u.id, type: 'earn', amount: s.price, reason: 'Subscribe refund ' + s.planName, at: new Date().toISOString() }); }
    logEvent('sub', 'rejected+refunded ' + s.planName);
  }
  save(); res.json(s);
});

app.get('/api/admin/tickets', adminAuth, (req, res) => res.json(db.tickets.slice().reverse()));
app.post('/api/admin/tickets/:id/reply', adminAuth, (req, res) => {
  const t = db.tickets.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'no' });
  t.reply = sanitize((req.body || {}).reply || '', 500); t.status = 'closed'; save(); res.json(t);
});

// ---------- Else Pay gateway: other webs use our console (real) ----------
// User spends earned $ on merchant sites. Merchant needs: api key + product id.
function merchantAuth(req, res, next) {
  const sk = req.headers['x-else-secret'];
  const m = (db.merchants || []).find(x => x.secretKey === sk && x.active);
  if (!m) return res.status(401).json({ error: 'bad else secret key' });
  req.merchant = m;
  next();
}
async function sendWebhook(m, payload) {
  if (!m.webhookUrl) return 'no-url';
  try {
    const body = JSON.stringify(payload);
    const ts = String(Date.now());
    // HMAC-signed webhook (merchant verifies signature + timestamp, anti-replay)
    const sig = webhookSig(m.secretKey, ts, body);
    const r = await fetch(m.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-else-signature': 't=' + ts + ',v1=' + sig, 'x-else-key': m.publicKey },
      body, signal: AbortSignal.timeout(8000)
    });
    logEvent('webhook', m.name + ' -> ' + r.status);
    return 'sent-' + r.status;
  } catch (e) { logEvent('webhook', m.name + ' fail'); return 'fail'; }
}
// idempotency locks (double-click / replay race protection)
const busyPay = new Set();
const busySub = new Set();
// admin: merchants CRUD (console)
app.get('/api/console/merchants', adminAuth, (req, res) => res.json((db.merchants || []).map(m => ({ ...m, secretKey: m.secretKey.slice(0, 10) + '...' }))));
app.get('/api/console/merchants/:id/secret', adminAuth, (req, res) => {
  const m = (db.merchants || []).find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'no' });
  res.json({ secretKey: m.secretKey, publicKey: m.publicKey });
});
app.post('/api/console/merchants', adminAuth, (req, res) => {
  const { name, website, webhookUrl } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const m = { id: nid('mer'), name: String(name).slice(0, 60), website: website || '', webhookUrl: webhookUrl || '', publicKey: 'else_pk_' + crypto.randomBytes(8).toString('hex'), secretKey: 'else_sk_' + crypto.randomBytes(16).toString('hex'), active: true, at: new Date().toISOString() };
  db.merchants.push(m); save(); logEvent('merchant', 'created ' + m.name);
  res.json(m);
});
app.post('/api/console/merchants/:id', adminAuth, (req, res) => {
  const m = (db.merchants || []).find(x => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'no' });
  const { id, secretKey, publicKey, ...safe } = req.body || {};
  Object.assign(m, safe); save(); res.json(m);
});
// merchant v1 API (third-party server uses secret key)
app.post('/api/v1/products', merchantAuth, (req, res) => {
  const { name, price } = req.body || {};
  if (!name || !price) return res.status(400).json({ error: 'name+price required' });
  const p = { id: 'else_prod_' + crypto.randomBytes(6).toString('hex'), merchantId: req.merchant.id, name: String(name).slice(0, 80), type: 'merchant', country: 'ALL', price: Number(price), active: true };
  db.config.products.push(p); save();
  res.json({ product_id: p.id, name: p.name, price: p.price });
});
app.get('/api/v1/products', merchantAuth, (req, res) => res.json(db.config.products.filter(p => p.merchantId === req.merchant.id)));
app.post('/api/v1/charges', merchantAuth, (req, res) => {
  const { product_id, amount, returnUrl } = req.body || {};
  let amt = Number(amount || 0);
  let pname = 'Custom charge';
  if (product_id) {
    const p = db.config.products.find(x => x.id === product_id && (x.merchantId === req.merchant.id || !x.merchantId));
    if (!p) return res.status(404).json({ error: 'bad product_id' });
    amt = Number(p.price); pname = p.name;
  }
  if (!amt || amt <= 0) return res.status(400).json({ error: 'amount required' });
  const c = { id: 'ch_' + crypto.randomBytes(8).toString('hex'), merchantId: req.merchant.id, merchant: req.merchant.name, product: pname, productId: product_id || null, amount: amt, currency: db.config.billing.currency, status: 'created', payerUserId: null, returnUrl: returnUrl || '', webhookSent: '', at: new Date().toISOString() };
  db.charges.push(c); save();
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '') || '';
  res.json({ charge_id: c.id, amount: c.amount, currency: c.currency, checkout_url: base + '/app/pay/' + c.id, status: c.status });
});
app.get('/api/v1/charges/:id', merchantAuth, (req, res) => {
  const c = (db.charges || []).find(x => x.id === req.params.id && x.merchantId === req.merchant.id);
  if (!c) return res.status(404).json({ error: 'no charge' });
  res.json({ charge_id: c.id, status: c.status, amount: c.amount, payer: c.payerUserId });
});
// user checkout (earned $ diye pay) - login must
app.get('/api/pay/:id', auth, (req, res) => {
  const c = (db.charges || []).find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'no charge' });
  res.json({ charge_id: c.id, merchant: c.merchant, product: c.product, amount: c.amount, currency: c.currency, status: c.status, balance: req.user.balance });
});
app.post('/api/pay/:id/confirm', auth, async (req, res) => {
  const c = (db.charges || []).find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'no charge' });
  if (c.status === 'paid') return res.json({ ok: true, status: 'paid', returnUrl: c.returnUrl });
  if (c.status !== 'created') return res.status(400).json({ error: c.status });
  if (busyPay.has(c.id)) return res.status(429).json({ error: 'processing, wait' });
  busyPay.add(c.id);
  try {
    if (req.user.balance < c.amount) return res.status(400).json({ error: 'low balance, earn more $' });
    debit(req.user, c.amount);
    c.status = 'paid'; c.payerUserId = req.user.id;
    db.transactions.push({ id: nid('tx'), userId: req.user.id, type: 'debit', amount: -c.amount, reason: `Else Pay to ${c.merchant} (${c.product})`, at: new Date().toISOString() });
    save();
    logEvent('pay', `${c.merchant} $${c.amount} by ${req.user.name}`);
    const m = (db.merchants || []).find(x => x.id === c.merchantId);
    if (m) c.webhookSent = await sendWebhook(m, { charge_id: c.id, status: 'paid', amount: c.amount, product: c.product });
    save();
    res.json({ ok: true, status: 'paid', balance: req.user.balance, returnUrl: c.returnUrl });
  } finally { busyPay.delete(c.id); }
});
app.get('/api/console/charges', adminAuth, (req, res) => res.json((db.charges || []).slice().reverse()));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', index: false }));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
// ---------- earn app ----------
// Root of the main domain IS the earn place: elsepay.indevs.in -> earn app.
// /app kept for backwards compatibility (existing WebView links).
app.get(['/', '/app', /^\/app(\/.*)?$/], (req, res) => res.sendFile(path.join(__dirname, 'public', 'app', 'index.html')));

app.listen(PORT, () => console.log('Else server on :' + PORT + ' adminKey=' + ADMIN_KEY));
