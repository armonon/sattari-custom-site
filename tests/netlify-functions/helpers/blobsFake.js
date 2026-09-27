import { vi } from 'vitest';

// In-memory stand-in for @netlify/blobs used by the auth, booking and inquiry
// tests: one map per store, real etags, and the conditional-write semantics
// (onlyIfNew / onlyIfMatch) the server code relies on. Switches in `blobState`
// simulate outages and lost write races.
//
// Use from a test file with:
//   vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);

export const blobState = {
  stores: new Map(),
  writes: 0,
  failReads: false,
  failWrites: false,
  // Optional (storeName, key) => boolean, to fail writes to particular keys.
  failWritesFor: null,
  conflictWrites: false,
};

export function resetBlobs() {
  blobState.stores.clear();
  blobState.writes = 0;
  blobState.failReads = false;
  blobState.failWrites = false;
  blobState.failWritesFor = null;
  blobState.conflictWrites = false;
}

export function blobData(name) {
  if (!blobState.stores.has(name)) blobState.stores.set(name, new Map());
  return blobState.stores.get(name);
}

// Plain values, for assertions and seeding.
export function readBlob(name, key) {
  const entry = blobData(name).get(key);
  return entry ? structuredClone(entry.value) : null;
}

export function seedBlob(name, key, value) {
  blobState.writes += 1;
  blobData(name).set(key, { value: structuredClone(value), etag: `etag-${blobState.writes}` });
}

function read(name, key) {
  if (blobState.failReads) throw new Error('Storage unavailable');
  const entry = blobData(name).get(key);
  return entry ? structuredClone(entry) : null;
}

function write(name, key, value, options = {}) {
  if (blobState.failWrites || blobState.failWritesFor?.(name, key)) {
    throw new Error('Storage unavailable');
  }
  const data = blobData(name);
  const existing = data.get(key);
  const conditional = Boolean(options.onlyIfNew || options.onlyIfMatch);
  // Only conditional writes can lose a race; an unconditional one always lands.
  if (blobState.conflictWrites && conditional) return { modified: false };
  if (options.onlyIfNew && existing) return { modified: false };
  if (options.onlyIfMatch && options.onlyIfMatch !== existing?.etag) return { modified: false };
  blobState.writes += 1;
  const etag = `etag-${blobState.writes}`;
  data.set(key, { value: structuredClone(value), etag });
  return { modified: true, etag };
}

export function blobStore(name) {
  return {
    async get(key) {
      return read(name, key)?.value ?? null;
    },
    async getWithMetadata(key) {
      const entry = read(name, key);
      return entry ? { data: entry.value, etag: entry.etag } : null;
    },
    async set(key, value, options) {
      return write(name, key, value, options);
    },
    async setJSON(key, value, options) {
      return write(name, key, value, options);
    },
    async list({ prefix = '' } = {}) {
      if (blobState.failReads) throw new Error('Storage unavailable');
      const blobs = [...blobData(name).entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, entry]) => ({ key, etag: entry.etag }));
      return { blobs, directories: [] };
    },
    async delete(key) {
      if (blobState.failWrites) throw new Error('Storage unavailable');
      blobData(name).delete(key);
    },
  };
}

export const blobsModule = {
  connectLambda: vi.fn(),
  getStore: vi.fn((options) => blobStore(typeof options === 'string' ? options : options?.name)),
};
