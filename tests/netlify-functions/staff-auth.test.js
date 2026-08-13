import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';

vi.mock('@netlify/blobs', () => ({
  connectLambda: vi.fn(),
  getStore: vi.fn(() => ({})),
}));

const {
  checkPassword,
  createSession,
  getBearerToken,
  getClientIp,
  hashPassword,
  isConfigured,
  requireStaff,
  signSession,
  verifySession,
} = await import('../../server/staffAuth.js');

const PASSWORD = 'correct-horse-battery';
const SALT = 'a1b2c3d4';

beforeEach(() => {
  process.env.STAFF_PASSWORD_SALT = SALT;
  process.env.STAFF_PASSWORD_HASH = hashPassword(PASSWORD, SALT);
  process.env.STAFF_SESSION_SECRET = 'test-secret-key';
});

afterEach(() => {
  delete process.env.STAFF_PASSWORD_SALT;
  delete process.env.STAFF_PASSWORD_HASH;
  delete process.env.STAFF_SESSION_SECRET;
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
    const forged = Buffer.from(JSON.stringify({ staff: 'Attacker', exp: Date.now() + 10000 }))
      .toString('base64url');

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

  it('authenticates a request carrying a valid session', () => {
    const token = createSession('Armon');
    expect(requireStaff({ headers: { authorization: `Bearer ${token}` } })).toMatchObject({
      staff: 'Armon',
    });
    expect(requireStaff({ headers: {} })).toBeNull();
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
