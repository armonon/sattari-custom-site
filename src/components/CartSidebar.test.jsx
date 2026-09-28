import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CartSidebar from './CartSidebar';
import { CartProvider } from '../context/CartContext';
import { InventoryProvider } from '../context/InventoryContext';
import { redirectToCheckoutUrl } from '../utils/checkout';
import { deferred } from '../test/deferred';

vi.mock('../utils/checkout', async (importOriginal) => ({
  ...(await importOriginal()),
  redirectToCheckoutUrl: vi.fn(),
}));

const STORAGE_KEY = 'sattari-cart-v1';
const INVENTORY = { stock: {}, catalog: { overrides: {}, added: [], hidden: [] } };

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function checkoutRequests(fetchMock) {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/create-checkout-session');
}

function renderDrawer() {
  return render(
    <InventoryProvider>
      <CartProvider>
        <MemoryRouter>
          <CartSidebar onNavigate={vi.fn()} />
        </MemoryRouter>
      </CartProvider>
    </InventoryProvider>
  );
}

beforeEach(() => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([{ slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 2 }])
  );
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(redirectToCheckoutUrl).mockReset();
});

it('creates one Stripe session per checkout, however often the button is pressed', async () => {
  const session = deferred();
  const fetchMock = vi.fn((url) =>
    url === '/api/inventory' ? Promise.resolve(jsonResponse(INVENTORY)) : session.promise
  );
  vi.stubGlobal('fetch', fetchMock);

  renderDrawer();
  const button = screen.getByRole('button', { name: /Proceed to Checkout/ });
  fireEvent.click(button);
  fireEvent.click(button);
  await act(async () =>
    session.resolve(jsonResponse({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' }))
  );

  await waitFor(() =>
    expect(redirectToCheckoutUrl).toHaveBeenCalledWith('https://checkout.stripe.com/c/cs_1')
  );
  // The browser is on its way to Stripe; the button must not come back.
  const processing = screen.getByRole('button', { name: /Processing/ });
  expect(processing).toBeDisabled();
  fireEvent.click(processing);

  expect(checkoutRequests(fetchMock)).toHaveLength(1);
  expect(redirectToCheckoutUrl).toHaveBeenCalledTimes(1);
});

it('includes the flat shipping rate in the drawer total', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(INVENTORY))
  );

  renderDrawer();

  expect((await screen.findByText('Subtotal')).parentElement).toHaveTextContent('Subtotal$160.00');
  expect(screen.getByText('Shipping').parentElement).toHaveTextContent('Shipping$7.95');
  expect(screen.getByText('Total').parentElement).toHaveTextContent('Total$167.95');
});

it('does not start checkout while items in the cart cannot be priced yet', async () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      { slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 1 },
      { slug: 'frame-drum', size: null, color: null, quantity: 1, name: 'Frame Drum' },
    ])
  );
  const inventory = deferred();
  const fetchMock = vi.fn((url) =>
    url === '/api/inventory' ? inventory.promise : Promise.resolve(jsonResponse({}))
  );
  vi.stubGlobal('fetch', fetchMock);

  renderDrawer();
  fireEvent.click(screen.getByRole('button', { name: /Proceed to Checkout/ }));

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Still loading some items in your cart. Try again in a moment.'
  );
  expect(checkoutRequests(fetchMock)).toHaveLength(0);

  // Once the staff-added product is known, checkout sends the whole cart.
  await act(async () =>
    inventory.resolve(
      jsonResponse({
        stock: {},
        catalog: {
          overrides: {},
          added: [{ name: 'Frame Drum', slug: 'frame-drum', price: 120 }],
          hidden: [],
        },
      })
    )
  );
  fireEvent.click(await screen.findByRole('button', { name: /Proceed to Checkout/ }));

  await waitFor(() => expect(checkoutRequests(fetchMock)).toHaveLength(1));
  expect(JSON.parse(checkoutRequests(fetchMock)[0][1].body).items.map((item) => item.slug)).toEqual(
    ['pirouz-series-cymbals', 'frame-drum']
  );
});

it('keeps the line while its quantity box is cleared to type a new number', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(INVENTORY))
  );

  renderDrawer();
  const input = await screen.findByRole('spinbutton', {
    name: 'Quantity for Pirouz Series Cymbals',
  });

  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByRole('link', { name: 'Pirouz Series Cymbals' })).toBeInTheDocument();

  fireEvent.change(input, { target: { value: '3' } });
  expect(screen.getByText('Subtotal').parentElement).toHaveTextContent('Subtotal$240.00');
});
