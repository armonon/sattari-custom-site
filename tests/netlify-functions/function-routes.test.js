// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);
vi.mock('stripe', () => ({ default: vi.fn() }));
vi.mock('resend', () => ({ Resend: vi.fn() }));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const functionsDir = path.join(root, 'netlify/functions');
const toml = readFileSync(path.join(root, 'netlify.toml'), 'utf8');

const redirects = [
  ...toml.matchAll(/\[\[redirects\]\]\s*\n\s*from = "([^"]+)"\s*\n\s*to = "([^"]+)"/g),
].map(([, from, to]) => ({ from, to }));

// v2 functions that declare their own routes and limits.
const declared = readdirSync(functionsDir)
  .filter((file) => file.endsWith('.js'))
  .filter((file) =>
    /export const config\b/.test(readFileSync(path.join(functionsDir, file), 'utf8'))
  )
  .map((file) => file.replace(/\.js$/, ''));

describe('function routes', () => {
  it('has no redirect to a function that does not exist', () => {
    for (const { to } of redirects) {
      const match = /^\/\.netlify\/functions\/([^/]+)$/.exec(to);
      if (match) expect(existsSync(path.join(functionsDir, `${match[1]}.js`)), to).toBe(true);
    }
    expect(toml).not.toContain('now-profile');
  });

  it('routes the staff sign-out and inquiry endpoints', () => {
    expect(redirects).toEqual(
      expect.arrayContaining([
        { from: '/api/staff/logout', to: '/.netlify/functions/staff-logout' },
        { from: '/api/staff/inquiries', to: '/.netlify/functions/staff-inquiries' },
      ])
    );
  });

  it.each(declared)('%s gives any rate limit a path, and no redirect shadows it', async (name) => {
    const { config } = await import(`../../netlify/functions/${name}.js`);
    const paths = [config.path].flat().filter(Boolean);

    if (config.rateLimit) {
      // Netlify ignores a code-defined rate limit on a function without a path.
      expect(paths.length).toBeGreaterThan(0);
      expect(config.rateLimit.windowSize).toBeLessThanOrEqual(180);
    }
    for (const { from } of redirects) expect(paths).not.toContain(from);
  });

  it.each([
    'admin-orders',
    'instagram-feed',
    'service-inquiry',
    'site-event',
    'staff-login',
    'studio-bookings',
  ])('%s still answers at its function URL', async (name) => {
    const { config } = await import(`../../netlify/functions/${name}.js`);
    expect([config.path].flat()).toContain(`/.netlify/functions/${name}`);
  });

  // Netlify allows 2 code-based rate-limit rules per project on Free/Starter/Personal
  // (5 on Pro). The remaining public endpoints enforce their own limits in code.
  it('stays within the rate-limit rule budget of every Netlify plan', async () => {
    const edgeDir = path.join(root, 'netlify/edge-functions');
    const edgeSources = existsSync(edgeDir)
      ? readdirSync(edgeDir)
          .filter((file) => /\.(m?js|ts)$/.test(file))
          .map((file) => readFileSync(path.join(edgeDir, file), 'utf8'))
      : [];
    const limited = [];
    for (const name of declared) {
      const { config } = await import(`../../netlify/functions/${name}.js`);
      if (config.rateLimit) limited.push(name);
    }
    const edgeRules = edgeSources.filter((source) => /\brateLimit\s*:/.test(source)).length;
    expect(limited.sort()).toEqual(['service-inquiry', 'site-event']);
    expect(limited.length + edgeRules).toBeLessThanOrEqual(2);
  });

  it.each(['service-inquiry', 'site-event'])('%s keeps its per-IP rate limit', async (name) => {
    const { config } = await import(`../../netlify/functions/${name}.js`);
    expect(config.rateLimit).toMatchObject({ aggregateBy: ['ip', 'domain'] });
  });
});
