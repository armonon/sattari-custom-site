import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory stand-in for a Netlify Blobs store, including the etag
// behaviour that the conditional writes depend on.
const fake = {
  value: null,
  etag: null,
  writes: 0,
};

vi.mock('@netlify/blobs', () => ({
  connectLambda: vi.fn(),
  getStore: vi.fn(() => ({
    async getWithMetadata() {
      if (fake.value === null) return null;
      return { data: JSON.parse(JSON.stringify(fake.value)), etag: fake.etag };
    },
    async setJSON(key, value, options = {}) {
      fake.writes += 1;

      if (options.onlyIfNew && fake.value !== null) {
        return { modified: false };
      }
      if (options.onlyIfMatch && options.onlyIfMatch !== fake.etag) {
        return { modified: false };
      }

      fake.value = JSON.parse(JSON.stringify(value));
      fake.etag = `etag-${fake.writes}`;
      return { modified: true, etag: fake.etag };
    },
  })),
}));

const { getLockRemaining, recordFailure, clearFailures, THROTTLE_SETTINGS } = await import(
  '../../server/loginThrottle.js'
);

const IP = '203.0.113.9';
const event = { headers: {} };

beforeEach(() => {
  fake.value = null;
  fake.etag = null;
  fake.writes = 0;
});

describe('login throttle', () => {
  it('does not lock before the threshold', async () => {
    const now = 1_000_000;
    for (let i = 0; i < THROTTLE_SETTINGS.LOCK_AFTER_ATTEMPTS - 1; i += 1) {
      await recordFailure(event, IP, now + i);
    }
    expect(await getLockRemaining(event, IP, now + 10)).toBe(0);
  });

  it('locks out after five failures', async () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i += 1) {
      await recordFailure(event, IP, now + i);
    }

    const remaining = await getLockRemaining(event, IP, now + 10);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(THROTTLE_SETTINGS.BASE_LOCK_MS);
  });

  it('actually engages rather than resetting every attempt', async () => {
    // The original in-memory version compared Date.now() against `until`,
    // which is 0 on an unlocked record, so the counter cleared on every call
    // and the throttle never fired. This asserts the counter accumulates.
    const now = 2_000_000;
    for (let i = 0; i < 6; i += 1) {
      await recordFailure(event, IP, now + i * 100);
      // A read between failures must not clear the record.
      await getLockRemaining(event, IP, now + i * 100 + 1);
    }

    expect(await getLockRemaining(event, IP, now + 700)).toBeGreaterThan(0);
  });

  it('escalates the lockout as failures continue', async () => {
    const now = 3_000_000;
    for (let i = 0; i < 5; i += 1) await recordFailure(event, IP, now);
    const first = await getLockRemaining(event, IP, now);

    await recordFailure(event, IP, now);
    const second = await getLockRemaining(event, IP, now);

    expect(second).toBeGreaterThan(first);
  });

  it('caps the lockout', async () => {
    const now = 4_000_000;
    for (let i = 0; i < 20; i += 1) await recordFailure(event, IP, now);
    expect(await getLockRemaining(event, IP, now)).toBeLessThanOrEqual(
      THROTTLE_SETTINGS.MAX_LOCK_MS
    );
  });

  it('forgets a record after a quiet stretch', async () => {
    const now = 5_000_000;
    for (let i = 0; i < 6; i += 1) await recordFailure(event, IP, now);

    const later = now + THROTTLE_SETTINGS.QUIET_PERIOD_MS + 1;
    expect(await getLockRemaining(event, IP, later)).toBe(0);
  });

  it('tracks addresses independently so one attacker cannot lock out the shop', async () => {
    const now = 6_000_000;
    for (let i = 0; i < 6; i += 1) await recordFailure(event, '198.51.100.1', now);

    expect(await getLockRemaining(event, '198.51.100.1', now)).toBeGreaterThan(0);
    expect(await getLockRemaining(event, '198.51.100.2', now)).toBe(0);
  });

  it('clears failures on a successful sign-in', async () => {
    const now = 7_000_000;
    for (let i = 0; i < 6; i += 1) await recordFailure(event, IP, now);
    await clearFailures(event, IP, now);

    expect(await getLockRemaining(event, IP, now)).toBe(0);
  });

  it('prunes stale records instead of growing forever', async () => {
    const now = 8_000_000;
    await recordFailure(event, 'old.address', now);
    await recordFailure(event, IP, now + THROTTLE_SETTINGS.QUIET_PERIOD_MS + 5000);

    expect(Object.keys(fake.value)).toEqual([IP]);
  });
});
