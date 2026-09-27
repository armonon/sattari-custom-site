// Stripe-shaped fixtures for the shop checkout tests.

// A real catalog product with no sizes or colors, priced at $80.
export const PLAIN = 'pirouz-series-cymbals';
export const PLAIN_NAME = 'Pirouz Series Cymbals';

export function lineItem({
  slug = PLAIN,
  name = PLAIN_NAME,
  size = 'default',
  color = 'default',
  quantity = 1,
  unitAmount = 8000,
} = {}) {
  return {
    description: name,
    quantity,
    amount_total: unitAmount * quantity,
    currency: 'usd',
    price: { product: { name, metadata: { slug, size, color } } },
  };
}

export function checkoutSession({
  id = 'cs_test_order_one',
  holdId,
  status = 'complete',
  payment_status = 'paid',
  amount_total = 8795,
  email = 'buyer@example.com',
} = {}) {
  return {
    id,
    object: 'checkout.session',
    status,
    payment_status,
    amount_total,
    currency: 'usd',
    created: 1790000000,
    livemode: false,
    url: null,
    metadata: holdId ? { kind: 'shop_order', holdId } : {},
    customer_details: { email, name: 'A Buyer', phone: '555-0100' },
    shipping_details: null,
  };
}

// Makes a mocked Checkout Sessions API ({ create, retrieve, expire }) remember
// the sessions it created, so a test can retrieve, expire, and complete them the
// way Stripe would. Only an open session can be expired, as at Stripe.
export function fakeCheckoutSessions(api) {
  const sessions = new Map();

  api.create.mockImplementation(async (params) => {
    const id = `cs_test_created_${sessions.size + 1}`;
    sessions.set(id, {
      ...checkoutSession({ id, status: 'open', payment_status: 'unpaid' }),
      metadata: params.metadata,
      url: 'https://checkout.stripe.test/pay',
    });
    return structuredClone(sessions.get(id));
  });

  api.retrieve.mockImplementation(async (id) => {
    if (!sessions.has(id)) {
      throw Object.assign(new Error(`No such checkout.session: '${id}'`), {
        code: 'resource_missing',
      });
    }
    return structuredClone(sessions.get(id));
  });

  api.expire.mockImplementation(async (id) => {
    const session = sessions.get(id);
    if (session?.status !== 'open') {
      throw new Error('Only Checkout Sessions with a status in ["open"] can be expired.');
    }
    session.status = 'expired';
    return structuredClone(session);
  });

  return {
    sessions,
    // The shopper paid, or started a delayed payment ('unpaid').
    complete(id, paymentStatus = 'paid') {
      Object.assign(sessions.get(id), { status: 'complete', payment_status: paymentStatus });
      return structuredClone(sessions.get(id));
    },
  };
}

let eventCounter = 0;

export function stripeEvent(type, object) {
  eventCounter += 1;
  return { id: `evt_test_${eventCounter}`, type, data: { object } };
}

// constructEvent is mocked to parse the body, so the "signed" payload is just
// the event itself.
export function webhookCall(event) {
  return {
    httpMethod: 'POST',
    headers: { 'stripe-signature': 't=1,v1=test' },
    body: JSON.stringify(event),
  };
}

// A Resend stand-in that behaves like the real API with an Idempotency-Key:
// a repeated key returns the original result instead of sending again.
export function createMailbox() {
  const delivered = [];
  const byKey = new Map();
  let failures = 0;

  return {
    delivered,
    failNext(count = 1) {
      failures = count;
    },
    async send(payload, options = {}) {
      if (failures > 0) {
        failures -= 1;
        return { data: null, error: { name: 'application_error', message: 'Provider down' } };
      }
      const key = options.idempotencyKey;
      if (key && byKey.has(key)) return { data: { id: byKey.get(key) }, error: null };
      const id = `email_${delivered.length + 1}`;
      delivered.push({ ...payload, idempotencyKey: key });
      if (key) byKey.set(key, id);
      return { data: { id }, error: null };
    },
    reset() {
      delivered.length = 0;
      byKey.clear();
      failures = 0;
    },
  };
}
