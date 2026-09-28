// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blobData, blobState, resetBlobs, seedBlob } from './helpers/blobsFake.js';

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);

const {
  pruneLoginRecords,
  recordLoginSuccess,
  reserveLoginAttempt,
  ThrottleUnavailableError,
  THROTTLE_SETTINGS,
} = await import('../../server/loginThrottle.js');

const IP = '203.0.113.9';
const event = { headers: {} };
const { LOCK_AFTER_ATTEMPTS, BASE_LOCK_MS, MAX_LOCK_MS, QUIET_PERIOD_MS, GLOBAL_LIMIT } =
  THROTTLE_SETTINGS;

async function attempts(count, ip = IP, now = 1_000_000) {
  const results = [];
  for (let i = 0; i < count; i += 1) results.push(await reserveLoginAttempt(event, ip, now));
  return results;
}

function ipKeys() {
  return [...blobData('staff-auth').keys()].filter((key) => key.startsWith('login-ip/'));
}

beforeEach(() => {
  resetBlobs();
  process.env.STAFF_SESSION_SECRET = 'secret';
  delete process.env.IP_HASH_SECRET;
});

describe('per-address limit', () => {
  it('allows attempts up to the threshold, then locks', async () => {
    const results = await attempts(LOCK_AFTER_ATTEMPTS + 1);

    expect(results.slice(0, LOCK_AFTER_ATTEMPTS).every((r) => r.allowed)).toBe(true);
    expect(results.at(-1).allowed).toBe(false);
    expect(results.at(-1).retryAfterMs).toBeGreaterThan(0);
    expect(results.at(-1).retryAfterMs).toBeLessThanOrEqual(BASE_LOCK_MS);
  });

  it('escalates the lock as attempts continue after each lock ends', async () => {
    const now = 3_000_000;
    await attempts(LOCK_AFTER_ATTEMPTS, IP, now);
    const first = (await reserveLoginAttempt(event, IP, now)).retryAfterMs;

    const afterLock = now + first + 1;
    expect((await reserveLoginAttempt(event, IP, afterLock)).allowed).toBe(true);
    const second = (await reserveLoginAttempt(event, IP, afterLock)).retryAfterMs;

    expect(second).toBeGreaterThan(first);
  });

  it('caps the lock', async () => {
    let now = 4_000_000;
    for (let i = 0; i < 20; i += 1) {
      const result = await reserveLoginAttempt(event, IP, now);
      expect(result.retryAfterMs || 0).toBeLessThanOrEqual(MAX_LOCK_MS);
      now += result.allowed ? 1 : result.retryAfterMs;
    }
  });

  it('forgets an address after a quiet stretch', async () => {
    const now = 5_000_000;
    await attempts(LOCK_AFTER_ATTEMPTS, IP, now);
    expect((await reserveLoginAttempt(event, IP, now)).allowed).toBe(false);

    expect((await reserveLoginAttempt(event, IP, now + QUIET_PERIOD_MS + 1)).allowed).toBe(true);
  });

  it('tracks addresses under separate keys so one cannot lock out another', async () => {
    await attempts(LOCK_AFTER_ATTEMPTS + 1, '198.51.100.1');

    expect((await reserveLoginAttempt(event, '198.51.100.1', 1_000_000)).allowed).toBe(false);
    expect((await reserveLoginAttempt(event, '198.51.100.2', 1_000_000)).allowed).toBe(true);
    expect(ipKeys()).toHaveLength(2);
  });

  it('stores keyed hashes, never raw addresses', async () => {
    await attempts(1);
    const [key] = ipKeys();
    expect(key).not.toContain(IP);
    expect(JSON.stringify([...blobData('staff-auth').values()])).not.toContain(IP);
  });

  it('clears the count after a successful sign-in', async () => {
    const now = 7_000_000;
    await attempts(LOCK_AFTER_ATTEMPTS - 1, IP, now);
    await recordLoginSuccess(event, IP, now);

    const results = await attempts(LOCK_AFTER_ATTEMPTS, IP, now);
    expect(results.every((r) => r.allowed)).toBe(true);
  });
});

describe('racing attempts', () => {
  it('lets at most the threshold through when attempts arrive in parallel', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => reserveLoginAttempt(event, IP, 1_000_000))
    );
    const allowed = results.filter((r) => r.status === 'fulfilled' && r.value.allowed);

    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.length).toBeLessThanOrEqual(LOCK_AFTER_ATTEMPTS);
    // Everything else was refused or failed closed; nothing was let through.
    for (const result of results) {
      if (result.status === 'rejected') {
        expect(result.reason).toBeInstanceOf(ThrottleUnavailableError);
      }
    }
  });

  it('gives the last remaining attempt to exactly one of many racing requests', async () => {
    await attempts(LOCK_AFTER_ATTEMPTS - 1);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => reserveLoginAttempt(event, IP, 1_000_000))
    );

    expect(results.filter((r) => r.status === 'fulfilled' && r.value.allowed)).toHaveLength(1);
  });

  it('fails closed when every write loses its race', async () => {
    blobState.conflictWrites = true;
    await expect(reserveLoginAttempt(event, IP)).rejects.toBeInstanceOf(ThrottleUnavailableError);
  });

  it('fails closed when the store cannot be read or written', async () => {
    blobState.failReads = true;
    await expect(reserveLoginAttempt(event, IP)).rejects.toBeInstanceOf(ThrottleUnavailableError);
    blobState.failReads = false;
    blobState.failWrites = true;
    await expect(reserveLoginAttempt(event, IP)).rejects.toBeInstanceOf(ThrottleUnavailableError);
  });
});

describe('global ceiling', () => {
  it('bounds attempts spread across many addresses', async () => {
    const now = 9_000_000;
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      expect((await reserveLoginAttempt(event, `10.0.0.${i}`, now)).allowed).toBe(true);
    }

    const refused = await reserveLoginAttempt(event, '10.0.1.1', now);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBeGreaterThan(0);
    // A refused address is not even given a record.
    expect(ipKeys()).toHaveLength(GLOBAL_LIMIT);
  });

  it('still admits an address that signed in successfully recently', async () => {
    const now = 9_000_000;
    await recordLoginSuccess(event, IP, now - 1000);
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) await reserveLoginAttempt(event, `10.0.0.${i}`, now);

    expect((await reserveLoginAttempt(event, '10.0.1.1', now)).allowed).toBe(false);
    expect((await reserveLoginAttempt(event, IP, now)).allowed).toBe(true);
  });
});

describe('cleanup', () => {
  it('removes quiet records but keeps active and trusted ones', async () => {
    const now = 20_000_000;
    await reserveLoginAttempt(event, '192.0.2.1', now - QUIET_PERIOD_MS - 1);
    await reserveLoginAttempt(event, '192.0.2.2', now);
    await recordLoginSuccess(event, '192.0.2.3', now - QUIET_PERIOD_MS - 1);
    seedBlob('staff-auth', 'login-ip/garbage', 'not a record');

    expect(await pruneLoginRecords(event, now)).toBe(2);
    expect(ipKeys()).toHaveLength(2);
  });
});

describe('trusted devices', () => {
  const DEVICE = 'device-id-from-a-signed-token';

  async function exhaustGlobal(now) {
    for (let i = 0; i < GLOBAL_LIMIT; i += 1) {
      await reserveLoginAttempt(event, `10.1.0.${i}`, now);
    }
    expect((await reserveLoginAttempt(event, '10.1.1.1', now)).allowed).toBe(false);
  }

  it('lets a known device sign in from a new address while the site-wide limit is spent', async () => {
    const now = 30_000_000;
    await exhaustGlobal(now);

    expect((await reserveLoginAttempt(event, '192.0.2.77', now, { device: DEVICE })).allowed).toBe(
      true
    );
  });

  it('gives a device its own attempt limit, which a stolen token cannot escape', async () => {
    const now = 31_000_000;
    for (let i = 0; i < LOCK_AFTER_ATTEMPTS; i += 1) {
      // A different address every time: the limit follows the device.
      const result = await reserveLoginAttempt(event, `10.2.0.${i}`, now, { device: DEVICE });
      expect(result.allowed).toBe(true);
    }
    const locked = await reserveLoginAttempt(event, '10.2.1.1', now, { device: DEVICE });
    expect(locked.allowed).toBe(false);
    expect(locked.retryAfterMs).toBeGreaterThan(0);

    await recordLoginSuccess(event, '10.2.1.1', now + locked.retryAfterMs, { device: DEVICE });
    expect(
      (await reserveLoginAttempt(event, '10.2.1.2', now + locked.retryAfterMs, { device: DEVICE }))
        .allowed
    ).toBe(true);
    const keys = [...blobData('staff-auth').keys()].filter((key) => key.startsWith('login-dev/'));
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain(DEVICE);
  });

  it('logs once when the site-wide limit trips', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await exhaustGlobal(32_000_000);
    await reserveLoginAttempt(event, '10.1.1.2', 32_000_000);

    const trips = spy.mock.calls.filter(([line]) => line.includes('staff-login-global-limit'));
    expect(trips).toHaveLength(1);
    spy.mockRestore();
  });
});
