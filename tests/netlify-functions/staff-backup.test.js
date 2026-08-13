import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-ins for each blob store.
const data = {};

function store(name) {
  data[name] = data[name] || {};
  return {
    async get(key) {
      const v = data[name][key];
      return v === undefined ? null : JSON.parse(JSON.stringify(v));
    },
    async getWithMetadata(key) {
      const v = data[name][key];
      if (v === undefined) return null;
      return { data: JSON.parse(JSON.stringify(v)), etag: 'etag' };
    },
    async set(key, value) {
      data[name][key] = value;
      return { modified: true };
    },
    async setJSON(key, value) {
      data[name][key] = JSON.parse(JSON.stringify(value));
      return { modified: true, etag: 'etag' };
    },
    async list() {
      return { blobs: Object.keys(data[name]).map((key) => ({ key })) };
    },
    async delete(key) {
      delete data[name][key];
    },
  };
}

vi.mock('@netlify/blobs', () => ({
  connectLambda: vi.fn(),
  getStore: vi.fn((options) => store(typeof options === 'string' ? options : options?.name)),
}));

const { hashPassword, createSession } = await import('../../server/staffAuth.js');
const { handler } = await import('../../netlify/functions/staff-backup.js');
const { BACKUP_PREFIX } = await import('../../src/utils/backup.js');

let token;

function call(method, opts = {}) {
  return handler({
    httpMethod: method,
    headers: opts.anon ? {} : { authorization: `Bearer ${token}` },
    body: opts.body ? JSON.stringify(opts.body) : '',
    queryStringParameters: opts.query || {},
  });
}

beforeEach(() => {
  for (const key of Object.keys(data)) delete data[key];
  data.inventory = { stock: { 'cymbal::::': 5 } };
  data.catalog = { overrides: { overrides: { a: { price: 10 } }, added: [], hidden: [] } };
  data.fulfillment = { status: { cs_1: { status: 'packed', history: [] } } };
  data['catalog-images'] = { 'abc.jpg': 'bytes' };
  data.backups = {};

  process.env.STAFF_PASSWORD_SALT = 'salt';
  process.env.STAFF_PASSWORD_HASH = hashPassword('pw', 'salt');
  process.env.STAFF_SESSION_SECRET = 'secret';
  token = createSession('Armon');
});

describe('access', () => {
  it('refuses everything without a session', async () => {
    expect((await call('GET', { anon: true })).statusCode).toBe(401);
    expect((await call('POST', { anon: true, body: { action: 'snapshot' } })).statusCode).toBe(401);
    expect(Object.keys(data.backups)).toHaveLength(0);
  });
});

describe('taking a snapshot', () => {
  it('captures current state', async () => {
    const response = await call('POST', { body: { action: 'snapshot' } });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.summary.trackedVariants).toBe(1);
    expect(Object.keys(data.backups)).toHaveLength(1);
  });

  it('records who took it', async () => {
    await call('POST', { body: { action: 'snapshot' } });
    const snapshot = Object.values(data.backups)[0];
    expect(snapshot.reason).toContain('Armon');
  });
});

describe('downloading', () => {
  it('returns a file, not a JSON envelope', async () => {
    const response = await call('GET', { query: { action: 'download' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Disposition']).toMatch(/attachment; filename=/);
    const parsed = JSON.parse(response.body);
    expect(parsed.stock).toEqual({ 'cymbal::::': 5 });
  });

  it('downloads live state even with no stored snapshots', async () => {
    // This is the copy that survives losing the Netlify account.
    expect(Object.keys(data.backups)).toHaveLength(0);
    const response = await call('GET', { query: { action: 'download' } });
    expect(response.statusCode).toBe(200);
  });
});

describe('restoring', () => {
  async function takeSnapshotThenChangeStock() {
    await call('POST', { body: { action: 'snapshot' } });
    const key = Object.keys(data.backups)[0];
    data.inventory.stock = { 'cymbal::::': 0 };
    return key;
  }

  it('refuses without the typed confirmation', async () => {
    const key = await takeSnapshotThenChangeStock();
    const response = await call('POST', { body: { action: 'restore', key } });

    expect(response.statusCode).toBe(400);
    // Nothing changed.
    expect(data.inventory.stock).toEqual({ 'cymbal::::': 0 });
  });

  it('restores the snapshot when confirmed', async () => {
    const key = await takeSnapshotThenChangeStock();
    const response = await call('POST', {
      body: { action: 'restore', key, confirm: 'RESTORE' },
    });

    expect(response.statusCode).toBe(200);
    expect(data.inventory.stock).toEqual({ 'cymbal::::': 5 });
  });

  it('takes a safety snapshot of the pre-restore state', async () => {
    // A restore you cannot walk back is not a safety net. Restoring the wrong
    // backup must itself be undoable.
    const key = await takeSnapshotThenChangeStock();
    const response = await call('POST', {
      body: { action: 'restore', key, confirm: 'RESTORE' },
    });
    const body = JSON.parse(response.body);

    expect(body.safetyKey).toBeTruthy();
    const safety = data.backups[body.safetyKey];
    // The safety copy holds what was live immediately before the restore.
    expect(safety.stock).toEqual({ 'cymbal::::': 0 });
    expect(safety.reason).toContain('before restore');
  });

  it('refuses a snapshot from an unknown version', async () => {
    const key = `${BACKUP_PREFIX}bad.json`;
    data.backups[key] = { version: 99, stock: {}, catalog: {} };

    const response = await call('POST', {
      body: { action: 'restore', key, confirm: 'RESTORE' },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error).toContain('version');
  });

  it('404s for a backup that no longer exists', async () => {
    const response = await call('POST', {
      body: { action: 'restore', key: `${BACKUP_PREFIX}gone.json`, confirm: 'RESTORE' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects an unknown action', async () => {
    expect((await call('POST', { body: { action: 'drop' } })).statusCode).toBe(400);
  });
});

describe('listing', () => {
  it('summarises stored snapshots', async () => {
    await call('POST', { body: { action: 'snapshot' } });
    const body = JSON.parse((await call('GET')).body);

    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshots[0]).toMatchObject({ trackedVariants: 1, fulfilledOrders: 1 });
  });
});
