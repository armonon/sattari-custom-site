// In-memory stand-in for @netlify/blobs with the semantics the shop relies on:
// ETags on reads, and conditional writes (onlyIfNew / onlyIfMatch) that refuse
// a stale write with `{ modified: false }` the way the real SDK does.
//
// Every operation yields to the event loop first, so two flows started with
// Promise.all genuinely interleave between their reads and writes.
//
// `fault` lets a test fail one specific operation, standing in for a function
// that crashed or lost its connection at exactly that point. `conflict` makes
// a conditional write lose, as if another writer always got there first.

const clone = (value) => (value === undefined ? undefined : structuredClone(value));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export function createMemoryBlobs() {
  const stores = new Map();
  let version = 0;

  const state = {
    fault: null,
    conflict: null,
    ops: [],
  };

  function storeFor(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }

  async function run(name, method, key, value, fn) {
    await tick();
    state.ops.push({ store: name, method, key });
    const injected = state.fault?.({ store: name, method, key, value: clone(value) });
    if (injected) throw injected instanceof Error ? injected : new Error('Injected failure');
    return fn();
  }

  function makeStore(name) {
    const entries = storeFor(name);

    return {
      get: (key) =>
        run(name, 'get', key, undefined, () =>
          entries.has(key) ? clone(entries.get(key).data) : null
        ),
      getWithMetadata: (key) =>
        run(name, 'getWithMetadata', key, undefined, () =>
          entries.has(key)
            ? { data: clone(entries.get(key).data), etag: entries.get(key).etag, metadata: {} }
            : null
        ),
      setJSON: (key, data, options = {}) =>
        run(name, 'setJSON', key, data, () => {
          const current = entries.get(key);
          const conditional = options.onlyIfNew || options.onlyIfMatch;
          if (conditional && state.conflict?.({ store: name, key })) return { modified: false };
          if (options.onlyIfNew && current) return { modified: false };
          if (options.onlyIfMatch && options.onlyIfMatch !== current?.etag) {
            return { modified: false };
          }
          version += 1;
          const etag = `"v${version}"`;
          entries.set(key, { data: clone(data), etag });
          return { modified: true, etag };
        }),
      set: (key, data) =>
        run(name, 'set', key, data, () => {
          version += 1;
          entries.set(key, { data, etag: `"v${version}"` });
          return { modified: true };
        }),
      list: (options = {}) =>
        run(name, 'list', options.prefix || '', undefined, () => ({
          blobs: [...entries.entries()]
            .filter(([key]) => key.startsWith(options.prefix || ''))
            .map(([key, entry]) => ({ key, etag: entry.etag })),
          directories: [],
        })),
      delete: (key) =>
        run(name, 'delete', key, undefined, () => {
          entries.delete(key);
        }),
    };
  }

  return {
    state,
    module: {
      connectLambda: () => {},
      getStore: (options) => makeStore(typeof options === 'string' ? options : options?.name),
    },
    read(name, key) {
      const entry = storeFor(name).get(key);
      return entry ? clone(entry.data) : null;
    },
    write(name, key, data) {
      version += 1;
      storeFor(name).set(key, { data: clone(data), etag: `"v${version}"` });
    },
    keys(name) {
      return [...storeFor(name).keys()];
    },
    reset() {
      stores.clear();
      state.fault = null;
      state.conflict = null;
      state.ops.length = 0;
    },
  };
}
