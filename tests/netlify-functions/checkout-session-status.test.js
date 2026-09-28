// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWith } from './helpers/invoke.js';

const retrieve = vi.hoisted(() => vi.fn());

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return { checkout: { sessions: { retrieve } } };
  }),
}));

const handler = callWith(
  (await import('../../netlify/functions/checkout-session-status.js')).default
);
const { maskEmail } = await import('../../src/utils/orderProcessing.js');

const SESSION_ID = 'cs_test_a1B2c3D4e5F6g7H8';

function lookup(sessionId = SESSION_ID) {
  return handler({ httpMethod: 'GET', queryStringParameters: { session_id: sessionId } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123');
  retrieve.mockResolvedValue({
    id: SESSION_ID,
    status: 'complete',
    payment_status: 'paid',
    amount_total: 8795,
    currency: 'usd',
    customer_email: null,
    customer_details: {
      email: 'jane.doe@gmail.com',
      name: 'Jane Doe',
      phone: '+15555550100',
      address: { line1: '1 Main St', city: 'Los Angeles' },
    },
    shipping_details: { name: 'Jane Doe', address: { line1: '1 Main St' } },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('checkout-session-status', () => {
  it('returns only what the confirmation page needs', async () => {
    const response = await lookup();
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({
      id: SESSION_ID,
      status: 'complete',
      payment_status: 'paid',
      amount_total: 8795,
      currency: 'usd',
      customer_email_masked: 'j•••@gmail.com',
    });
    expect(response.body).not.toContain('Jane');
    expect(response.body).not.toContain('jane.doe');
    expect(response.body).not.toContain('Main St');
  });

  it('returns null for the masked email when Stripe has none', async () => {
    retrieve.mockResolvedValue({
      id: SESSION_ID,
      status: 'open',
      payment_status: 'unpaid',
      amount_total: 8795,
      currency: 'usd',
      customer_email: null,
      customer_details: null,
    });

    expect(JSON.parse((await lookup()).body).customer_email_masked).toBeNull();
  });

  it('refuses malformed session ids without calling Stripe', async () => {
    expect((await lookup('../../v1/customers')).statusCode).toBe(400);
    expect((await handler({ httpMethod: 'GET', queryStringParameters: {} })).statusCode).toBe(400);
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('does not pass Stripe error details through', async () => {
    retrieve.mockRejectedValue(
      Object.assign(new Error('Invalid API Key provided: sk_live_****1234'), {
        type: 'StripeAuthenticationError',
      })
    );

    const response = await lookup();

    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain('sk_live');
    expect(JSON.parse(response.body)).toEqual({
      error: 'Unable to verify checkout session right now.',
    });
  });

  it('reports an unknown session as not found', async () => {
    retrieve.mockRejectedValue(
      Object.assign(new Error(`No such checkout.session: '${SESSION_ID}'`), {
        code: 'resource_missing',
      })
    );

    const response = await lookup();

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'Checkout session not found.' });
  });
});

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('jane@gmail.com')).toBe('j•••@gmail.com');
    expect(maskEmail('JANE.DOE+shop@example.co.uk')).toBe('J•••@example.co.uk');
  });

  it('does not reveal a one-letter local part', () => {
    expect(maskEmail('j@gmail.com')).toBe('•••@gmail.com');
  });

  it('returns null for anything that is not an address', () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail('')).toBeNull();
    expect(maskEmail('no-at-sign')).toBeNull();
    expect(maskEmail('@gmail.com')).toBeNull();
    expect(maskEmail('jane@')).toBeNull();
  });
});
