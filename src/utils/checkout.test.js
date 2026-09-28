import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCheckoutSession,
  fetchCheckoutSessionStatus,
  getCheckoutEndpoint,
  getCheckoutStatusEndpoint,
  productToFix,
} from './checkout';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('checkout utilities', () => {
  it('prefers VITE_CHECKOUT_URL when present', () => {
    vi.stubEnv('VITE_CHECKOUT_URL', 'https://checkout.example.com/session');
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');

    expect(getCheckoutEndpoint()).toBe('https://checkout.example.com/session');
  });

  it('builds the checkout endpoint from VITE_API_URL', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/');

    expect(getCheckoutEndpoint()).toBe('https://api.example.com/api/create-checkout-session');
  });

  it('prefers VITE_CHECKOUT_STATUS_URL when present', () => {
    vi.stubEnv('VITE_CHECKOUT_STATUS_URL', 'https://checkout.example.com/status');
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');

    expect(getCheckoutStatusEndpoint()).toBe('https://checkout.example.com/status');
  });

  it('builds the checkout status endpoint from VITE_API_URL', () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/');

    expect(getCheckoutStatusEndpoint()).toBe('https://api.example.com/api/checkout-session-status');
  });

  it('posts normalized cart items and returns the checkout session', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.example.com' }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const session = await createCheckoutSession([
      {
        slug: 'pirouz-series-cymbals',
        size: null,
        quantity: 2,
        product: { name: 'Pirouz Series Cymbals' },
        unitPrice: 80,
        lineTotal: 160,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 2 }],
      }),
    });
    expect(session).toEqual({ id: 'cs_test_123', url: 'https://checkout.example.com' });
  });

  it('surfaces API error messages when checkout creation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'Stripe is temporarily unavailable.' }),
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createCheckoutSession([{ slug: 'pirouz-series-cymbals', quantity: 1 }])
    ).rejects.toThrow('Stripe is temporarily unavailable.');
  });

  it('keeps the HTTP status and error code so callers can react to a stale cart', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: vi
          .fn()
          .mockResolvedValue({ error: 'Cymbal Felts just sold out.', code: 'out_of_stock' }),
      })
    );

    await expect(
      createCheckoutSession([{ slug: 'cymbal-felts', quantity: 1 }])
    ).rejects.toMatchObject({
      message: 'Cymbal Felts just sold out.',
      status: 409,
      code: 'out_of_stock',
    });
  });

  it.each([
    [
      409,
      'Something in your cart just changed or sold out. Please review your cart and try again.',
    ],
    [503, 'Checkout is temporarily unavailable. Please try again in a few minutes.'],
    [500, 'Unable to create checkout session.'],
  ])('explains a %i response that has no JSON error', async (status, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token <')),
      })
    );

    await expect(createCheckoutSession([{ slug: 'cymbal-felts', quantity: 1 }])).rejects.toThrow(
      message
    );
  });

  it('explains a product that was hidden after it was added to the cart', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: 'Unknown product slug: violin-strings' }),
      })
    );

    await expect(
      createCheckoutSession([{ slug: 'violin-strings', quantity: 1 }])
    ).rejects.toMatchObject({
      message:
        'An item in your cart is no longer available. Please review your cart and try again.',
      status: 400,
    });
  });

  it('keeps the products a color_required refusal names, with a message when none is sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          code: 'color_required',
          slug: 'miami-electric-violin',
          slugs: ['miami-electric-violin', 'sattari-practice-pad-8'],
        }),
      })
    );

    const error = await createCheckoutSession([
      { slug: 'miami-electric-violin', quantity: 1 },
    ]).catch((failure) => failure);

    expect(error).toMatchObject({
      message: 'Choose a color for an item in your cart before checking out.',
      status: 409,
      code: 'color_required',
      slug: 'miami-electric-violin',
      slugs: ['miami-electric-violin', 'sattari-practice-pad-8'],
    });
    expect(productToFix(error)).toEqual({ slug: 'miami-electric-violin', code: 'color_required' });
  });

  it('keeps the per-item limit of a quantity_limit refusal and does not link to a product', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          error: 'Online orders can include up to 10 of each item.',
          code: 'quantity_limit',
          limit: 10,
        }),
      })
    );

    const error = await createCheckoutSession([{ slug: 'cymbal-felts', quantity: 12 }]).catch(
      (failure) => failure
    );

    expect(error).toMatchObject({ code: 'quantity_limit', limit: 10, slug: null, slugs: [] });
    // Lowered in the cart itself, not on the product page.
    expect(productToFix({ ...error, slug: 'cymbal-felts' })).toBeNull();
  });

  it('explains a hold_limit refusal (429) even without a message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({ code: 'hold_limit' }),
      })
    );

    await expect(
      createCheckoutSession([{ slug: 'cymbal-felts', quantity: 1 }])
    ).rejects.toMatchObject({
      status: 429,
      code: 'hold_limit',
      message: expect.stringContaining('several checkouts open'),
    });
  });

  it('does not link to a product that is gone', () => {
    const gone = Object.assign(new Error('No longer available.'), {
      status: 409,
      code: 'product_unavailable',
      slug: 'violin-strings',
    });

    expect(productToFix(gone)).toBeNull();
    expect(productToFix(new Error('Stripe is down.'))).toBeNull();
  });

  it('turns a network failure into a message a customer can act on', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(createCheckoutSession([{ slug: 'cymbal-felts', quantity: 1 }])).rejects.toThrow(
      'We could not reach checkout. Check your connection and try again.'
    );
  });

  it('fetches verified checkout session status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: 'cs_test_123',
        status: 'complete',
        payment_status: 'paid',
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const session = await fetchCheckoutSessionStatus('cs_test_123');

    expect(fetchMock).toHaveBeenCalledWith('/api/checkout-session-status?session_id=cs_test_123');
    expect(session).toEqual({
      id: 'cs_test_123',
      status: 'complete',
      payment_status: 'paid',
    });
  });
});
