import { openStore, writeIfUnchanged } from './blobs.js';
import { blobsEvent } from './functionAdapter.js';
import { hashIp } from './ipHash.js';
import { logError } from './log.js';

// Staff sign-in throttle.
//
// State lives in blobs because function instances do not share memory: an
// in-memory counter resets constantly and silently throttles nothing.
//
// An attempt is counted BEFORE the password is checked, with a conditional
// write that has to succeed first. Checking a lock, verifying, and recording
// the failure afterwards lets any number of parallel requests pass the check
// before the first failure is written. Here each verification is paid for with
// a counter increment that a racing request cannot also claim, and if the
// counter cannot be written the attempt is refused, never let through.
//
// Each address has its own record, so one noisy address neither contends with
// nor locks out anyone else. A global ceiling bounds guesses spread across many
// addresses; addresses that recently signed in successfully are exempt from
// it. So is a browser holding a device token (see createDeviceToken), which
// is counted on its own record instead: staff on a new network or a phone
// whose address keeps changing can still sign in while someone elsewhere is
// spraying guesses, and a stolen device token buys no more guesses than one
// address gets.

const STORE = 'staff-auth';
const IP_PREFIX = 'login-ip/';
const DEVICE_PREFIX = 'login-dev/';
const GLOBAL_KEY = 'login-global';

const QUIET_PERIOD_MS = 15 * 60 * 1000;
const LOCK_AFTER_ATTEMPTS = 5;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;
const GLOBAL_WINDOW_MS = 15 * 60 * 1000;
const GLOBAL_LIMIT = 30;
const TRUSTED_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const WRITE_ATTEMPTS = 6;

export class ThrottleUnavailableError extends Error {}

function store(event) {
  return openStore(blobsEvent(event), STORE);
}

function ipKey(ip) {
  return `${IP_PREFIX}${hashIp(ip).slice(0, 32)}`;
}

function deviceKey(device) {
  return `${DEVICE_PREFIX}${hashIp(`device:${device}`).slice(0, 32)}`;
}

// The record an attempt is counted on: the device's when it has a token,
// otherwise the address's.
function attemptKey(ip, device) {
  return device ? deviceKey(device) : ipKey(ip);
}

function pause(attempt) {
  // Jittered, so racing requests stop colliding in lockstep.
  return new Promise((resolve) => setTimeout(resolve, 5 + Math.random() * 20 * (attempt + 1)));
}

// Reads, decides and conditionally writes one key. `decide` returns
// { write, ...result } to store `write` and return the result once the write
// lands, or a result without `write` to return without storing anything.
async function claim(blob, key, decide) {
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    let current;
    try {
      current = await blob.getWithMetadata(key, { type: 'json' });
    } catch (error) {
      throw new ThrottleUnavailableError(error?.message || 'Throttle read failed.');
    }
    const { write, ...result } = decide(current?.data ?? null);
    if (!write) return result;

    // An attempt that was not durably counted must not be let through, so a
    // write the store did not confirm fails closed like any other failure.
    let landed;
    try {
      landed = await writeIfUnchanged(blob, key, write, current);
    } catch (error) {
      throw new ThrottleUnavailableError(error?.message || 'Throttle write failed.');
    }
    if (landed) return result;
    await pause(attempt);
  }
  throw new ThrottleUnavailableError('Throttle record stayed contended.');
}

// A record is forgotten after a quiet stretch measured from the LAST attempt,
// never by comparing against `until`: an unlocked record has until = 0, and a
// check against it would clear the counter on every attempt, which shipped
// once in the original app. Trust survives the reset.
function ipRecord(raw, now) {
  const trustedUntil = typeof raw?.trustedUntil === 'number' ? raw.trustedUntil : 0;
  if (!raw || typeof raw.last !== 'number' || now - raw.last > QUIET_PERIOD_MS) {
    return { n: 0, until: 0, last: 0, trustedUntil };
  }
  return {
    n: Number(raw.n) || 0,
    until: Number(raw.until) || 0,
    last: raw.last,
    trustedUntil,
  };
}

function globalRecord(raw, now) {
  const window = Math.floor(now / GLOBAL_WINDOW_MS);
  return raw?.window === window ? { window, count: Number(raw.count) || 0 } : { window, count: 0 };
}

// Resolves to { allowed: true } when this attempt may verify a password, or
// { allowed: false, retryAfterMs } when it must be refused. Throws
// ThrottleUnavailableError when the attempt could not be counted; callers must
// refuse the sign-in then. `device` is the id from a verified device token.
export async function reserveLoginAttempt(event, ip, now = Date.now(), { device = null } = {}) {
  const blob = store(event);
  const key = attemptKey(ip, device);

  let peek;
  try {
    peek = ipRecord(await blob.get(key, { type: 'json' }), now);
  } catch (error) {
    throw new ThrottleUnavailableError(error?.message || 'Throttle read failed.');
  }
  if (peek.until > now) return { allowed: false, retryAfterMs: peek.until - now };

  if (!device && !(peek.trustedUntil > now)) {
    const global = await claim(blob, GLOBAL_KEY, (raw) => {
      const record = globalRecord(raw, now);
      if (record.count >= GLOBAL_LIMIT) {
        return {
          allowed: false,
          retryAfterMs: (record.window + 1) * GLOBAL_WINDOW_MS - now,
        };
      }
      return {
        allowed: true,
        tripped: record.count + 1 === GLOBAL_LIMIT,
        write: { ...record, count: record.count + 1 },
      };
    });
    // Logged once per window, when the last allowed attempt is taken: from
    // here until the window ends, only trusted addresses and devices get in.
    if (global.tripped) {
      logError('staff-login-global-limit', {
        limit: GLOBAL_LIMIT,
        windowEndsAt: new Date(
          (Math.floor(now / GLOBAL_WINDOW_MS) + 1) * GLOBAL_WINDOW_MS
        ).toISOString(),
      });
    }
    if (!global.allowed) return global;
  }

  return claim(blob, key, (raw) => {
    const record = ipRecord(raw, now);
    if (record.until > now) return { allowed: false, retryAfterMs: record.until - now };
    const n = record.n + 1;
    // Five attempts buy a minute's lock, doubling from there up to fifteen.
    const until =
      n >= LOCK_AFTER_ATTEMPTS
        ? now + Math.min(BASE_LOCK_MS * 2 ** (n - LOCK_AFTER_ATTEMPTS), MAX_LOCK_MS)
        : 0;
    return { allowed: true, write: { ...record, n, until, last: now } };
  });
}

// Clears the count after a correct password and trusts the address for the
// global ceiling. With a device token, the device's count is cleared too.
export async function recordLoginSuccess(event, ip, now = Date.now(), { device = null } = {}) {
  const blob = store(event);
  const trusted = () => ({
    write: { n: 0, until: 0, last: now, trustedUntil: now + TRUSTED_FOR_MS },
  });
  await claim(blob, ipKey(ip), trusted);
  if (device) await claim(blob, deviceKey(device), trusted);
}

// Best-effort cleanup of per-address and per-device records that no longer
// matter, so keys do not pile up as addresses come and go. Bounded per call.
export async function pruneLoginRecords(event, now = Date.now(), limit = 200) {
  const blob = store(event);
  const listed = await Promise.all(
    [IP_PREFIX, DEVICE_PREFIX].map((prefix) => blob.list({ prefix }))
  );
  const blobs = listed.flatMap((page) => page.blobs || []);
  let removed = 0;
  for (const { key } of blobs.slice(0, limit)) {
    const record = await blob.get(key, { type: 'json' });
    const stale = !record || typeof record.last !== 'number' || now - record.last > QUIET_PERIOD_MS;
    if (stale && !(record?.trustedUntil > now)) {
      await blob.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export const THROTTLE_SETTINGS = {
  QUIET_PERIOD_MS,
  LOCK_AFTER_ATTEMPTS,
  BASE_LOCK_MS,
  MAX_LOCK_MS,
  GLOBAL_WINDOW_MS,
  GLOBAL_LIMIT,
  TRUSTED_FOR_MS,
};
