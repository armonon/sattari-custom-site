// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The staff page is a standalone file in public/, so it is loaded here as the
// browser would: its markup, then its inline script, against a mocked API.

const html = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/staff-cc6436694e.html'),
  'utf8'
);
const body = /<body>([\s\S]*)<\/body>/.exec(html)[1].replace(/<script>[\s\S]*<\/script>/, '');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];

const fetchMock = vi.fn();

function reply(status, payload) {
  return Promise.resolve(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function route(handlers) {
  fetchMock.mockImplementation((url, options = {}) => {
    const handler = handlers[`${options.method || 'GET'} ${String(url).split('?')[0]}`];
    return handler ? handler(options, String(url)) : reply(404, { error: 'Not found.' });
  });
}

function loadPage() {
  document.body.innerHTML = body;
  new Function(script)();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function signIn(password = 'pw') {
  document.getElementById('staff').value = 'sattaristudio';
  document.getElementById('password').value = password;
  document.getElementById('login-form').dispatchEvent(new Event('submit', { cancelable: true }));
  for (let i = 0; i < 5; i += 1) await settle();
}

const text = (id) => document.getElementById(id).textContent;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('confirm', () => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('staff page sign-in', () => {
  it('says the password was wrong, not that a session expired', async () => {
    route({
      'POST /api/staff/login': () =>
        reply(401, { error: 'That username or password is not right.' }),
    });
    loadPage();

    await signIn('wrong');

    expect(text('login-msg')).toBe('That username or password is not right.');
    expect(text('login-msg')).not.toMatch(/expired/);
    expect(document.getElementById('global-error').classList.contains('hidden')).toBe(true);
  });

  it('keeps the device token and sends it with the next sign-in', async () => {
    const logins = [];
    route({
      'POST /api/staff/login': (options) => {
        logins.push(JSON.parse(options.body));
        return reply(200, {
          token: 'session-token',
          staff: 'sattaristudio',
          deviceToken: 'dev1.x.y',
        });
      },
      'GET /api/staff/stock': () => reply(200, { staff: 'sattaristudio', items: [] }),
    });
    loadPage();

    await signIn();
    expect(localStorage.getItem('sattari_staff_device')).toBe('dev1.x.y');
    expect(logins[0].device).toBeUndefined();

    await signIn();
    expect(logins[1].device).toBe('dev1.x.y');
  });
});

describe('staff page sign-out', () => {
  async function signedIn(logout) {
    route({
      'POST /api/staff/login': () =>
        reply(200, { token: 'session-token', staff: 'sattaristudio', deviceToken: 'dev1.x.y' }),
      'GET /api/staff/stock': () => reply(200, { staff: 'sattaristudio', items: [] }),
      'POST /api/staff/logout': logout,
    });
    loadPage();
    await signIn();
  }

  it('does not claim other devices were signed out when this sign-in had already ended', async () => {
    await signedIn(() => reply(401, { error: 'Sign in to continue.' }));

    document.getElementById('signout-all-btn').click();
    for (let i = 0; i < 5; i += 1) await settle();

    expect(text('login-msg')).toMatch(/NOT signed out/);
    expect(text('login-msg')).not.toMatch(/Signed out on every device/);
  });

  it('confirms signing out everywhere when the server did it', async () => {
    await signedIn(() => reply(200, { ok: true, everywhere: true }));

    document.getElementById('signout-all-btn').click();
    for (let i = 0; i < 5; i += 1) await settle();

    expect(text('login-msg')).toBe('Signed out on every device.');
    expect(sessionStorage.getItem('sattari_staff_token')).toBeNull();
  });

  it('treats an already-ended sign-in as signed out on this device', async () => {
    await signedIn(() => reply(401, { error: 'Sign in to continue.' }));

    document.getElementById('signout-btn').click();
    for (let i = 0; i < 5; i += 1) await settle();

    expect(text('login-msg')).toBe('Signed out.');
  });
});

describe('staff page panels', () => {
  const signedInRoutes = {
    'POST /api/staff/login': () =>
      reply(200, { token: 'session-token', staff: 'sattaristudio', deviceToken: 'dev1.x.y' }),
    'GET /api/staff/stock': () => reply(200, { staff: 'sattaristudio', items: [] }),
  };

  async function openTab(name) {
    document.getElementById(`tab-${name}`).click();
    for (let i = 0; i < 5; i += 1) await settle();
  }

  it('shows a payment that needs review, with the ways to resolve it', async () => {
    const actions = [];
    route({
      ...signedInRoutes,
      'GET /api/staff/bookings': () =>
        reply(200, {
          setupMissing: [],
          bookings: [
            {
              id: 'studio_00000000-0000-0000-0000-000000000001',
              status: 'needs_review',
              date: '2026-10-10',
              startHour: 18,
              hours: 2,
              amountCents: 5000,
              name: 'Test Musician',
              email: 'musician@example.com',
              purpose: 'Rehearsal',
              paymentReview: {
                reason: 'The amount paid does not match the booking price.',
                amountTotal: 100,
                paymentIntentId: 'pi_test',
              },
              notifications: {},
            },
          ],
        }),
      'POST /api/staff/bookings': (options) => {
        actions.push(JSON.parse(options.body).action);
        return reply(200, { ok: true });
      },
    });
    loadPage();
    await signIn();
    await openTab('bookings');

    const panel = document.getElementById('booking-rows').textContent;
    expect(panel).toContain('Payment needs review');
    expect(panel).toContain('The amount paid does not match the booking price.');
    expect(panel).toContain('pi_test');
    const keep = [...document.querySelectorAll('#booking-rows button')].find((button) =>
      button.textContent.startsWith('Keep booking')
    );
    keep.click();
    for (let i = 0; i < 5; i += 1) await settle();
    expect(actions).toEqual(['confirm']);
  });

  it('flags orders whose stock must be counted by hand, and stuck checkouts', async () => {
    const dismissed = [];
    let stuck = [
      { orderId: 'cs_test_stuck', lastError: 'Stripe is down' },
      { orderId: 'cs_test_other', lastError: 'No such checkout.session' },
    ];
    route({
      ...signedInRoutes,
      'GET /api/staff/orders': () =>
        reply(200, {
          orders: [
            {
              id: 'cs_test_review',
              paymentStatus: 'paid',
              amountTotal: 8795,
              currency: 'usd',
              customerName: 'A Buyer',
              items: [],
              fulfillment: { status: 'new' },
              oversold: [],
              stockState: 'needs_review',
            },
          ],
          stats: { revenueCents: {}, orders: {} },
          openCount: 1,
          total: 1,
          stuck,
          stuckTotal: stuck.length,
        }),
      'POST /api/staff/orders': (options) => {
        const body = JSON.parse(options.body);
        dismissed.push(body);
        stuck = stuck.filter((entry) => entry.orderId !== body.orderId);
        return reply(200, { dismissed: body.orderId });
      },
    });
    loadPage();
    await signIn();
    await openTab('orders');

    expect(text('order-rows')).toContain('Count these items by hand');
    expect(text('order-stuck')).toMatch(/2 paid checkouts could not be finished automatically/);
    expect(text('order-stuck')).toContain('cs_test_stuck: Stripe is down');

    const [stopFirst] = document.querySelectorAll('#order-stuck button');
    stopFirst.click();
    for (let i = 0; i < 5; i += 1) await settle();

    expect(dismissed).toEqual([{ action: 'dismiss-stuck', orderId: 'cs_test_stuck' }]);
    expect(text('order-stuck')).toMatch(/^1 paid checkout could not/);
    expect(text('order-stuck')).not.toContain('cs_test_stuck');
  });

  it('pages through inquiries and filters to the ones that need a reply', async () => {
    const requests = [];
    const inquiry = (n, emailSent) => ({
      id: `inq_179000000${n}000_0000000${n}`,
      name: `Customer ${n}`,
      email: `c${n}@example.com`,
      details: 'Hello',
      emailSent,
      recordedAt: '2026-09-20T10:00:00.000Z',
    });
    route({
      ...signedInRoutes,
      'GET /api/staff/inquiries': (options, url) => {
        const query = new URL(url, 'https://sattarimusic.com').searchParams;
        requests.push(Object.fromEntries(query));
        if (query.get('filter') === 'unsent') {
          return reply(200, { inquiries: [inquiry(1, false)], total: 3, unsentTotal: 1 });
        }
        return query.get('before')
          ? reply(200, { inquiries: [inquiry(1, false)], total: 3, unsentTotal: 1 })
          : reply(200, {
              inquiries: [inquiry(3, true), inquiry(2, true)],
              total: 3,
              unsentTotal: 1,
              nextBefore: inquiry(2, true).id,
            });
      },
    });
    loadPage();
    await signIn();
    await openTab('inquiries');

    expect(text('inquiry-summary')).toMatch(/Showing 2 of 3 · 1 not emailed and not handled/);
    const more = document.getElementById('inquiry-more');
    expect(more.classList.contains('hidden')).toBe(false);
    more.click();
    for (let i = 0; i < 5; i += 1) await settle();
    expect(requests.at(-1)).toMatchObject({ before: inquiry(2, true).id, filter: 'all' });
    expect(document.querySelectorAll('#inquiry-rows article')).toHaveLength(3);
    expect(more.classList.contains('hidden')).toBe(true);

    const filter = document.getElementById('inquiry-filter');
    filter.value = 'unsent';
    filter.dispatchEvent(new Event('change'));
    for (let i = 0; i < 5; i += 1) await settle();
    expect(requests.at(-1)).toMatchObject({ filter: 'unsent' });
    expect(document.querySelectorAll('#inquiry-rows article')).toHaveLength(1);
    expect(text('inquiry-rows')).toContain('Email not sent');
  });
});
