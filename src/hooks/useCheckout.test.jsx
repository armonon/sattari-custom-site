import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCheckout } from './useCheckout';
import { CartProvider } from '../context/CartContext';
import { InventoryProvider } from '../context/InventoryContext';
import { redirectToCheckoutUrl } from '../utils/checkout';

vi.mock('../utils/checkout', async (importOriginal) => ({
  ...(await importOriginal()),
  redirectToCheckoutUrl: vi.fn(),
}));

const STORAGE_KEY = 'sattari-cart-v1';
const LAST_SESSION_KEY = 'sattari-checkout-session-v1';
const INVENTORY = { stock: {}, catalog: { overrides: {}, added: [], hidden: [] } };

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function wrapper({ children }) {
  return (
    <InventoryProvider>
      <CartProvider>{children}</CartProvider>
    </InventoryProvider>
  );
}

// Every checkout request gets the next session, unless `refuse` says otherwise.
function stubFetch({ refuse = null } = {}) {
  let created = 0;
  const fetchMock = vi.fn(async (url) => {
    if (url === '/api/inventory') return jsonResponse(INVENTORY);
    if (url !== '/api/create-checkout-session') throw new Error(`Unexpected request: ${url}`);
    if (refuse) return jsonResponse(refuse, 409);
    created += 1;
    return jsonResponse({
      id: `cs_test_${created}`,
      url: `https://checkout.stripe.com/c/${created}`,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function checkoutBodies(fetchMock) {
  return fetchMock.mock.calls
    .filter(([url]) => url === '/api/create-checkout-session')
    .map(([, options]) => JSON.parse(options.body));
}

// What the browser fires when Back restores the page from the back/forward cache.
function returnFromStripe() {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: true });
  act(() => {
    window.dispatchEvent(event);
  });
}

beforeEach(() => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([{ slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 1 }])
  );
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(redirectToCheckoutUrl).mockReset();
});

it('names the checkout the shopper backed out of when they check out again', async () => {
  const fetchMock = stubFetch();
  const { result } = renderHook(useCheckout, { wrapper });

  await act(() => result.current.startCheckout());
  expect(redirectToCheckoutUrl).toHaveBeenLastCalledWith('https://checkout.stripe.com/c/1');
  expect(checkoutBodies(fetchMock)[0]).not.toHaveProperty('replacesSessionId');

  returnFromStripe();
  await act(() => result.current.startCheckout());

  expect(checkoutBodies(fetchMock)[1]).toEqual({
    items: [{ slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 1 }],
    replacesSessionId: 'cs_test_1',
  });
  expect(redirectToCheckoutUrl).toHaveBeenLastCalledWith('https://checkout.stripe.com/c/2');
  expect(localStorage.getItem(LAST_SESSION_KEY)).toBe('cs_test_2');
});

it('keeps naming the old session until a new one is actually created', async () => {
  localStorage.setItem(LAST_SESSION_KEY, 'cs_test_old');
  const fetchMock = stubFetch({
    refuse: { error: 'Pirouz Series Cymbals just sold out.', code: 'out_of_stock' },
  });
  const { result } = renderHook(useCheckout, { wrapper });

  await act(() => result.current.startCheckout());

  expect(result.current.checkoutError).toBe('Pirouz Series Cymbals just sold out.');
  expect(checkoutBodies(fetchMock)[0].replacesSessionId).toBe('cs_test_old');
  expect(localStorage.getItem(LAST_SESSION_KEY)).toBe('cs_test_old');
});

it('names the items over the per-item limit when the server refuses the quantity', async () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      { slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 12 },
      { slug: 'cymbal-felts', size: null, color: null, quantity: 1 },
    ])
  );
  stubFetch({
    refuse: {
      error: 'Online orders can include up to 10 of each item.',
      code: 'quantity_limit',
      slug: 'pirouz-series-cymbals',
      slugs: ['pirouz-series-cymbals'],
      limit: 10,
    },
  });
  const { result } = renderHook(useCheckout, { wrapper });
  await act(async () => {});

  await act(() => result.current.startCheckout());

  expect(result.current.checkoutError).toBe(
    'Online orders can include up to 10 of each item. Too many: Pirouz Series Cymbals.'
  );
  expect(result.current.checkoutProduct).toBeNull();
});

it('links a color_required refusal to the product page where the color is chosen', async () => {
  stubFetch({
    refuse: {
      error: 'Please choose a color for every item in your cart that comes in more than one.',
      code: 'color_required',
      slug: 'pirouz-series-cymbals',
      slugs: ['pirouz-series-cymbals'],
    },
  });
  const { result } = renderHook(useCheckout, { wrapper });
  await act(async () => {});

  await act(() => result.current.startCheckout());

  expect(result.current.checkoutProduct).toEqual({
    slug: 'pirouz-series-cymbals',
    name: 'Pirouz Series Cymbals',
    label: 'Choose a color',
  });
});

it('explains too many open checkouts without reloading the catalog', async () => {
  const fetchMock = vi.fn(async (url) =>
    url === '/api/inventory'
      ? jsonResponse(INVENTORY)
      : jsonResponse(
          {
            error:
              'There are already several checkouts open from your connection. Please finish or close one of them, or try again in about 45 minutes.',
            code: 'hold_limit',
          },
          429
        )
  );
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(useCheckout, { wrapper });
  await act(async () => {});

  await act(() => result.current.startCheckout());

  expect(result.current.checkoutError).toMatch(/several checkouts open/);
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/inventory')).toHaveLength(1);
});
