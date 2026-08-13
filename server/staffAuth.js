import process from 'node:process';
import crypto from 'node:crypto';

// Staff authentication for the inventory page.
//
// The staff page lives at an unlisted URL, but that is friction against
// scanners, not security: these functions sit at fixed, guessable endpoints
// that anyone can POST to directly. The password is the actual lock, and it is
// checked here on every request rather than in the page.
//
// Secrets live in Netlify environment variables, never in the repo:
//   STAFF_USERNAME         the username staff type to sign in
//   STAFF_PASSWORD_SALT    hex salt from scripts/hash-staff-password.mjs
//   STAFF_PASSWORD_HASH    hex scrypt hash of the password
//   STAFF_SESSION_SECRET   random key used to sign session tokens

const SESSION_HOURS = 12;

export function getAuthConfig() {
  return {
    username: process.env.STAFF_USERNAME || '',
    salt: process.env.STAFF_PASSWORD_SALT || '',
    hash: process.env.STAFF_PASSWORD_HASH || '',
    secret: process.env.STAFF_SESSION_SECRET || '',
  };
}

export function isConfigured() {
  const { username, salt, hash, secret } = getAuthConfig();
  return Boolean(username && salt && hash && secret);
}

export function hashPassword(password, salt) {
  return crypto.scryptSync(String(password ?? ''), salt, 64).toString('hex');
}

// Constant-time comparison. A plain !== leaks how much of the value matched
// through timing, which is the mistake this codebase already makes in
// server/adminOrderAccess.js.
function safeEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// Compared in constant time and case-insensitively: a username is an
// identifier, not a secret, and rejecting the right person for capitalising it
// at a busy counter buys nothing.
export function checkUsername(username) {
  const expected = getAuthConfig().username;
  if (!expected) return false;
  return safeEqual(String(username ?? '').trim().toLowerCase(), expected.trim().toLowerCase());
}

export function checkPassword(password) {
  const { salt, hash } = getAuthConfig();
  if (!salt || !hash) return false;

  let attempt;
  try {
    attempt = hashPassword(password, salt);
  } catch {
    return false;
  }
  return safeEqual(attempt, hash);
}

export function signSession(payload) {
  const { secret } = getAuthConfig();
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifySession(token) {
  const { secret } = getAuthConfig();
  if (!secret || !token || typeof token !== 'string' || !token.includes('.')) return null;

  const [body, mac] = token.split('.');
  if (!body || !mac) return null;

  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeEqual(mac, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    // Expiry is checked server-side. The token is signed, so a client cannot
    // extend it, but it must still be rejected once it lapses.
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function createSession(staffName) {
  return signSession({
    staff: String(staffName || '').trim().slice(0, 40),
    exp: Date.now() + SESSION_HOURS * 3600 * 1000,
  });
}

export function getBearerToken(headers = {}) {
  const raw = headers.authorization || headers.Authorization || '';
  if (typeof raw !== 'string') return '';
  return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : '';
}

// Returns the session payload, or null when the request is not authenticated.
export function requireStaff(event) {
  return verifySession(getBearerToken(event?.headers || {}));
}

// Netlify sets x-nf-client-connection-ip from the edge, so unlike
// x-forwarded-for it cannot be forged by the caller. Throttling on a
// client-controlled header would let an attacker reset the counter at will.
export function getClientIp(event) {
  const headers = event?.headers || {};
  return (
    headers['x-nf-client-connection-ip'] ||
    headers['X-Nf-Client-Connection-Ip'] ||
    'unknown'
  );
}

export const SESSION_TTL_HOURS = SESSION_HOURS;
