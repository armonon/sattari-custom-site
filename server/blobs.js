import { connectLambda, getStore } from '@netlify/blobs';

// Opens a blob store that prefers strong consistency and degrades gracefully.
//
// Strong consistency requires an `uncachedEdgeURL` in the environment. The real
// Netlify runtime always provides it; `netlify dev` does not, so every read
// throws there and nothing local works at all. Rather than making local
// development impossible — or worse, weakening consistency everywhere to suit
// it — we try the strong store first and fall back only when the environment
// genuinely cannot support it.
//
// This never silently weakens production: in production the strong path
// succeeds, so the fallback is unreachable. When it does trigger, it logs.

function isConsistencyUnavailable(error) {
  const message = String(error?.message || error);
  return message.includes('uncachedEdgeURL') || message.includes('strong consistency');
}

let warned = false;
let degraded = false;

// Whether any read in this instance has had to fall back to eventual
// consistency. Surfaced in /api/inventory so a silent downgrade is visible
// instead of showing up later as an unexplained stale number.
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
        'Strong consistency unavailable in this environment; using eventual consistency. Expected under `netlify dev`, not in production.',
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

export function openStore(event, name) {
  if (event) connectLambda(event);

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
  };
}
