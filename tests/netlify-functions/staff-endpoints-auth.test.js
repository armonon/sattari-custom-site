// @vitest-environment node
import crypto from 'node:crypto';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetBlobs } from './helpers/blobsFake.js';

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return { checkout: { sessions: {} }, webhooks: {} };
  }),
}));
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: vi.fn() } };
  }),
}));

const { createSession, revokeAllSessions, revokeSession, signSession, verifySession } =
  await import('../../server/staffAuth.js');

// Every staff function except sign-in itself, read from disk so that a new
// one is covered the moment it exists. admin-orders takes a staff session too.
const functionsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../netlify/functions'
);
const ENDPOINTS = readdirSync(functionsDir)
  .filter((file) => /^staff-.+\.js$/.test(file) && file !== 'staff-login.js')
  .map((file) => file.replace(/\.js$/, ''))
  .concat('admin-orders')
  .sort();

async function call(name, method, token) {
  const mod = await import(`../../netlify/functions/${name}.js`);
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  const body = method === 'POST' ? '{}' : undefined;
  const response = await mod.default(
    new Request(`https://sattarimusic.com/.netlify/functions/${name}`, { method, headers, body }),
    { ip: '127.0.0.1' }
  );
  return response.status;
}

function forgedWithSecret(secret, payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function claims(overrides = {}) {
  return {
    staff: 'Armon',
    sid: crypto.randomBytes(16).toString('base64url'),
    epoch: 0,
    iat: Date.now(),
    exp: Date.now() + 3600_000,
    ...overrides,
  };
}

beforeEach(() => {
  resetBlobs();
  process.env.STAFF_USERNAME = 'sattaristudio';
  process.env.STAFF_PASSWORD_SALT = 'salt';
  process.env.STAFF_PASSWORD_HASH = 'hash';
  process.env.STAFF_SESSION_SECRET = 'secret';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('every staff endpoint requires a live staff session', () => {
  it('finds the endpoints it is meant to guard', () => {
    expect(ENDPOINTS).toEqual(
      expect.arrayContaining([
        'admin-orders',
        'staff-backup',
        'staff-bookings',
        'staff-catalog',
        'staff-image',
        'staff-inquiries',
        'staff-insights',
        'staff-logout',
        'staff-orders',
        'staff-stock',
      ])
    );
  });

  describe.each(ENDPOINTS)('%s', (name) => {
    it.each(['GET', 'POST'])('refuses %s without a token', async (method) => {
      expect(await call(name, method, null)).toBe(401);
    });

    it.each(['GET', 'POST'])('refuses %s with forged or stale tokens', async (method) => {
      const genuine = createSession('Armon');
      const [, mac] = genuine.split('.');
      const tampered = `${Buffer.from(JSON.stringify(claims({ staff: 'Attacker' }))).toString('base64url')}.${mac}`;

      for (const token of [
        'not.a.token',
        tampered,
        forgedWithSecret('wrong-secret', claims()),
        signSession(claims({ exp: Date.now() - 1000 })),
        // Correctly signed but from before sign-out existed: cannot be revoked.
        signSession({ staff: 'Armon', exp: Date.now() + 3600_000 }),
      ]) {
        expect(await call(name, method, token)).toBe(401);
      }
    });

    it.each(['GET', 'POST'])('refuses %s with a signed-out token', async (method) => {
      const token = createSession('Armon');
      await revokeSession({}, verifySession(token));
      expect(await call(name, method, token)).toBe(401);
    });

    it.each(['GET', 'POST'])(
      'refuses %s with a token from before "sign out everywhere"',
      async (method) => {
        const token = createSession('Armon');
        await revokeAllSessions({});
        expect(await call(name, method, token)).toBe(401);
      }
    );

    it.each(['GET', 'POST'])('accepts %s with a valid token', async (method) => {
      expect(await call(name, method, createSession('Armon'))).not.toBe(401);
    });
  });
});
