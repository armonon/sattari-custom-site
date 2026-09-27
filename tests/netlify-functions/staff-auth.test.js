// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { blobState, resetBlobs } from './helpers/blobsFake.js';

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);

const {
  checkPassword,
  checkUsername,
  createSession,
  currentSessionEpoch,
  getBearerToken,
  getClientIp,
  hashPassword,
  isConfigured,
  requireStaff,
  revokeAllSessions,
  revokeSession,
  signSession,
  verifySession,
} = await import('../../server/staffAuth.js');

const PASSWORD = 'correct-horse-battery';
const SALT = 'a1b2c3d4';

function request(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

beforeEach(() => {
  resetBlobs();
  process.env.STAFF_USERNAME = 'sattaristudio';
  process.env.STAFF_PASSWORD_SALT = SALT;
  process.env.STAFF_PASSWORD_HASH = hashPassword(PASSWORD, SALT);
  process.env.STAFF_SESSION_SECRET = 'test-secret-key';
});

afterEach(() => {
  delete process.env.STAFF_USERNAME;
  delete process.env.STAFF_PASSWORD_SALT;
  delete process.env.STAFF_PASSWORD_HASH;
  delete process.env.STAFF_SESSION_SECRET;
});

describe('username checking', () => {
  it('accepts the configured username', () => {
    expect(checkUsername('sattaristudio')).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(checkUsername('  SattariStudio ')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(checkUsername('admin')).toBe(false);
    expect(checkUsername('sattaristudi')).toBe(false);
    expect(checkUsername('')).toBe(false);
    expect(checkUsername(undefined)).toBe(false);
  });

  it('refuses when no username is configured', () => {
    delete process.env.STAFF_USERNAME;
    expect(checkUsername('sattaristudio')).toBe(false);
    expect(isConfigured()).toBe(false);
  });
});

describe('password checking', () => {
  it('accepts the correct password', () => {
    expect(checkPassword(PASSWORD)).toBe(true);
  });

  it('rejects a wrong password', () => {
    expect(checkPassword('nope')).toBe(false);
    expect(checkPassword('')).toBe(false);
    expect(checkPassword(undefined)).toBe(false);
  });

  it('refuses everything when not configured', () => {
    delete process.env.STAFF_PASSWORD_HASH;
    expect(isConfigured()).toBe(false);
    expect(checkPassword(PASSWORD)).toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips a signed session', () => {
    const token = createSession('Armon');
    expect(verifySession(token)).toMatchObject({ staff: 'Armon' });
  });

  it('rejects a tampered payload', () => {
    const token = createSession('Armon');
    const [, mac] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ staff: 'Attacker', exp: Date.now() + 10000 })
    ).toString('base64url');

    expect(verifySession(`${forged}.${mac}`)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createSession('Armon');
    process.env.STAFF_SESSION_SECRET = 'a-different-secret';
    expect(verifySession(token)).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = signSession({ staff: 'Armon', exp: Date.now() - 1000 });
    expect(verifySession(expired)).toBeNull();
  });

  it('rejects a token with no expiry rather than treating it as eternal', () => {
    const noExpiry = signSession({ staff: 'Armon' });
    expect(verifySession(noExpiry)).toBeNull();
  });

  it('rejects malformed input without throwing', () => {
    expect(verifySession('')).toBeNull();
    expect(verifySession('garbage')).toBeNull();
    expect(verifySession('a.b.c')).toBeNull();
    expect(verifySession(null)).toBeNull();
  });

  it('rejects a random token of the right shape', () => {
    const body = Buffer.from(JSON.stringify({ staff: 'x', exp: Date.now() + 1000 })).toString(
      'base64url'
    );
    const randomMac = crypto.randomBytes(32).toString('base64url');
    expect(verifySession(`${body}.${randomMac}`)).toBeNull();
  });
});

describe('request helpers', () => {
  it('pulls a bearer token out of the Authorization header', () => {
    expect(getBearerToken({ authorization: 'Bearer abc' })).toBe('abc');
    expect(getBearerToken({ Authorization: 'Bearer abc' })).toBe('abc');
    expect(getBearerToken({ authorization: 'abc' })).toBe('');
    expect(getBearerToken({})).toBe('');
  });

  it('authenticates a request carrying a valid session', async () => {
    const token = createSession('Armon');
    await expect(requireStaff(request(token))).resolves.toMatchObject({ staff: 'Armon' });
    await expect(requireStaff({ headers: {} })).resolves.toBeNull();
  });

  it('reads the client IP from the header Netlify sets at the edge', () => {
    // x-forwarded-for is caller-controllable; throttling on it would let an
    // attacker reset their own counter every request.
    expect(getClientIp({ headers: { 'x-nf-client-connection-ip': '203.0.113.7' } })).toBe(
      '203.0.113.7'
    );
    expect(getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4' } })).toBe('unknown');
  });
});

describe('server-side sign-out', () => {
  it('stops a revoked sign-in from working while others stay valid', async () => {
    const counter = createSession('Armon');
    const phone = createSession('Armon');

    await revokeSession({}, verifySession(counter));

    await expect(requireStaff(request(counter))).resolves.toBeNull();
    await expect(requireStaff(request(phone))).resolves.toMatchObject({ staff: 'Armon' });
  });

  it('signs out every device at once, and new sign-ins carry the new epoch', async () => {
    const before = createSession('Armon');
    await revokeAllSessions({});

    await expect(requireStaff(request(before))).resolves.toBeNull();
    const epoch = await currentSessionEpoch({});
    expect(epoch).toBe(1);
    await expect(requireStaff(request(createSession('Armon', { epoch })))).resolves.toMatchObject({
      staff: 'Armon',
    });
  });

  it('drops expired revocations so the record stays small', async () => {
    const old = verifySession(createSession('Armon'));
    await revokeSession({}, old);
    await revokeSession({}, verifySession(createSession('Armon')), old.exp + 1);

    const state = [...blobState.stores.get('staff-auth').values()][0].value;
    expect(Object.keys(state.revoked)).toHaveLength(1);
    expect(state.revoked[old.sid]).toBeUndefined();
  });

  it('rejects correctly signed tokens from before revocation existed', async () => {
    // No sid means it can never be revoked on its own, so it is not accepted.
    const legacy = signSession({ staff: 'Armon', exp: Date.now() + 60_000 });
    expect(verifySession(legacy)).toMatchObject({ staff: 'Armon' });
    await expect(requireStaff(request(legacy))).resolves.toBeNull();
  });

  it('fails closed when the sign-out record cannot be read', async () => {
    const token = createSession('Armon');
    blobState.failReads = true;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(requireStaff(request(token))).resolves.toBeNull();
    spy.mockRestore();
  });

  it('refuses to revoke when the record cannot be written', async () => {
    blobState.conflictWrites = true;
    await expect(revokeAllSessions({})).rejects.toThrow();
  });
});
