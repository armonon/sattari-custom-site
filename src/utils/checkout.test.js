import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCheckoutSession,
  fetchCheckoutSessionStatus,
  getCheckoutEndpoint,
  getCheckoutStatusEndpoint,
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
        items: [{ slug: 'pirouz-series-cymbals', size: null, quantity: 2 }],
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
