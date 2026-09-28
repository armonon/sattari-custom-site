// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callWith } from './helpers/invoke.js';

// In-memory stand-ins for each blob store. Stores named in `unreadable`
// fail every read, as during a storage outage.
const data = {};
const unreadable = new Set();

function store(name) {
  data[name] = data[name] || {};
  return {
    async get(key) {
      if (unreadable.has(name)) throw new Error(`${name} unavailable`);
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
      if (unreadable.has(name)) throw new Error(`${name} unavailable`);
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
const handler = callWith((await import('../../netlify/functions/staff-backup.js')).default);
const { BACKUP_PREFIX, KEEP_SNAPSHOTS, KEEP_STAFF_SNAPSHOTS, selectExpired, snapshotKey } =
  await import('../../src/utils/backup.js');
const { default: nightlyBackup, config: nightlyConfig } =
  await import('../../netlify/functions/nightly-backup.js');

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
  unreadable.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
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
    expect(response.headers['content-disposition']).toMatch(/attachment; filename=/);
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

describe('when shop data cannot be read', () => {
  it.each(['inventory', 'catalog', 'fulfillment', 'catalog-images'])(
    'takes no snapshot while %s is unreadable, rather than an empty one',
    async (name) => {
      unreadable.add(name);

      const response = await call('POST', { body: { action: 'snapshot' } });

      expect(response.statusCode).toBe(503);
      expect(JSON.parse(response.body).error).toMatch(/no backup was taken/);
      expect(response.body).not.toContain('unavailable');
      expect(Object.keys(data.backups)).toHaveLength(0);
    }
  );

  it('restores nothing when the current state cannot be saved first', async () => {
    await call('POST', { body: { action: 'snapshot' } });
    const [key] = Object.keys(data.backups);
    data.inventory.stock = { 'cymbal::::': 0 };
    unreadable.add('fulfillment');

    const response = await call('POST', { body: { action: 'restore', key, confirm: 'RESTORE' } });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body).error).toMatch(/nothing was restored/);
    expect(data.inventory.stock).toEqual({ 'cymbal::::': 0 });
    expect(Object.keys(data.backups)).toEqual([key]);
  });
});

describe('the nightly backup', () => {
  it('runs as a v2 scheduled function and writes a nightly snapshot', async () => {
    expect(nightlyConfig).toEqual({ schedule: '0 9 * * *' });

    await nightlyBackup(new Request('https://sattarimusic.com/'), {});

    const keys = Object.keys(data.backups);
    expect(keys).toEqual([expect.stringMatching(/^snapshot\/[\d-]+T[\d-]+\.json$/)]);
    expect(data.backups[keys[0]]).toMatchObject({
      kind: 'scheduled',
      stock: { 'cymbal::::': 5 },
      imageKeys: ['abc.jpg'],
    });
  });

  it('fails loudly and writes nothing when a store cannot be read', async () => {
    unreadable.add('catalog');

    await expect(nightlyBackup(new Request('https://sattarimusic.com/'), {})).rejects.toThrow();
    expect(Object.keys(data.backups)).toHaveLength(0);
  });

  it('prunes year-old service inquiries, even on a night the backup fails', async () => {
    const old = 'inq_1600000000000_aaaaaaaa';
    const recent = `inq_${Date.now()}_bbbbbbbb`;
    data['service-inquiries'] = {
      [`inquiries/${old}.json`]: { id: old },
      [`unsent/${old}`]: { id: old },
      [`inquiries/${recent}.json`]: { id: recent },
    };
    unreadable.add('catalog');

    await expect(nightlyBackup(new Request('https://sattarimusic.com/'), {})).rejects.toThrow();

    expect(Object.keys(data['service-inquiries'])).toEqual([`inquiries/${recent}.json`]);
  });

  it('keeps its own history however many snapshots staff take', async () => {
    const day = (n) => `2026-07-${String(n).padStart(2, '0')}T09:00:00.000Z`;
    for (let n = 1; n <= 31; n += 1) data.backups[snapshotKey(day(n))] = { version: 1 };
    for (let n = 1; n <= 25; n += 1) {
      data.backups[snapshotKey(`2026-08-01T10:${String(n).padStart(2, '0')}:00.000Z`, 'manual')] = {
        version: 1,
      };
    }
    data.backups[snapshotKey('2026-07-15T12:00:00.000Z', 'restore')] = { version: 1 };

    await nightlyBackup(new Request('https://sattarimusic.com/'), {});

    const keys = Object.keys(data.backups);
    const nightly = keys.filter((key) => /\d\.json$/.test(key));
    expect(nightly).toHaveLength(KEEP_SNAPSHOTS);
    expect(nightly).not.toContain(snapshotKey(day(1)));
    expect(nightly).not.toContain(snapshotKey(day(2)));
    expect(keys.filter((key) => !/\d\.json$/.test(key))).toHaveLength(KEEP_STAFF_SNAPSHOTS);
  });
});

describe('snapshot retention', () => {
  it('counts staff snapshots separately from nightly ones', () => {
    const nightly = Array.from({ length: 3 }, (_, i) =>
      snapshotKey(`2026-07-0${i + 1}T09:00:00.000Z`)
    );
    const manual = Array.from({ length: 3 }, (_, i) =>
      snapshotKey(`2026-07-0${i + 1}T11:00:00.000Z`, 'manual')
    );
    const restore = snapshotKey('2026-07-04T11:00:00.000Z', 'restore');

    expect(selectExpired([...nightly, ...manual, restore], 2, 3).sort()).toEqual(
      [nightly[0], manual[0]].sort()
    );
    expect(snapshotKey('2026-07-01T09:00:00.000Z')).toBe('snapshot/2026-07-01T09-00-00-000.json');
    expect(restore).toBe('snapshot/2026-07-04T11-00-00-000.restore.json');
  });
});
