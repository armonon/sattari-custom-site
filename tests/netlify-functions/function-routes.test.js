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

const functionFiles = readdirSync(functionsDir).filter((file) => file.endsWith('.js'));

// v2 functions that declare their own routes and limits.
const declared = functionFiles
  .filter((file) =>
    /export const config\b/.test(readFileSync(path.join(functionsDir, file), 'utf8'))
  )
  .map((file) => file.replace(/\.js$/, ''));

// Every URL the site and the staff page call, and the function that serves it.
const PUBLIC_ROUTES = {
  '/api/create-checkout-session': 'create-checkout-session',
  '/api/checkout-session-status': 'checkout-session-status',
  '/api/checkout-release': 'checkout-release',
  '/api/stripe-webhook': 'stripe-webhook',
  '/api/inventory': 'inventory',
  '/api/studio-bookings': 'studio-bookings',
  '/api/service-inquiry': 'service-inquiry',
  '/api/site-event': 'site-event',
  '/api/admin/orders': 'admin-orders',
  '/api/staff/login': 'staff-login',
  '/api/staff/logout': 'staff-logout',
  '/api/staff/stock': 'staff-stock',
  '/api/staff/catalog': 'staff-catalog',
  '/api/staff/image': 'staff-image',
  '/api/staff/orders': 'staff-orders',
  '/api/staff/backup': 'staff-backup',
  '/api/staff/bookings': 'staff-bookings',
  '/api/staff/inquiries': 'staff-inquiries',
  '/api/staff/insights': 'staff-insights',
  '/product-images/*': 'product-image',
};

const SCHEDULES = {
  'checkout-maintenance': '*/10 * * * *',
  'nightly-backup': '0 9 * * *',
  'studio-booking-maintenance': '*/5 * * * *',
};

describe('function routes', () => {
  it('has no redirect to a function that does not exist', () => {
    for (const { to } of redirects) {
      const match = /^\/\.netlify\/functions\/([^/]+)$/.exec(to);
      if (match) expect(existsSync(path.join(functionsDir, `${match[1]}.js`)), to).toBe(true);
    }
    expect(toml).not.toContain('now-profile');
  });

  // Lambda-style `handler` functions only get the cached Blobs edge URL, so
  // every strongly consistent read there fails (the booking store refuses to
  // work at all, and shop reads silently go stale).
  it.each(functionFiles.map((file) => file.replace(/\.js$/, '')))(
    '%s is a v2 function',
    async (name) => {
      const source = readFileSync(path.join(functionsDir, `${name}.js`), 'utf8');
      expect(source).not.toMatch(/export (async )?function handler\b/);
      const module = await import(`../../netlify/functions/${name}.js`);
      expect(module.handler).toBeUndefined();
      expect(typeof module.default).toBe('function');
      expect(Boolean(module.config?.path) !== Boolean(module.config?.schedule)).toBe(true);
    }
  );

  it('serves every public URL from a function route, not a redirect', async () => {
    for (const [url, name] of Object.entries(PUBLIC_ROUTES)) {
      const { config } = await import(`../../netlify/functions/${name}.js`);
      expect([config.path].flat(), url).toContain(url);
    }
    // A rewrite to a function with its own path never runs; keeping one only
    // hides where the route really lives.
    expect(redirects.filter(({ to }) => to.startsWith('/.netlify/functions/'))).toEqual([]);
  });

  it('declares schedules in code, where v2 functions read them', async () => {
    for (const [name, schedule] of Object.entries(SCHEDULES)) {
      const { config } = await import(`../../netlify/functions/${name}.js`);
      expect(config).toEqual({ schedule });
    }
    expect(toml).not.toMatch(/^\s*schedule\s*=/m);
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

  // A custom path replaces the default URL. Only the image server leaves it
  // out: its URL carries the image key, which the default one has no room for.
  it.each(declared.filter((name) => !SCHEDULES[name] && name !== 'product-image'))(
    '%s still answers at its function URL',
    async (name) => {
      const { config } = await import(`../../netlify/functions/${name}.js`);
      expect([config.path].flat()).toContain(`/.netlify/functions/${name}`);
    }
  );

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
