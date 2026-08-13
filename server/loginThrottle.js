import { connectLambda, getStore } from '@netlify/blobs';

// Per-IP login throttle.
//
// The original inventory app kept this in a module-level Map. That cannot work
// on Netlify: every function invocation may run in a fresh instance with fresh
// memory, so an in-memory counter would reset constantly and the throttle would
// silently do nothing at all. State has to be shared, so it lives in a blob.
//
// Keyed per source address rather than globally, because one global counter
// would let an attacker lock the shop out of its own inventory.

const STORE = 'staff-auth';
const KEY = 'login-throttle';

const QUIET_PERIOD_MS = 15 * 60 * 1000;
const LOCK_AFTER_ATTEMPTS = 5;
const BASE_LOCK_MS = 60 * 1000;
const MAX_LOCK_MS = 15 * 60 * 1000;

function store(event) {
  if (event) connectLambda(event);
  return getStore({ name: STORE, consistency: 'strong' });
}

async function read(event) {
  const blob = store(event);
  const result = await blob.getWithMetadata(KEY, { type: 'json' });
  const data = result?.data && typeof result.data === 'object' ? result.data : {};
  return { data, etag: result?.etag || null };
}

// Drops records that have been quiet long enough, so the blob cannot grow
// without bound as addresses come and go.
function prune(records, now) {
  const kept = {};
  for (const [ip, record] of Object.entries(records)) {
    if (record && typeof record.last === 'number' && now - record.last <= QUIET_PERIOD_MS) {
      kept[ip] = record;
    }
  }
  return kept;
}

// Returns milliseconds remaining on a lockout, or 0 when the caller may try.
export async function getLockRemaining(event, ip, now = Date.now()) {
  const { data } = await read(event);
  const record = data[ip];
  if (!record) return 0;

  // Expire the record based on time since the last FAILURE, never by comparing
  // against `until`. An unlocked record has until = 0, and every timestamp is
  // greater than zero, so an `until`-based check would clear the counter on
  // every attempt and the throttle would never engage. That exact bug shipped
  // once in the original app; the fix is load-bearing.
  if (typeof record.last !== 'number' || now - record.last > QUIET_PERIOD_MS) return 0;

  return Math.max(0, (record.until || 0) - now);
}

async function mutate(event, change, attempts = 5) {
  const blob = store(event);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, etag } = await read(event);
    const next = change(data);

    const result = etag
      ? await blob.setJSON(KEY, next, { onlyIfMatch: etag })
      : await blob.setJSON(KEY, next, { onlyIfNew: true });

    if (result?.modified !== false) return next;
  }

  // Losing this race repeatedly means many simultaneous failed logins, which is
  // itself the attack. Surfacing it lets the caller refuse the attempt.
  throw new Error('Could not record login attempt.');
}

export async function recordFailure(event, ip, now = Date.now()) {
  return mutate(event, (records) => {
    const pruned = prune(records, now);
    const record = pruned[ip] || { n: 0, until: 0, last: 0 };

    record.n += 1;
    record.last = now;

    // Five misses buys a minute, doubling from there up to fifteen.
    if (record.n >= LOCK_AFTER_ATTEMPTS) {
      const exponent = record.n - LOCK_AFTER_ATTEMPTS;
      record.until = now + Math.min(BASE_LOCK_MS * 2 ** exponent, MAX_LOCK_MS);
    }

    pruned[ip] = record;
    return pruned;
  });
}

export async function clearFailures(event, ip, now = Date.now()) {
  return mutate(event, (records) => {
    const pruned = prune(records, now);
    delete pruned[ip];
    return pruned;
  });
}

export const THROTTLE_SETTINGS = {
  QUIET_PERIOD_MS,
  LOCK_AFTER_ATTEMPTS,
  BASE_LOCK_MS,
  MAX_LOCK_MS,
};
