import { describe, expect, it } from 'vitest';
import {
  BACKUP_PREFIX,
  BACKUP_VERSION,
  buildSnapshot,
  describeSnapshot,
  selectExpired,
  snapshotKey,
  validateSnapshot,
} from './backup.js';

const AT = new Date('2026-08-13T09:00:00Z').getTime();

describe('snapshotKey', () => {
  it('produces a sortable key', () => {
    const a = snapshotKey('2026-08-12T09:00:00.000Z');
    const b = snapshotKey('2026-08-13T09:00:00.000Z');
    expect(a < b).toBe(true);
    expect(b.startsWith(BACKUP_PREFIX)).toBe(true);
  });

  it('keeps second precision so two snapshots the same day do not collide', () => {
    // A manual snapshot taken before a restore must not overwrite the night's.
    expect(snapshotKey('2026-08-13T09:00:00.000Z')).not.toBe(
      snapshotKey('2026-08-13T09:05:00.000Z')
    );
  });
});

describe('buildSnapshot', () => {
  it('captures the stores that cannot be recovered elsewhere', () => {
    const snapshot = buildSnapshot({
      stock: { 'a::::': 3 },
      catalog: { overrides: { a: { price: 10 } }, added: [], hidden: ['b'] },
      fulfillment: { cs_1: { status: 'shipped' } },
      imageKeys: ['abc.jpg'],
      at: AT,
    });

    expect(snapshot.version).toBe(BACKUP_VERSION);
    expect(snapshot.createdAt).toBe('2026-08-13T09:00:00.000Z');
    expect(snapshot.stock).toEqual({ 'a::::': 3 });
    expect(snapshot.fulfillment.cs_1.status).toBe('shipped');
    expect(snapshot.imageKeys).toEqual(['abc.jpg']);
  });

  it('does not include orders', () => {
    // Stripe is the system of record for payments; a second copy would only
    // ever be the one that disagrees.
    const snapshot = buildSnapshot({ at: AT });
    expect(snapshot.orders).toBeUndefined();
  });

  it('fills in empty structures rather than undefined', () => {
    const snapshot = buildSnapshot({ at: AT });
    expect(snapshot.stock).toEqual({});
    expect(snapshot.catalog).toEqual({ overrides: {}, added: [], hidden: [] });
    expect(snapshot.imageKeys).toEqual([]);
  });
});

describe('validateSnapshot', () => {
  const good = buildSnapshot({ stock: {}, catalog: {}, at: AT });

  it('accepts a well-formed snapshot', () => {
    expect(validateSnapshot(good).ok).toBe(true);
  });

  it('refuses a snapshot from a different version', () => {
    expect(validateSnapshot({ ...good, version: 99 }).ok).toBe(false);
  });

  it('refuses junk rather than writing it over live data', () => {
    expect(validateSnapshot(null).ok).toBe(false);
    expect(validateSnapshot('a string').ok).toBe(false);
    expect(validateSnapshot([]).ok).toBe(false);
    expect(validateSnapshot({ ...good, stock: null }).ok).toBe(false);
    expect(validateSnapshot({ ...good, catalog: 'nope' }).ok).toBe(false);
  });

  it('explains why it refused', () => {
    expect(validateSnapshot({ ...good, version: 99 }).error).toContain('version');
  });
});

describe('selectExpired', () => {
  const keys = Array.from({ length: 35 }, (_, i) =>
    snapshotKey(`2026-07-${String(i + 1).padStart(2, '0')}T09:00:00.000Z`)
  );

  it('keeps the newest N and returns the rest', () => {
    const expired = selectExpired(keys, 30);
    expect(expired).toHaveLength(5);
    // Oldest are the ones dropped.
    expect(expired).toContain(snapshotKey('2026-07-01T09:00:00.000Z'));
    expect(expired).not.toContain(snapshotKey('2026-07-35T09:00:00.000Z'));
  });

  it('returns nothing when under the limit', () => {
    expect(selectExpired(keys.slice(0, 10), 30)).toEqual([]);
  });

  it('ignores keys that are not snapshots', () => {
    expect(selectExpired(['some-other-blob', ...keys.slice(0, 3)], 1)).toHaveLength(2);
  });
});

describe('describeSnapshot', () => {
  it('summarises what is inside without dumping it', () => {
    const summary = describeSnapshot(
      buildSnapshot({
        stock: { a: 1, b: 2 },
        catalog: { overrides: { x: {} }, added: [{ slug: 'y' }], hidden: ['z'] },
        fulfillment: { cs_1: {} },
        imageKeys: ['i.jpg'],
        at: AT,
      })
    );

    expect(summary).toMatchObject({
      trackedVariants: 2,
      editedProducts: 1,
      addedProducts: 1,
      hiddenProducts: 1,
      fulfilledOrders: 1,
      images: 1,
    });
  });

  it('does not throw on an empty snapshot', () => {
    expect(describeSnapshot({}).trackedVariants).toBe(0);
    expect(describeSnapshot(undefined).images).toBe(0);
  });
});
