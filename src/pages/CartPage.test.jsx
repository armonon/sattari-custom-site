import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

it('lets a quantity be cleared and retyped without removing the line', async () => {
  stubFetch(jsonResponse({}));

  renderCartPage();
  const input = await screen.findByRole('spinbutton', {
    name: 'Quantity for Pirouz Series Cymbals',
  });

  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByRole('link', { name: 'Pirouz Series Cymbals' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY))[0].quantity).toBe(2);

  fireEvent.change(input, { target: { value: '5' } });
  expect(screen.getByText('$425.00', { selector: '.total-price' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY))[0].quantity).toBe(5);

  fireEvent.change(input, { target: { value: '' } });
  fireEvent.blur(input);
  expect(input).toHaveValue(5);
});

it('asks for a color, with a link to the product, when the server refuses a colorless item', async () => {
  const fetchMock = stubFetch(
    jsonResponse({ code: 'color_required', slug: 'pirouz-series-cymbals' }, 409)
  );

  renderCartPage();
  await screen.findByText('$85.00 each');
  fireEvent.click(screen.getByRole('button', { name: /Proceed to Secure Checkout/ }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Choose a color for an item in your cart before checking out.');
  expect(
    within(alert).getByRole('link', { name: 'Choose a color for Pirouz Series Cymbals' })
  ).toHaveAttribute('href', '/product/pirouz-series-cymbals');
  // Like any refused cart, the catalog reloads so the cart catches up.
  expect(inventoryRequests(fetchMock)).toHaveLength(2);
});

it('flags a line whose color was removed and does not send it to checkout', async () => {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([{ slug: 'miami-electric-violin', size: null, color: 'Gold', quantity: 1 }])
  );
  const fetchMock = stubFetch(jsonResponse({ id: 'cs_1', url: 'https://checkout.stripe.com/c/1' }));

  renderCartPage();
  const lineLink = await screen.findByRole('link', {
    name: 'Choose a color for MIAMI - Electric Violin',
  });
  expect(lineLink).toHaveAttribute('href', '/product/miami-electric-violin');

  fireEvent.click(screen.getByRole('button', { name: /Proceed to Secure Checkout/ }));

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Choose a color for MIAMI - Electric Violin before checking out.'
  );
  expect(
    fetchMock.mock.calls.filter(([url]) => url === '/api/create-checkout-session')
  ).toHaveLength(0);
});

it('stops at the 10 checkout accepts for one item, and says so on that line', async () => {
  localStorage.setItem(
    STORAGE_KEY,
    // Saved before the limit existed.
    JSON.stringify([{ slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 25 }])
  );
  stubFetch(jsonResponse({}));

  renderCartPage();

  const input = await screen.findByRole('spinbutton', {
    name: 'Quantity for Pirouz Series Cymbals',
  });
  expect(input).toHaveValue(10);
  expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  expect(screen.getByText('Limit 10 per online order')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
  expect(input).toHaveValue(9);
  expect(screen.queryByText('Limit 10 per online order')).toBeNull();
});
