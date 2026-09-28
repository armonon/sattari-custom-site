// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWith } from './helpers/invoke.js';
import {
  PLAIN,
  checkoutSession,
  createMailbox,
  lineItem,
  stripeEvent,
  webhookCall,
} from './helpers/checkoutFixtures.js';

const blobs = vi.hoisted(() => ({ current: null }));
const stripe = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  listLineItems: vi.fn(),
  retrieve: vi.fn(),
}));
const mail = vi.hoisted(() => ({ send: vi.fn(), box: null }));

vi.mock('@netlify/blobs', async () => {
  const { createMemoryBlobs } = await import('./helpers/memoryBlobs.js');
  blobs.current = createMemoryBlobs();
  return blobs.current.module;
});

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      webhooks: { constructEvent: (body) => JSON.parse(body) },
      checkout: { sessions: stripe },
    };
  }),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mail.send } };
  }),
}));

const { REBUILD_TIMING, flushSiteRebuild, requestSiteRebuild } =
  await import('../../server/buildHook.js');
const { createSession, hashPassword } = await import('../../server/staffAuth.js');
const { stockKey } = await import('../../src/utils/inventory.js');
const staffCatalog = callWith((await import('../../netlify/functions/staff-catalog.js')).default);
const staffStock = callWith((await import('../../netlify/functions/staff-stock.js')).default);
const createCheckout = callWith(
  (await import('../../netlify/functions/create-checkout-session.js')).default
);
const webhook = callWith((await import('../../netlify/functions/stripe-webhook.js')).default);
const { default: runMaintenance } = await import('../../netlify/functions/checkout-maintenance.js');

const HOOK = 'https://api.netlify.com/build_hooks/test-hook';
const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const MINUTE = 60 * 1000;
const KEY = stockKey(PLAIN);

const hookFetch = vi.fn(async () => new Response('', { status: 200 }));
let token;

function staff(handler, body) {
  return handler({
    httpMethod: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function pending() {
  return blobs.current.read('site-build', 'rebuild');
}

function hookCalls() {
  const target = process.env.BUILD_HOOK_URL || HOOK;
  return hookFetch.mock.calls.filter(([url]) => String(url).startsWith(target));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  blobs.current.reset();
  vi.stubGlobal('fetch', hookFetch);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mail.box = createMailbox();
  mail.send.mockImplementation((...args) => mail.box.send(...args));

  vi.stubEnv('BUILD_HOOK_URL', HOOK);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
  vi.stubEnv('URL', 'https://sattarimusic.com');
  vi.stubEnv('STAFF_PASSWORD_SALT', 'salt');
  vi.stubEnv('STAFF_PASSWORD_HASH', hashPassword('pw', 'salt'));
  vi.stubEnv('STAFF_SESSION_SECRET', 'secret');
  token = createSession('Armon');

  stripe.create.mockResolvedValue({ id: 'cs_test_created_1', url: 'https://checkout.test/p' });
  stripe.list.mockResolvedValue({ data: [], has_more: false });
  stripe.listLineItems.mockResolvedValue({ data: [lineItem()] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('rebuilding the published pages after shop changes', () => {
  it('does nothing at all without BUILD_HOOK_URL', async () => {
    vi.stubEnv('BUILD_HOOK_URL', '');

    expect(await requestSiteRebuild(undefined, 'product edited')).toBe(false);
    expect(await flushSiteRebuild(undefined)).toEqual({ triggered: false });
    expect(blobs.current.keys('site-build')).toEqual([]);
    expect(hookFetch).not.toHaveBeenCalled();
  });

  it('turns a burst of staff edits into one build, once they stop', async () => {
    for (const price of [10, 11, 12]) {
      const response = await staff(staffCatalog, {
        action: 'edit',
        slug: PLAIN,
        changes: { price },
      });
      expect(response.statusCode).toBe(200);
      vi.setSystemTime(Date.now() + MINUTE);
    }
    expect(pending()).toMatchObject({ pending: true, reasons: ['product edited'] });

    // Still inside the quiet period after the last edit.
    await runMaintenance();
    expect(hookCalls()).toHaveLength(0);

    vi.setSystemTime(Date.now() + REBUILD_TIMING.quietMs);
    await runMaintenance();
    await runMaintenance();

    expect(hookCalls()).toHaveLength(1);
    const [url, options] = hookCalls()[0];
    expect(options.method).toBe('POST');
    expect(new URL(url).searchParams.get('trigger_title')).toMatch(/product edited/);
    expect(pending()).toMatchObject({ pending: false });
  });

  it('can rebuild through the qualified GitHub workflow instead of a Netlify hook', async () => {
    vi.stubEnv(
      'BUILD_HOOK_URL',
      'https://api.github.com/repos/owner/site/actions/workflows/build-deploy.yml/dispatches'
    );
    vi.stubEnv('BUILD_HOOK_TOKEN', 'github-token');
    expect(await requestSiteRebuild(undefined, 'product edited')).toBe(true);
    vi.setSystemTime(Date.now() + REBUILD_TIMING.quietMs);
    await runMaintenance();

    expect(hookCalls()).toHaveLength(1);
    const [url, options] = hookCalls()[0];
    expect(String(url)).toBe(
      'https://api.github.com/repos/owner/site/actions/workflows/build-deploy.yml/dispatches'
    );
    expect(options.headers.Authorization).toBe('Bearer github-token');
    expect(JSON.parse(options.body)).toEqual({ ref: 'main' });
  });

  it('keeps the request when a GitHub dispatch has no token', async () => {
    vi.stubEnv(
      'BUILD_HOOK_URL',
      'https://api.github.com/repos/owner/site/actions/workflows/build-deploy.yml/dispatches'
    );
    vi.stubEnv('BUILD_HOOK_TOKEN', '');
    expect(await requestSiteRebuild(undefined, 'product edited')).toBe(true);
    vi.setSystemTime(Date.now() + REBUILD_TIMING.quietMs);
    await runMaintenance();

    expect(hookCalls()).toHaveLength(0);
    expect(pending()).toMatchObject({ pending: true });
  });

  it('asks for a rebuild only when a stock change flips what a page says', async () => {
    await staff(staffStock, { updates: [{ key: KEY, quantity: 5 }] });
    await staff(staffStock, { updates: [{ key: KEY, quantity: 7 }] });
    expect(pending()).toBeNull();

    await staff(staffStock, { updates: [{ key: KEY, quantity: 0 }] });
    expect(pending()).toMatchObject({ pending: true, reasons: ['stock changed'] });
  });

  it('asks for a rebuild when a sale sells the last unit', async () => {
    blobs.current.write('inventory', 'stock', { [KEY]: 1 });
    await createCheckout({
      httpMethod: 'POST',
      headers: { host: 'sattarimusic.com' },
      body: JSON.stringify({ items: [{ slug: PLAIN, quantity: 1 }] }),
    });
    const holdId = stripe.create.mock.calls[0][0].metadata.holdId;

    await webhook(
      webhookCall(stripeEvent('checkout.session.completed', checkoutSession({ holdId })))
    );

    expect(pending()).toMatchObject({ pending: true, reasons: ['a product sold out'] });
  });

  it('builds at most once an hour, and retries a hook that failed', async () => {
    await requestSiteRebuild(undefined, 'product edited');
    vi.setSystemTime(NOW + REBUILD_TIMING.quietMs);
    expect((await flushSiteRebuild(undefined)).triggered).toBe(true);

    await requestSiteRebuild(undefined, 'product added');
    vi.setSystemTime(NOW + 2 * REBUILD_TIMING.quietMs);
    expect((await flushSiteRebuild(undefined)).triggered).toBe(false);

    hookFetch.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    vi.setSystemTime(NOW + REBUILD_TIMING.minIntervalMs + REBUILD_TIMING.quietMs);
    expect(await flushSiteRebuild(undefined)).toMatchObject({ triggered: false, failed: true });
    expect(pending()).toMatchObject({ pending: true, reasons: ['product added'] });

    vi.setSystemTime(NOW + 2 * REBUILD_TIMING.minIntervalMs + REBUILD_TIMING.quietMs);
    expect((await flushSiteRebuild(undefined)).triggered).toBe(true);
    expect(hookCalls()).toHaveLength(3);
  });

  it('never lets a rebuild request fail the save that asked for it', async () => {
    blobs.current.state.fault = ({ store }) =>
      store === 'site-build' ? new Error('blobs down') : null;

    const response = await staff(staffCatalog, {
      action: 'edit',
      slug: PLAIN,
      changes: { price: 15 },
    });

    expect(response.statusCode).toBe(200);
  });
});
