import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CheckoutStatus from './CheckoutStatus';
import { CartProvider, useCart } from '../context/CartContext';
import { InventoryProvider } from '../context/InventoryContext';

const STORAGE_KEY = 'sattari-cart-v1';
const LAST_SESSION_KEY = 'sattari-checkout-session-v1';
const STATUS_URL = '/api/checkout-session-status?session_id=cs_test_123';

let releaseRequests = [];

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function stubFetch(statusBody) {
  const statusRequests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, options) => {
      if (url === '/api/inventory') {
        return jsonResponse({ stock: {}, catalog: { overrides: {}, added: [], hidden: [] } });
      }
      if (String(url).startsWith('/api/checkout-session-status')) {
        statusRequests.push(url);
        return jsonResponse(statusBody);
      }
      if (url === '/api/checkout-release') {
        releaseRequests.push({ method: options.method, body: JSON.parse(options.body) });
        return jsonResponse({ received: true });
      }
      throw new Error(`Unexpected request: ${url}`);
    })
  );
  return statusRequests;
}

function CartCount() {
  const { itemCount } = useCart();
  return <p data-testid="cart-count">{itemCount}</p>;
}

function renderStatus(path) {
  return render(
    <StrictMode>
      <InventoryProvider>
        <CartProvider>
          <MemoryRouter initialEntries={[path]}>
            <CartCount />
            <CheckoutStatus />
          </MemoryRouter>
        </CartProvider>
      </InventoryProvider>
    </StrictMode>
  );
}

// Long enough for a verify → clear cart → re-render → verify loop to repeat.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

beforeEach(() => {
  releaseRequests = [];
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([{ slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 2 }])
  );
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('verifies a paid session exactly once, clears the cart and shows the masked email', async () => {
  const statusRequests = stubFetch({
    id: 'cs_test_123',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 16795,
    currency: 'usd',
    customer_email_masked: 'j•••@gmail.com',
  });

  renderStatus('/checkout/success?session_id=cs_test_123');

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Payment verified' })
  ).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('0'));
  await settle();

  expect(statusRequests).toEqual([STATUS_URL]);
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY))).toEqual([]);
  expect(screen.getByText('j•••@gmail.com')).toBeInTheDocument();
  expect(screen.getByText('$167.95')).toBeInTheDocument();
});

it('keeps the cart while Stripe has not marked the session paid', async () => {
  const statusRequests = stubFetch({
    id: 'cs_test_123',
    status: 'open',
    payment_status: 'unpaid',
    customer_email_masked: null,
  });

  renderStatus('/checkout/success?session_id=cs_test_123');

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Payment still processing' })
  ).toBeInTheDocument();
  await settle();

  expect(statusRequests).toEqual([STATUS_URL]);
  expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
  expect(screen.queryByText(/Email:/)).not.toBeInTheDocument();
});

it('does not ask Stripe anything for a canceled checkout', async () => {
  const statusRequests = stubFetch({});

  renderStatus('/checkout/cancel');

  expect(screen.getByRole('heading', { level: 1, name: 'Checkout canceled' })).toBeInTheDocument();
  await settle();

  expect(statusRequests).toEqual([]);
  expect(releaseRequests).toEqual([]);
  expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
});

it('releases the canceled session’s stock exactly once and keeps the cart', async () => {
  const statusRequests = stubFetch({});

  renderStatus('/checkout/cancel?session_id=cs_test_123');

  expect(screen.getByRole('heading', { level: 1, name: 'Checkout canceled' })).toBeInTheDocument();
  await settle();

  expect(releaseRequests).toEqual([{ method: 'POST', body: { sessionId: 'cs_test_123' } }]);
  expect(statusRequests).toEqual([]);
  expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
});

it('forgets the completed session so the next checkout does not try to replace it', async () => {
  localStorage.setItem(LAST_SESSION_KEY, 'cs_test_123');
  stubFetch({ id: 'cs_test_123', status: 'complete', payment_status: 'paid' });

  renderStatus('/checkout/success?session_id=cs_test_123');

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Payment verified' })
  ).toBeInTheDocument();
  expect(localStorage.getItem(LAST_SESSION_KEY)).toBeNull();
  expect(releaseRequests).toEqual([]);
});
