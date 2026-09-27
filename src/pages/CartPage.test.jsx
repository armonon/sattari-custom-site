import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CartPage from './CartPage';
import { CartProvider } from '../context/CartContext';
import { InventoryProvider } from '../context/InventoryContext';
import { redirectToCheckoutUrl } from '../utils/checkout';

vi.mock('../utils/checkout', async (importOriginal) => ({
  ...(await importOriginal()),
  redirectToCheckoutUrl: vi.fn(),
}));

const STORAGE_KEY = 'sattari-cart-v1';
const INVENTORY = {
  stock: {},
  catalog: { overrides: { 'pirouz-series-cymbals': { price: 85 } }, added: [], hidden: [] },
};

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function stubFetch(checkoutResponse) {
  const fetchMock = vi.fn(async (url) =>
    url === '/api/inventory' ? jsonResponse(INVENTORY) : checkoutResponse
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function inventoryRequests(fetchMock) {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/inventory');
}

function renderCartPage() {
  return render(
    <InventoryProvider>
      <CartProvider>
        <MemoryRouter>
          <CartPage />
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

it('shows the current catalog price and the flat shipping rate', async () => {
  stubFetch(jsonResponse({}));

  renderCartPage();

  expect(await screen.findByText('$85.00 each')).toBeInTheDocument();
  expect(screen.getByText('$170.00', { selector: '.summary-value' })).toBeInTheDocument();
  expect(screen.getByText('$7.95')).toBeInTheDocument();
  expect(screen.getByText('$177.95')).toBeInTheDocument();
});

it('hands off to Stripe once and keeps the button disabled while the browser leaves', async () => {
  const fetchMock = stubFetch(
    jsonResponse({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1' })
  );

  renderCartPage();
  await screen.findByText('$85.00 each');
  fireEvent.click(screen.getByRole('button', { name: /Proceed to Secure Checkout/ }));

  await waitFor(() =>
    expect(redirectToCheckoutUrl).toHaveBeenCalledWith('https://checkout.stripe.com/c/cs_1')
  );
  const processing = screen.getByRole('button', { name: /Processing Secure Checkout/ });
  expect(processing).toBeDisabled();
  fireEvent.click(processing);
  expect(
    fetchMock.mock.calls.filter(([url]) => url === '/api/create-checkout-session')
  ).toHaveLength(1);
});

it('shows why the server refused the cart and reloads the catalog so the cart catches up', async () => {
  const fetchMock = stubFetch(
    jsonResponse(
      {
        error: 'Pirouz Series Cymbals just sold out. Please remove it from your cart.',
        code: 'out_of_stock',
      },
      409
    )
  );

  renderCartPage();
  await screen.findByText('$85.00 each');
  fireEvent.click(screen.getByRole('button', { name: /Proceed to Secure Checkout/ }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Pirouz Series Cymbals just sold out. Please remove it from your cart.'
  );
  expect(inventoryRequests(fetchMock)).toHaveLength(2);
  expect(screen.getByRole('button', { name: /Proceed to Secure Checkout/ })).toBeEnabled();
  expect(redirectToCheckoutUrl).not.toHaveBeenCalled();
});

it('explains a temporary checkout outage even without an error body', async () => {
  stubFetch({
    ok: false,
    status: 503,
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
  });

  renderCartPage();
  await screen.findByText('$85.00 each');
  fireEvent.click(screen.getByRole('button', { name: /Proceed to Secure Checkout/ }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Checkout is temporarily unavailable. Please try again in a few minutes.'
  );
});

it('drops a product hidden after it was added once checkout reports it, and says so', async () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      { slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 1 },
      { slug: 'violin-strings', size: null, color: null, quantity: 1 },
    ])
  );
  let hidden = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url === '/api/inventory') {
        return jsonResponse({ stock: {}, catalog: { overrides: {}, added: [], hidden } });
      }
      // Staff hide the strings while the customer is looking at the cart.
      hidden = ['violin-strings'];
      return jsonResponse({ error: 'Unknown product slug: violin-strings' }, 400);
    })
  );

  renderCartPage();
  await screen.findByText('Violin Strings');
  fireEvent.click(screen.getByRole('button', { name: /Proceed to Secure Checkout/ }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'An item in your cart is no longer available. Please review your cart and try again.'
  );
  expect(
    await screen.findByText(
      'Violin Strings is no longer available, so we removed it from your cart.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Violin Strings' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Pirouz Series Cymbals' })).toBeInTheDocument();
});
