import { connectLambda, getStore } from '@netlify/blobs';
import { blobsEvent } from './functionAdapter.js';

// Opens a blob store that prefers strong consistency and degrades visibly.
//
// Strong reads need an `uncachedEdgeURL` in the Blobs context. Netlify gives
// one to v2 functions (`export default` + `config`) only: a Lambda-style
// `handler` function is connected through connectLambda(), which sets just the
// cached edge URL, so every strong read there fails. That is why every function
// in netlify/functions is v2. `npm run dev:api` provides the uncached URL too;
// an environment that cannot (an older `netlify dev`) falls back to eventual
// consistency rather than not working at all.
//
// The fallback is never silent: it logs, and /api/inventory reports it. A
// fallback in production means a function is not getting the v2 Blobs context,
// and stock read from that instance may be stale.

function isConsistencyUnavailable(error) {
  const message = String(error?.message || error);
  return message.includes('uncachedEdgeURL') || message.includes('strong consistency');
}

let warned = false;
let degraded = false;

// Whether any read in this instance has had to fall back to eventual
// consistency. The environment does not change during an instance's life, so
// once true it stays true.
export function isConsistencyDegraded() {
  return degraded;
}

function warnOnce(name) {
  degraded = true;
  if (warned) return;
  warned = true;
  console.warn(
    JSON.stringify({
      type: 'blobs-consistency-degraded',
      store: name,
      message:
        'Strong consistency unavailable in this environment; using eventual consistency. Expected only under an old `netlify dev`; in production it means a function is not running as a v2 function.',
    })
  );
}

// Reads ask for strong consistency at the operation level as well as on the
// store. Belt and braces: measured against production, neither alone reliably
// closed the read-after-write window (see docs/INVENTORY.md), so the actual
// consistency achieved is reported rather than assumed.
const READ_OPTION_INDEX = { get: 1, getWithMetadata: 1, list: 0 };

function withStrongRead(method, args) {
  const index = READ_OPTION_INDEX[method];
  if (index === undefined) return args;

  const next = [...args];
  while (next.length <= index) next.push(undefined);
  next[index] = { ...(next[index] || {}), consistency: 'strong' };
  return next;
}

// `event` is only used when it carries Lambda-style Blobs credentials; an
// event adapted from a v2 request has none and must not reach connectLambda(),
// which would throw on it.
export function openStore(event, name) {
  const lambda = blobsEvent(event);
  if (lambda) connectLambda(lambda);

  let strong = null;
  try {
    strong = getStore({ name, consistency: 'strong' });
  } catch {
    strong = null;
  }
  const eventual = getStore({ name });

  const call = async (method, ...args) => {
    if (strong) {
      try {
        return await strong[method](...withStrongRead(method, args));
      } catch (error) {
        if (!isConsistencyUnavailable(error)) throw error;
        warnOnce(name);
        strong = null;
      }
    }
    return eventual[method](...args);
  };

  return {
    get: (...args) => call('get', ...args),
    getWithMetadata: (...args) => call('getWithMetadata', ...args),
    set: (...args) => call('set', ...args),
    setJSON: (...args) => call('setJSON', ...args),
    list: (...args) => call('list', ...args),
    delete: (...args) => call('delete', ...args),
    // 'strong' until a read here had to fall back.
    get consistency() {
      return strong ? 'strong' : 'eventual';
    },
  };
}

// The write half of every read-modify-write in the server code. `current` is
// the { data, etag } the change was computed from (null when the key did not
// exist), so the write lands only if nobody else wrote in between.
//
// @netlify/blobs answers a conditional write with `{ modified: false }` only
// for a 412. Any other response — a 5xx after its own retries, a rejected
// token — comes back as `{ modified: true }` with the response's etag, which
// is empty for an error. So an empty etag is not proof: the entry is read back
// and the write counts only if it holds exactly what was written.
//
// Resolves true when the write landed and false when another writer got there
// first; throws when storage failed, which a retry of the race would not fix.
export async function writeIfUnchanged(store, key, value, current) {
  const result = await store.setJSON(
    key,
    value,
    current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
  );
  if (result?.modified === false) return false;
  if (result?.modified === true && result.etag) return true;

  const stored = await store.getWithMetadata(key, { type: 'json' });
  if (stored && JSON.stringify(stored.data) === JSON.stringify(value)) return true;
  throw Object.assign(new Error(`Storage did not confirm the write to "${key}".`), {
    code: 'BLOB_WRITE_UNCONFIRMED',
  });
}

// Pause before retrying a lost conditional write. Full jitter, growing with
// each attempt: writers that all lost to the same winner otherwise re-read and
// collide again in lockstep.
export function pauseBeforeRetry(attempt, { baseMs = 15, maxMs = 400 } = {}) {
  const ceiling = Math.min(maxMs, baseMs * 2 ** attempt);
  return new Promise((resolve) => {
    setTimeout(resolve, Math.random() * ceiling);
  });
}

// Runs `task` over `items` a few at a time: one request each, without opening
// them all at once. Results keep the order of `items`.
export async function eachLimited(items, task, concurrency = 8) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
