// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blobState, resetBlobs } from './helpers/blobsFake.js';

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);
// Wrapped so the tests can count how many attempts reach password verification.
vi.mock('../../server/staffAuth.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, checkPassword: vi.fn(actual.checkPassword) };
});

const { default: login, config } = await import('../../netlify/functions/staff-login.js');
const { checkPassword, hashPassword, requireStaff, revokeAllSessions } =
  await import('../../server/staffAuth.js');
const { THROTTLE_SETTINGS } = await import('../../server/loginThrottle.js');

const PASSWORD = 'correct-horse-battery';

function attempt(body, ip = '203.0.113.5', init = {}) {
  return login(
    new Request('https://sattarimusic.com/api/staff/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...init,
    }),
    { ip, waitUntil: vi.fn() }
  );
}

const wrong = (ip) => attempt({ staff: 'sattaristudio', password: 'guess' }, ip);
const right = (ip) => attempt({ staff: 'SattariStudio', password: PASSWORD }, ip);

beforeEach(() => {
  resetBlobs();
  vi.clearAllMocks();
  process.env.STAFF_USERNAME = 'sattaristudio';
  process.env.STAFF_PASSWORD_SALT = 'salt';
  process.env.STAFF_PASSWORD_HASH = hashPassword(PASSWORD, 'salt');
  process.env.STAFF_SESSION_SECRET = 'secret';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('staff-login routing', () => {
  it('answers on both public URLs', () => {
    expect(config.path).toEqual(['/api/staff/login', '/.netlify/functions/staff-login']);
  });

  it('accepts only POST', async () => {
    const response = await login(new Request('https://sattarimusic.com/api/staff/login'), {});
    expect(response.status).toBe(405);
  });
});

describe('signing in', () => {
  it('issues a session token that the staff functions accept', async () => {
    const response = await right();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ staff: 'SattariStudio', expiresInHours: 12 });
    await expect(
      requireStaff({ headers: { authorization: `Bearer ${body.token}` } })
    ).resolves.toMatchObject({ staff: 'SattariStudio' });
  });

  it('issues tokens that survive an earlier "sign out everywhere"', async () => {
    await revokeAllSessions({});
    const { token } = await (await right()).json();
    await expect(
      requireStaff({ headers: { authorization: `Bearer ${token}` } })
    ).resolves.toBeTruthy();
  });

  it('rejects a wrong password without saying which part was wrong', async () => {
    const response = await wrong();
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('That username or password is not right.');
  });

  it('validates the request before counting it', async () => {
    expect((await attempt('{')).status).toBe(400);
    expect((await attempt({ password: 'x' })).status).toBe(400);
    expect(checkPassword).not.toHaveBeenCalled();
  });

  it('does not reveal which settings are missing', async () => {
    delete process.env.STAFF_PASSWORD_HASH;
    const response = await right();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toMatch(/STAFF_/);
  });
});

describe('guess limiting', () => {
  it('locks an address after the threshold and says when to retry', async () => {
    for (let i = 0; i < THROTTLE_SETTINGS.LOCK_AFTER_ATTEMPTS; i += 1) {
      expect((await wrong()).status).toBe(401);
    }
    const locked = await wrong();

    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(checkPassword).toHaveBeenCalledTimes(THROTTLE_SETTINGS.LOCK_AFTER_ATTEMPTS);
    // A different address is unaffected.
    expect((await right('198.51.100.20')).status).toBe(200);
  });

  it('lets at most the threshold of parallel guesses reach password verification', async () => {
    const responses = await Promise.all(Array.from({ length: 25 }, () => wrong()));

    expect(checkPassword.mock.calls.length).toBeLessThanOrEqual(
      THROTTLE_SETTINGS.LOCK_AFTER_ATTEMPTS
    );
    for (const response of responses) expect([401, 429, 503]).toContain(response.status);
    // And the lock holds afterwards, even for the right password.
    expect((await right()).status).toBe(429);
  });

  it('refuses rather than verifies when attempts cannot be counted', async () => {
    blobState.conflictWrites = true;
    const conflicted = await right();
    blobState.conflictWrites = false;
    blobState.failReads = true;
    const unreadable = await right();

    expect(conflicted.status).toBe(503);
    expect(unreadable.status).toBe(503);
    expect(checkPassword).not.toHaveBeenCalled();
  });

  it('resets the count after a successful sign-in', async () => {
    for (let i = 0; i < THROTTLE_SETTINGS.LOCK_AFTER_ATTEMPTS - 1; i += 1) await wrong();
    expect((await right()).status).toBe(200);

    for (let i = 0; i < THROTTLE_SETTINGS.LOCK_AFTER_ATTEMPTS; i += 1) {
      expect((await wrong()).status).toBe(401);
    }
  });
});
