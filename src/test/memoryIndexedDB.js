// A small in-memory IndexedDB for unit tests: object stores with key paths
// (including compound keys), get/getAll/getAllKeys/put/delete/openCursor, key
// ranges, and transactions that complete after their requests. Not a full
// implementation; it covers what the Studio stores use.

const typeRank = (key) =>
  typeof key === 'number' ? 0 : key instanceof Date ? 1 : typeof key === 'string' ? 2 : 4;

export function compareKeys(a, b) {
  const rankA = typeRank(a),
    rankB = typeRank(b);
  if (rankA !== rankB) return rankA < rankB ? -1 : 1;
  if (Array.isArray(a)) {
    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      const order = compareKeys(a[index], b[index]);
      if (order) return order;
    }
    return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
  }
  const x = a instanceof Date ? a.getTime() : a,
    y = b instanceof Date ? b.getTime() : b;
  return x === y ? 0 : x < y ? -1 : 1;
}

class MemoryKeyRange {
  constructor(lower, upper, lowerOpen = false, upperOpen = false) {
    Object.assign(this, { lower, upper, lowerOpen, upperOpen });
  }
  static bound(lower, upper, lowerOpen, upperOpen) {
    return new MemoryKeyRange(lower, upper, lowerOpen, upperOpen);
  }
  static only(key) {
    return new MemoryKeyRange(key, key);
  }
  includes(key) {
    const low = compareKeys(key, this.lower),
      high = compareKeys(key, this.upper);
    return (this.lowerOpen ? low > 0 : low >= 0) && (this.upperOpen ? high < 0 : high <= 0);
  }
}

// Shallow copies: jsdom Blobs cannot be structured-cloned, and the stores
// never mutate nested values in place.
const copyOf = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : value;

const matches = (query, key) =>
  query instanceof MemoryKeyRange ? query.includes(key) : compareKeys(query, key) === 0;

export function createMemoryIndexedDB() {
  const databases = new Map();

  function transactionFor(database, names, mode) {
    const pending = new Set();
    const transaction = { mode, error: null, oncomplete: null, onerror: null, onabort: null };
    let completed = false;
    const settle = () =>
      queueMicrotask(() => {
        if (completed || pending.size) return;
        completed = true;
        transaction.oncomplete?.();
      });
    const request = (run) => {
      const handle = { result: undefined, error: null, onsuccess: null, onerror: null };
      pending.add(handle);
      queueMicrotask(() => {
        handle.result = run();
        pending.delete(handle);
        handle.onsuccess?.();
        settle();
      });
      return handle;
    };
    const scope = new Set([names].flat());
    transaction.objectStore = (name) => {
      if (!scope.has(name)) throw new Error(`Store ${name} is not in this transaction.`);
      const store = database.stores.get(name);
      const sorted = () => [...store.rows.entries()].sort(([a], [b]) => compareKeys(a, b));
      const keyOf = (value) =>
        Array.isArray(store.keyPath)
          ? store.keyPath.map((path) => value[path])
          : value[store.keyPath];
      const writable = () => {
        if (mode !== 'readwrite') throw new Error('Read-only transaction.');
      };
      const find = (key) => sorted().find(([stored]) => compareKeys(stored, key) === 0);
      return {
        put(value) {
          writable();
          const copy = copyOf(value);
          return request(() => {
            const key = keyOf(copy);
            const existing = find(key);
            if (existing) store.rows.delete(existing[0]);
            store.rows.set(key, copy);
            return key;
          });
        },
        get: (key) => request(() => copyOf(find(key)?.[1])),
        getAll: () => request(() => sorted().map(([, value]) => copyOf(value))),
        getAllKeys: () => request(() => sorted().map(([key]) => key)),
        delete(query) {
          writable();
          return request(() => {
            for (const [key] of sorted()) if (matches(query, key)) store.rows.delete(key);
          });
        },
        openCursor() {
          const rows = sorted();
          let index = 0;
          const handle = { result: null, onsuccess: null, onerror: null };
          const advance = () => {
            const row = rows[index];
            pending.delete(handle);
            handle.result = row
              ? {
                  key: row[0],
                  value: copyOf(row[1]),
                  delete() {
                    writable();
                    store.rows.delete(row[0]);
                  },
                  continue() {
                    index += 1;
                    pending.add(handle);
                    queueMicrotask(advance);
                  },
                }
              : null;
            handle.onsuccess?.();
            settle();
          };
          pending.add(handle);
          queueMicrotask(advance);
          return handle;
        },
        createIndex() {},
      };
    };
    settle();
    return transaction;
  }

  function connection(database) {
    return {
      objectStoreNames: { contains: (name) => database.stores.has(name) },
      createObjectStore(name, { keyPath }) {
        database.stores.set(name, { keyPath, rows: new Map() });
        return { createIndex() {} };
      },
      transaction: (names, mode = 'readonly') => transactionFor(database, names, mode),
      close() {},
    };
  }

  return {
    databases,
    open(name, version = 1) {
      const request = { result: null, error: null };
      queueMicrotask(() => {
        let database = databases.get(name);
        const upgrade = !database || database.version < version;
        if (!database) {
          database = { version, stores: new Map() };
          databases.set(name, database);
        }
        request.result = connection(database);
        if (upgrade) {
          database.version = version;
          request.onupgradeneeded?.();
        }
        request.onsuccess?.();
      });
      return request;
    },
  };
}

/** Installs a fresh in-memory IndexedDB on globalThis via vi.stubGlobal. */
export function stubMemoryIndexedDB(vi) {
  const indexedDB = createMemoryIndexedDB();
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('IDBKeyRange', MemoryKeyRange);
  return indexedDB;
}
