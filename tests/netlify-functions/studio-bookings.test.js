// @vitest-environment node
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `value` is the live calendar document; every other key (archived bookings,
// the staff session record) lives in `other` with its own etags.
const memory = vi.hoisted(() => ({
  value: null,
  version: 0,
  readsFail: false,
  other: new Map(),
  otherVersion: 0,
  afterOtherWrite: null,
}));
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  list: vi.fn(),
  send: vi.fn(),
  fetch: vi.fn(),
  webhook: vi.fn(),
}));
vi.mock('@netlify/blobs', () => ({
  connectLambda: vi.fn(),
  getStore: vi.fn(() => ({
    async get(key) {
      if (memory.readsFail) throw new Error('Storage unavailable');
      if (key !== 'calendar-v1') return structuredClone(memory.other.get(key)?.value ?? null);
      return structuredClone(memory.value);
    },
    async getWithMetadata(key) {
      if (memory.readsFail) throw new Error('Storage unavailable');
      if (key !== 'calendar-v1') {
        const entry = memory.other.get(key);
        return entry ? { data: structuredClone(entry.value), etag: entry.etag } : null;
      }
      return memory.value
        ? { data: structuredClone(memory.value), etag: String(memory.version) }
        : null;
    },
    async setJSON(key, value, options = {}) {
      if (key !== 'calendar-v1') {
        const entry = memory.other.get(key);
        if (
          (options.onlyIfNew && entry) ||
          (options.onlyIfMatch && options.onlyIfMatch !== entry?.etag)
        )
          return { modified: false };
        memory.otherVersion += 1;
        memory.other.set(key, { value: structuredClone(value), etag: `o${memory.otherVersion}` });
        memory.afterOtherWrite?.(key);
        return { modified: true };
      }
      if (
        (options.onlyIfNew && memory.value) ||
        (options.onlyIfMatch && options.onlyIfMatch !== String(memory.version))
      )
        return { modified: false };
      memory.value = structuredClone(value);
      memory.version += 1;
      return { modified: true };
    },
  })),
}));
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      checkout: {
        sessions: {
          create: mocks.create,
          retrieve: mocks.retrieve,
          expire: mocks.expire,
          list: mocks.list,
        },
      },
      webhooks: { constructEvent: mocks.webhook },
    };
  }),
}));
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mocks.send } };
  }),
}));

import handler, { config } from '../../netlify/functions/studio-bookings.js';
import { handler as staffHandler } from '../../netlify/functions/staff-bookings.js';
import { handler as webhookHandler } from '../../netlify/functions/stripe-webhook.js';
import { handler as maintenanceHandler } from '../../netlify/functions/studio-booking-maintenance.js';
import { createSession } from '../../server/staffAuth.js';
import {
  applyBookingPayment,
  approveBooking,
  BOOKING_LIMITS,
  cancelUnpaidBooking,
  declineBooking,
  reconcileBooking,
  requestBooking,
  retryBookingNotifications,
} from '../../server/studioBookings.js';
import { ARCHIVE_AFTER_DAYS, archivePastBookings } from '../../server/studioBookingStore.js';
import { bookingPrice, holdsTime, studioTimestamp } from '../../src/utils/studioBooking.js';

const event = { headers: { 'x-nf-client-connection-ip': '127.0.0.1' } };
const publicUrl = 'https://sattarimusic.com/api/studio-bookings';
const getRequest = (query = '') => handler(new Request(`${publicUrl}${query}`), {});
const postRequest = (payload, ip = '127.0.0.1') =>
  handler(
    new Request(publicUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    { ip }
  );
const body = (override = {}) => ({
  requestId: randomUUID(),
  date: '2026-10-10',
  hours: 4,
  startHour: 18,
  name: 'Test Musician',
  email: 'musician@example.com',
  phone: '+15555550111',
  purpose: 'Rehearsal',
  accepted: true,
  ...override,
});
let sessions;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));
  vi.clearAllMocks();
  memory.value = null;
  memory.version = 0;
  memory.readsFail = false;
  memory.other.clear();
  memory.otherVersion = 0;
  memory.afterOtherWrite = null;
  sessions = {};
  for (const [key, value] of Object.entries({
    STUDIO_BOOKING_ENABLED: 'true',
    STUDIO_BOOKING_OPEN_HOUR: '18',
    STUDIO_BOOKING_CLOSE_HOUR: '24',
    STUDIO_BOOKING_DAYS: '0,1,2,3,4,5,6',
    STUDIO_BOOKING_EXTRA_HOURS: '',
    RESEND_API_KEY: 're_test',
    STUDIO_BOOKING_FROM: 'studio@example.com',
    STUDIO_BOOKING_EMAIL: 'owner@example.com',
    STUDIO_BOOKING_SMS_TO: '+15555550123',
    TWILIO_ACCOUNT_SID: 'ACtest',
    TWILIO_AUTH_TOKEN: 'test',
    TWILIO_FROM_NUMBER: '+15555550124',
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STAFF_SESSION_SECRET: 'secret',
    STAFF_USERNAME: 'test',
    STAFF_PASSWORD_HASH: 'hash',
    STAFF_PASSWORD_SALT: 'salt',
  }))
    vi.stubEnv(key, value);
  mocks.send.mockResolvedValue({ data: { id: 'mail_test' } });
  mocks.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ sid: 'SMtest', status: 'queued' }),
  });
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.create.mockImplementation(async (params, options) => {
    if (!sessions[options.idempotencyKey])
      sessions[options.idempotencyKey] = {
        id: `cs_test_${randomUUID().replaceAll('-', '')}`,
        url: 'https://checkout.stripe.com/c/pay/test',
        status: 'open',
        payment_status: 'unpaid',
        amount_total: params.line_items[0].price_data.unit_amount,
        currency: 'usd',
        expires_at: params.expires_at,
        metadata: params.metadata,
      };
    return structuredClone(sessions[options.idempotencyKey]);
  });
  mocks.retrieve.mockImplementation(async (id) =>
    structuredClone(Object.values(sessions).find((s) => s.id === id))
  );
  mocks.expire.mockImplementation(async (id) => {
    const s = Object.values(sessions).find((s) => s.id === id);
    s.status = 'expired';
    return structuredClone(s);
  });
  mocks.list.mockImplementation(async () => ({
    data: structuredClone(Object.values(sessions)),
    has_more: false,
  }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function requested(override) {
  return requestBooking(event, body(override));
}
async function approved(override) {
  const b = await requested(override);
  return approveBooking(event, b.id, 'staff');
}
function paidSession(booking) {
  const s = Object.values(sessions).find((item) => item.id === booking.checkoutSessionId);
  Object.assign(s, { status: 'complete', payment_status: 'paid', payment_intent: 'pi_test' });
  return structuredClone(s);
}

describe('studio booking requests', () => {
  it('stores requests and alerts owner by email and SMS without taking payment', async () => {
    const result = await requested({ amountCents: 1 });
    expect(memory.value[result.id]).toMatchObject({ status: 'requested', amountCents: 6000 });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.send.mock.calls[0][0]).toMatchObject({
      to: ['owner@example.com'],
      replyTo: 'musician@example.com',
    });
    expect(mocks.fetch.mock.calls[0][1].body).toContain('To=%2B15555550123');
    expect(memory.value[result.id].notifications.ownerSms0).toMatchObject({
      state: 'sent',
      providerStatus: 'queued',
    });
  });
  it('deduplicates the same request and rejects changed reuse of its ID', async () => {
    const input = body();
    const first = await requestBooking(event, input);
    const again = await requestBooking(event, input);
    expect(again.id).toBe(first.id);
    expect(Object.keys(memory.value)).toHaveLength(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await expect(requestBooking(event, { ...input, hours: 1 })).rejects.toThrow(
      'already submitted'
    );
  });
  it.each([
    { hours: 0 },
    { hours: 5 },
    { hours: 1.5 },
    { startHour: 22 },
    { date: '2026-02-31' },
    { date: '2026-09-01' },
    { date: '2027-10-01' },
    { startHour: 18.5 },
  ])('rejects invalid times %j', async (override) => {
    await expect(requested(override)).rejects.toThrow();
    expect(memory.value).toBeNull();
  });
  it('rejects consent omissions and invalid contact details', async () => {
    await expect(requested({ accepted: false })).rejects.toThrow('acknowledge');
    await expect(requested({ email: 'invalid' })).rejects.toThrow('email');
  });
  it('requires explicit schedule and both notification providers before opening', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    const response = await getRequest();
    expect(await response.json()).toMatchObject({ enabled: false, reserved: [] });
    await expect(requested()).rejects.toThrow('not available');
    expect(memory.value).toBeNull();
  });
  it('fails closed on unavailable storage', async () => {
    memory.readsFail = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await postRequest(body());
    expect(response.status).toBe(503);
    expect(mocks.send).not.toHaveBeenCalled();
    // The storage error itself is logged, not returned.
    expect(await response.text()).not.toContain('Storage unavailable');
  });
  it('persists provider failures, and retries only failed channels', async () => {
    mocks.send.mockResolvedValueOnce({ error: { message: 'Rejected' } });
    const result = await requested();
    expect(memory.value[result.id].notifications.ownerEmail.state).toBe('failed');
    await retryBookingNotifications(event, result.id);
    expect(memory.value[result.id].notifications.ownerEmail.state).toBe('sent');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not mark rejected SMS accepted', async () => {
    mocks.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Rejected' }) });
    const b = await requested();
    expect(memory.value[b.id].notifications.ownerSms0.state).toBe('failed');
  });
  it('limits repeated submissions per hour', async () => {
    for (let i = 0; i < 5; i++) await requested();
    await expect(requested()).rejects.toMatchObject({ statusCode: 429 });
  });
  it('never returns customer details with public availability', async () => {
    await approved();
    const text = await (await getRequest()).text();
    expect(JSON.parse(text).reserved).toEqual([{ date: '2026-10-10', startHour: 18, hours: 4 }]);
    expect(text).not.toContain('musician@example.com');
    expect(text).not.toContain('checkout.stripe');
  });
});

describe('public booking endpoint', () => {
  it('answers on both public URLs', () => {
    expect(config.path).toEqual(['/api/studio-bookings', '/.netlify/functions/studio-bookings']);
  });
  it('creates a request over HTTP with the documented response shape', async () => {
    const response = await postRequest(body());
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).booking).toMatchObject({
      status: 'requested',
      amountCents: 6000,
    });
  });
  it('rejects malformed and oversized requests', async () => {
    const bad = await handler(new Request(publicUrl, { method: 'POST', body: '{', headers: {} }), {
      ip: '127.0.0.1',
    });
    expect(bad.status).toBe(400);
    expect((await postRequest({ ...body(), notes: 'x'.repeat(12000) })).status).toBe(413);
    expect((await handler(new Request(publicUrl, { method: 'PUT', body: '{}' }), {})).status).toBe(
      405
    );
    expect(memory.value).toBeNull();
  });
  it('does not echo payment-provider errors to the public', async () => {
    const b = await approved();
    mocks.retrieve.mockRejectedValueOnce(
      Object.assign(new Error('No such checkout.session: cs_test_secret'), { statusCode: 404 })
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await getRequest(`?session_id=${b.checkoutSessionId}`);

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('No such checkout');
  });
});

describe('spam resistance', () => {
  it.each(['website', 'bot-field'])(
    'accepts and silently drops a request that fills the %s honeypot',
    async (field) => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const input = body({ [field]: 'https://spam.example' });
      const response = await postRequest(input);

      expect(response.status).toBe(201);
      expect((await response.json()).booking).toEqual({
        id: `studio_${input.requestId}`,
        status: 'requested',
        amountCents: 6000,
      });
      expect(memory.value).toBeNull();
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.fetch).not.toHaveBeenCalled();
    }
  );
  it('caps requests for the whole site when addresses and emails rotate', async () => {
    for (let i = 0; i < BOOKING_LIMITS.siteHourly; i += 1) {
      const response = await postRequest(body({ email: `person${i}@example.com` }), `10.0.0.${i}`);
      expect(response.status).toBe(201);
    }
    const response = await postRequest(body({ email: 'another@example.com' }), '10.0.1.1');

    expect(response.status).toBe(429);
    expect((await response.json()).error).toMatch(/call \(424\) 465-3020/);
    expect(Object.keys(memory.value)).toHaveLength(BOOKING_LIMITS.siteHourly);
  });
  it('caps requests per day as well as per hour', async () => {
    let made = 0;
    for (let hour = 0; made < BOOKING_LIMITS.siteDaily; hour += 1) {
      vi.setSystemTime(new Date(Date.UTC(2026, 9, 1, 12 + hour)));
      for (let i = 0; i < BOOKING_LIMITS.siteHourly && made < BOOKING_LIMITS.siteDaily; i += 1) {
        await requestBooking(
          { headers: { 'x-nf-client-connection-ip': `10.${hour}.0.${i}` } },
          body({ email: `p${made}@example.com` })
        );
        made += 1;
      }
    }
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 1, 12 + 5)));
    await expect(
      requestBooking(
        { headers: { 'x-nf-client-connection-ip': '10.9.9.9' } },
        body({ email: 'late@example.com' })
      )
    ).rejects.toMatchObject({ statusCode: 429 });
  });
  it('stops texting the owner past the alert budget but still emails', async () => {
    const ids = [];
    for (let i = 0; i < BOOKING_LIMITS.textHourly + 2; i += 1) {
      const booking = await requestBooking(
        { headers: { 'x-nf-client-connection-ip': `10.0.0.${i}` } },
        body({ email: `person${i}@example.com` })
      );
      ids.push(booking.id);
    }

    expect(mocks.fetch).toHaveBeenCalledTimes(BOOKING_LIMITS.textHourly);
    const late = memory.value[ids.at(-1)].notifications;
    expect(late.ownerSms0).toMatchObject({ state: 'skipped', reason: expect.any(String) });
    expect(late.ownerEmail.state).toBe('sent');
    expect(mocks.send).toHaveBeenCalledTimes(BOOKING_LIMITS.textHourly + 2);
  });
  it('stores a keyed hash of the address, not a plain one', async () => {
    const { id } = await requested();
    const stored = memory.value[id].ipHash;

    expect(stored).not.toBe(createHash('sha256').update('127.0.0.1').digest('hex'));
    expect(stored).toBe(createHmac('sha256', 'secret').update('127.0.0.1').digest('hex'));

    vi.stubEnv('IP_HASH_SECRET', 'separate-secret');
    const second = await requestBooking(event, body({ startHour: 19, hours: 1 }));
    expect(memory.value[second.id].ipHash).toBe(
      createHmac('sha256', 'separate-secret').update('127.0.0.1').digest('hex')
    );
  });
});

describe('staff approval and payments', () => {
  it('requires staff authentication for reads and writes', async () => {
    expect((await staffHandler({ httpMethod: 'GET' })).statusCode).toBe(401);
    expect((await staffHandler({ httpMethod: 'POST', body: '{}' })).statusCode).toBe(401);
    expect(
      (
        await staffHandler({
          httpMethod: 'GET',
          headers: { authorization: `Bearer ${createSession('staff')}` },
        })
      ).statusCode
    ).toBe(200);
  });
  it('creates exact-price checkout only after approval and emails the customer', async () => {
    const b = await approved();
    expect(b.status).toBe('awaiting_payment');
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      customer_email: 'musician@example.com',
      payment_method_types: ['card'],
      metadata: { kind: 'studio_booking', bookingId: b.id },
    });
    expect(mocks.create.mock.calls[0][0].line_items[0].price_data.unit_amount).toBe(6000);
    expect(mocks.send.mock.calls.at(-1)[0]).toMatchObject({
      to: 'musician@example.com',
      subject: expect.stringContaining('approved'),
    });
    expect(mocks.send.mock.calls.at(-1)[0].text).toContain(b.checkoutUrl);
    await approveBooking(event, b.id, 'staff');
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it('allows only one overlapping concurrent approval', async () => {
    const a = await requested();
    const b = await requested();
    const results = await Promise.allSettled([
      approveBooking(event, a.id, 'a'),
      approveBooking(event, b.id, 'b'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(Object.values(memory.value).filter(holdsTime)).toHaveLength(1);
  });
  it('allows adjacent reservations without overlap', async () => {
    await approved();
    expect((await approved({ startHour: 22, hours: 2 })).status).toBe('awaiting_payment');
  });
  it('rejects new requests for already held time', async () => {
    await approved();
    await expect(requested()).rejects.toThrow('just reserved');
  });
  it('retains the hold and idempotency key after an uncertain Stripe response', async () => {
    const b = await requested();
    mocks.create.mockRejectedValueOnce(new Error('Network timeout'));
    await expect(approveBooking(event, b.id, 'staff')).rejects.toThrow();
    expect(memory.value[b.id].status).toBe('approving');
    await approveBooking(event, b.id, 'staff');
    expect(mocks.create.mock.calls[0][1]).toEqual(mocks.create.mock.calls[1][1]);
    expect(mocks.create.mock.calls[0][0]).toEqual(mocks.create.mock.calls[1][0]);
  });
  it('recovers a Stripe session whose local save failed', async () => {
    const b = await approved();
    memory.value[b.id].status = 'approving';
    delete memory.value[b.id].checkoutSessionId;
    const recovered = await reconcileBooking(event, b.id);
    expect(recovered.checkoutSessionId).toBe(b.checkoutSessionId);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });
  it('does not finalize an unpaid session or a spoofed amount', async () => {
    const b = await approved();
    expect(
      (await applyBookingPayment(event, await mocks.retrieve(b.checkoutSessionId))).status
    ).toBe('awaiting_payment');
    await expect(
      applyBookingPayment(event, { ...paidSession(b), amount_total: 1 })
    ).rejects.toThrow('amount');
    expect(memory.value[b.id].status).toBe('awaiting_payment');
  });
  it('finalizes paid checkout once and sends one confirmation email', async () => {
    const b = await approved();
    const session = paidSession(b);
    await applyBookingPayment(event, session);
    await applyBookingPayment(event, session);
    expect(memory.value[b.id].status).toBe('paid');
    expect(
      mocks.send.mock.calls.filter(([payload]) => payload.subject.includes('finalized'))
    ).toHaveLength(1);
  });
  it('releases time only after Stripe verifies an expired session', async () => {
    const b = await approved();
    vi.setSystemTime(b.checkoutExpiresAt + 1000);
    expect(holdsTime(memory.value[b.id])).toBe(true);
    Object.values(sessions)[0].status = 'expired';
    expect((await reconcileBooking(event, b.id)).status).toBe('expired');
    expect(holdsTime(memory.value[b.id])).toBe(false);
  });
  it('expires checkout before cancelling an unpaid reservation', async () => {
    const b = await approved();
    expect((await cancelUnpaidBooking(event, b.id, 'staff')).status).toBe('cancelled');
    expect(mocks.expire).toHaveBeenCalledWith(b.checkoutSessionId);
  });
  it('does not cancel a payment that won the expiry race', async () => {
    const b = await approved();
    mocks.expire.mockImplementationOnce(async () => {
      paidSession(b);
      throw new Error('Already paid');
    });
    await expect(cancelUnpaidBooking(event, b.id, 'staff')).rejects.toThrow('already succeeded');
    expect(memory.value[b.id].status).toBe('paid');
  });
  it('emails a decline before checkout exists', async () => {
    const b = await requested();
    await declineBooking(event, b.id, 'staff');
    expect(memory.value[b.id].notifications.customerDeclined.state).toBe('sent');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('routes signed studio webhooks separately from product fulfillment', async () => {
    const b = await approved();
    mocks.webhook.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: paidSession(b) },
    });
    const response = await webhookHandler({
      httpMethod: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: '{}',
    });
    expect(response.statusCode).toBe(200);
    expect(memory.value[b.id].status).toBe('paid');
    expect(mocks.webhook).toHaveBeenCalled();
  });
});

describe('staff booking errors', () => {
  it('shows staff messages written for them, but not raw provider errors', async () => {
    const b = await requested();
    const token = createSession('staff');
    const act = (action) =>
      staffHandler({
        httpMethod: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: b.id, action }),
      });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mocks.create.mockRejectedValueOnce(
      Object.assign(new Error('Invalid API Key provided: sk_live_****1234'), { statusCode: 401 })
    );
    const failed = await act('approve');
    expect(failed.statusCode).toBe(503);
    expect(failed.body).not.toContain('sk_live');

    const refused = await act('cancel');
    expect(refused.statusCode).toBe(409);
    expect(JSON.parse(refused.body).error).toMatch(/Retry approval/);
  });
});

describe('retention', () => {
  async function seedCalendar() {
    const requestedOnly = await requested();
    const awaiting = await approved({ date: '2026-10-11' });
    const declined = await requested({ date: '2026-10-12' });
    await declineBooking(event, declined.id, 'staff');
    const paid = await approved({ date: '2026-10-13' });
    await applyBookingPayment(event, paidSession(paid));
    const upcoming = await requested({ date: '2026-12-20' });
    return { requestedOnly, awaiting, declined, paid, upcoming };
  }

  it('archives settled bookings once their date is past the retention window', async () => {
    const seeded = await seedCalendar();
    const snapshot = structuredClone(memory.value);
    // 36 days after the oldest booking date.
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));

    expect(ARCHIVE_AFTER_DAYS).toBe(30);
    expect(await archivePastBookings(event)).toBe(3);

    // Payment still in flight at Stripe, and future time, stay live.
    expect(Object.keys(memory.value).sort()).toEqual(
      [seeded.awaiting.id, seeded.upcoming.id].sort()
    );
    for (const booking of [seeded.requestedOnly, seeded.declined, seeded.paid]) {
      const date = snapshot[booking.id].date;
      expect(memory.other.get(`archive/${date.slice(0, 7)}/${booking.id}.json`).value).toEqual(
        snapshot[booking.id]
      );
    }
  });

  it('keeps everything while it is inside the window', async () => {
    await seedCalendar();
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    expect(await archivePastBookings(event)).toBe(0);
    expect(Object.keys(memory.value)).toHaveLength(5);
  });

  it('leaves a booking that changed after it was copied for the next run', async () => {
    const { requestedOnly } = await seedCalendar();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
    memory.afterOtherWrite = (key) => {
      if (!key.includes(requestedOnly.id)) return;
      memory.value[requestedOnly.id].notes = 'Edited meanwhile';
      memory.version += 1;
    };

    expect(await archivePastBookings(event)).toBe(2);
    expect(memory.value[requestedOnly.id].notes).toBe('Edited meanwhile');

    memory.afterOtherWrite = null;
    expect(await archivePastBookings(event)).toBe(1);
    expect(memory.value[requestedOnly.id]).toBeUndefined();
  });

  it('runs from the scheduled maintenance job', async () => {
    const seeded = await seedCalendar();
    vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));

    expect((await maintenanceHandler(event)).statusCode).toBe(200);
    expect(memory.value[seeded.paid.id]).toBeUndefined();
    expect(memory.value[seeded.awaiting.id]).toBeDefined();
  });
});

describe('pricing and timezone', () => {
  it('uses the published hourly and four-hour rates', () => {
    expect([1, 2, 3, 4, 5, 6].map(bookingPrice)).toEqual([2500, 5000, 7500, 6000, 8500, 11000]);
  });
  it('handles Los Angeles winter, summer and midnight correctly', () => {
    expect(new Date(studioTimestamp('2026-10-10', 18)).toISOString()).toBe(
      '2026-10-11T01:00:00.000Z'
    );
    expect(new Date(studioTimestamp('2026-12-10', 18)).toISOString()).toBe(
      '2026-12-11T02:00:00.000Z'
    );
    expect(new Date(studioTimestamp('2026-12-10', 24)).toISOString()).toBe(
      '2026-12-11T08:00:00.000Z'
    );
    expect(Number.isNaN(studioTimestamp('2026-03-08', 2))).toBe(true);
  });
});
