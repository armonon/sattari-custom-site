import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CartProvider, useCart } from './CartContext';
import { InventoryProvider } from './InventoryContext';
import CartNotice from '../components/CartNotice';
import { deferred } from '../test/deferred';

const STORAGE_KEY = 'sattari-cart-v1';

// What staff changed since the build: a new price, a new product and a hidden one.
const STAFF_INVENTORY = {
  stock: {},
  catalog: {
    overrides: { 'cymbal-felts': { price: 9.5 } },
    added: [{ name: 'Frame Drum', slug: 'frame-drum', price: 120, category: 'essentials' }],
    hidden: ['violin-strings'],
  },
};

const SAVED_CART = [
  { slug: 'cymbal-felts', size: null, color: null, quantity: 1 },
  { slug: 'frame-drum', size: null, color: null, quantity: 1, name: 'Frame Drum' },
  { slug: 'violin-strings', size: null, color: null, quantity: 2 },
];

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function storedSlugs() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)).map((entry) => entry.slug);
}

function CartLines() {
  const { cartItems, subtotal } = useCart();
  return (
    <ul>
      {cartItems.map((item) => (
        <li key={item.key}>
          {item.product.name} ${item.unitPrice.toFixed(2)} x{item.quantity}
        </li>
      ))}
      <li>Subtotal ${subtotal.toFixed(2)}</li>
    </ul>
  );
}

function renderCart() {
  return render(
    <InventoryProvider>
      <CartProvider>
        <CartNotice />
        <CartLines />
      </CartProvider>
    </InventoryProvider>
  );
}

beforeEach(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SAVED_CART));
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('keeps staff-added items while the catalog loads, then shows current prices and drops hidden items with a notice', async () => {
  const inventory = deferred();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => inventory.promise)
  );

  renderCart();

  // Only the base catalog is known yet: nothing may be thrown away.
  expect(screen.getByText('Cymbal Felts $6.99 x1')).toBeInTheDocument();
  expect(screen.queryByText(/Frame Drum/)).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading 1 more item in your cart');
  expect(storedSlugs()).toEqual(['cymbal-felts', 'frame-drum', 'violin-strings']);

  await act(async () => inventory.resolve(jsonResponse(STAFF_INVENTORY)));

  expect(await screen.findByText('Frame Drum $120.00 x1')).toBeInTheDocument();
  expect(screen.getByText('Cymbal Felts $9.50 x1')).toBeInTheDocument();
  expect(within(screen.getByRole('list')).queryByText(/Violin Strings/)).not.toBeInTheDocument();
  expect(screen.getByText('Subtotal $129.50')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Violin Strings is no longer available, so we removed it from your cart.'
  );
  expect(storedSlugs()).toEqual(['cymbal-felts', 'frame-drum']);

  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

it('keeps the whole cart when the catalog cannot be loaded, and catches up on retry', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse({ error: 'Unavailable' }, 503))
    .mockResolvedValueOnce(jsonResponse(STAFF_INVENTORY));
  vi.stubGlobal('fetch', fetchMock);

  renderCart();

  expect(
    await screen.findByText(/We couldn.t load 1 item in your cart right now/)
  ).toBeInTheDocument();
  expect(screen.queryByText(/Frame Drum/)).not.toBeInTheDocument();
  expect(storedSlugs()).toEqual(['cymbal-felts', 'frame-drum', 'violin-strings']);

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

  expect(await screen.findByText('Frame Drum $120.00 x1')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(storedSlugs()).toEqual(['cymbal-felts', 'frame-drum']);
});

it('clearing an already empty cart does not change state', async () => {
  localStorage.setItem(STORAGE_KEY, '[]');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(STAFF_INVENTORY))
  );
  const seen = [];
  function Probe() {
    const cart = useCart();
    seen.push(cart);
    return (
      <button type="button" onClick={cart.clearCart}>
        Clear
      </button>
    );
  }

  render(
    <InventoryProvider>
      <CartProvider>
        <Probe />
      </CartProvider>
    </InventoryProvider>
  );
  await act(async () => {});
  const rendersBefore = seen.length;
  const valueBefore = seen[seen.length - 1];

  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

  expect(seen.length).toBe(rendersBefore);
  expect(seen[seen.length - 1]).toBe(valueBefore);
  expect(valueBefore.clearCart).toBe(seen[0].clearCart);
});

it('treats a degraded inventory response as not loaded and keeps staff-added items', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jsonResponse({
        stock: {},
        catalog: { overrides: {}, added: [], hidden: [] },
        degraded: true,
      })
    )
  );

  renderCart();

  expect(
    await screen.findByText(/We couldn.t load 1 item in your cart right now/)
  ).toBeInTheDocument();
  expect(storedSlugs()).toEqual(['cymbal-felts', 'frame-drum', 'violin-strings']);
});
