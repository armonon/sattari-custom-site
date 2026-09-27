import process from 'node:process';
import crypto from 'node:crypto';
import { openStore } from './blobs.js';
import { blobsEvent } from './functionAdapter.js';

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

// Signed tokens cannot be recalled on their own, so every request also checks a
// small server-side record: `epoch` invalidates every token minted before it
// (sign out everywhere), and `revoked` lists single sign-ins that were signed
// out, kept only until those tokens would have expired anyway.
export const SESSION_STORE = 'staff-auth';
const SESSION_STATE_KEY = 'sessions';

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
// through timing.
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
  return safeEqual(
    String(username ?? '')
      .trim()
      .toLowerCase(),
    expected.trim().toLowerCase()
  );
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

// Synchronous so it can be called anywhere; the sign-in function passes the
// current epoch, read from the session record, for the token to be accepted.
export function createSession(staffName, { epoch = 0 } = {}) {
  const now = Date.now();
  return signSession({
    staff: String(staffName || '')
      .trim()
      .slice(0, 40),
    sid: crypto.randomBytes(16).toString('base64url'),
    epoch,
    iat: now,
    exp: now + SESSION_HOURS * 3600 * 1000,
  });
}

export function getBearerToken(headers = {}) {
  const raw = headers.authorization || headers.Authorization || '';
  if (typeof raw !== 'string') return '';
  return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : '';
}

function parseSessionState(raw) {
  const doc = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const revoked = doc.revoked;
  return {
    epoch: Number.isSafeInteger(doc.epoch) && doc.epoch > 0 ? doc.epoch : 0,
    revoked: revoked && typeof revoked === 'object' && !Array.isArray(revoked) ? revoked : {},
  };
}

function sessionStore(event) {
  return openStore(blobsEvent(event), SESSION_STORE);
}

export async function readSessionState(event) {
  return parseSessionState(await sessionStore(event).get(SESSION_STATE_KEY, { type: 'json' }));
}

export async function currentSessionEpoch(event) {
  return (await readSessionState(event)).epoch;
}

async function updateSessionState(event, change, attempts = 6) {
  const store = sessionStore(event);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await store.getWithMetadata(SESSION_STATE_KEY, { type: 'json' });
    const next = change(parseSessionState(current?.data));
    const result = await store.setJSON(
      SESSION_STATE_KEY,
      next,
      current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
    );
    if (result?.modified === true) return next;
    if (result?.modified !== false) {
      throw new Error('Session storage does not support conditional writes.');
    }
  }
  throw new Error('Session record is busy.');
}

// Signs out one sign-in. Entries whose tokens have expired are dropped on every
// write, so the record stays as small as the number of recent sign-outs.
export function revokeSession(event, session, now = Date.now()) {
  return updateSessionState(event, (state) => {
    const revoked = {};
    for (const [sid, exp] of Object.entries(state.revoked)) {
      if (typeof exp === 'number' && exp > now) revoked[sid] = exp;
    }
    if (typeof session?.sid === 'string') {
      revoked[session.sid] = Number(session.exp) || now + SESSION_HOURS * 3600 * 1000;
    }
    return { epoch: state.epoch, revoked };
  });
}

// Signs out every device at once.
export function revokeAllSessions(event) {
  return updateSessionState(event, (state) => ({ epoch: state.epoch + 1, revoked: {} }));
}

// Returns the session payload, or null when the request is not authenticated.
// Async: callers must await it, or a pending Promise reads as "signed in".
export async function requireStaff(event) {
  const session = verifySession(getBearerToken(event?.headers || {}));
  if (!session || typeof session.sid !== 'string' || !Number.isSafeInteger(session.epoch)) {
    return null;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const state = await readSessionState(event);
      if (session.epoch !== state.epoch || Object.hasOwn(state.revoked, session.sid)) return null;
      return session;
    } catch (error) {
      if (attempt === 1) {
        // Fail closed: a sign-out that cannot be checked is treated as signed out.
        console.error(
          JSON.stringify({ type: 'staff-session-check-failed', message: error?.message })
        );
      }
    }
  }
  return null;
}

// Netlify sets x-nf-client-connection-ip from the edge, so unlike
// x-forwarded-for it cannot be forged by the caller. Throttling on a
// client-controlled header would let an attacker reset the counter at will.
export function getClientIp(event) {
  const headers = event?.headers || {};
  return headers['x-nf-client-connection-ip'] || headers['X-Nf-Client-Connection-Ip'] || 'unknown';
}

export const SESSION_TTL_HOURS = SESSION_HOURS;
