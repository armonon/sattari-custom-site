import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ProductDetail from './ProductDetail';
import { CartProvider } from '../context/CartContext';
import { InventoryProvider } from '../context/InventoryContext';
import { deferred } from '../test/deferred';

const EMPTY_CATALOG = { overrides: {}, added: [], hidden: [] };

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

let navigate;
function NavigateHandle() {
  navigate = useNavigate();
  return null;
}

function renderProduct(slug, { snapshot } = {}) {
  return render(
    <HelmetProvider>
      <InventoryProvider initialInventory={snapshot}>
        <CartProvider>
          <MemoryRouter initialEntries={[`/product/${slug}`]}>
            <NavigateHandle />
            <Routes>
              <Route path="/product/:slug" element={<ProductDetail />} />
            </Routes>
          </MemoryRouter>
        </CartProvider>
      </InventoryProvider>
    </HelmetProvider>
  );
}

function storedCart() {
  return JSON.parse(localStorage.getItem('sattari-cart-v1') || '[]');
}

const mainImage = (container) => container.querySelector('.product-detail-image img');

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('starts each product with its own photo, color and quantity', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ stock: {}, catalog: EMPTY_CATALOG }))
  );
  const { container } = renderProduct('cremona-handmade-acoustic-violin');
  await screen.findByRole('heading', { level: 1, name: /CREMONA/ });

  fireEvent.click(screen.getByRole('button', { name: 'View image 7 of 7' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
  expect(mainImage(container)).toHaveAttribute(
    'src',
    '/sattari site/violins/cremona-acoustic-7.jpg'
  );

  act(() => navigate('/product/miami-electric-violin'));

  await screen.findByRole('heading', { level: 1, name: /MIAMI/ });
  expect(mainImage(container)).toHaveAttribute('src', '/sattari site/violins/miami-electric.jpg');
  expect(screen.getByRole('button', { name: 'View image 1 of 10' })).toHaveAttribute(
    'aria-current',
    'true'
  );
  expect(screen.getByRole('spinbutton')).toHaveValue(1);
  expect(screen.getByText('Color: Black')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Black' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
  await waitFor(() =>
    expect(storedCart()).toEqual([
      expect.objectContaining({ slug: 'miami-electric-violin', color: 'Black', quantity: 1 }),
    ])
  );
});

it('defaults to the first color in stock and sends the chosen color to the cart', async () => {
  const stock = { 'miami-electric-violin::::Black': 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ stock, catalog: EMPTY_CATALOG }))
  );
  renderProduct('miami-electric-violin', { snapshot: { stock, catalog: EMPTY_CATALOG } });

  expect(await screen.findByText('Color: Red')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Black (out of stock)' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );

  fireEvent.click(screen.getByRole('button', { name: 'Blue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
  await waitFor(() =>
    expect(storedCart()).toEqual([expect.objectContaining({ color: 'Blue', quantity: 1 })])
  );
});

it('shows a product staff added after the build once the live catalog has it, never a 404 first', async () => {
  const live = deferred();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => live.promise)
  );
  // The page was built before the product existed.
  renderProduct('frame-drum', { snapshot: { stock: {}, catalog: EMPTY_CATALOG } });

  expect(screen.getByRole('status')).toHaveTextContent('Loading product…');
  expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();

  await act(async () =>
    live.resolve(
      jsonResponse({
        stock: {},
        catalog: {
          ...EMPTY_CATALOG,
          added: [{ name: 'Frame Drum', slug: 'frame-drum', price: 120, category: 'essentials' }],
        },
      })
    )
  );

  expect(await screen.findByRole('heading', { level: 1, name: 'Frame Drum' })).toBeInTheDocument();
});

it('offers a retry, not a 404, when the catalog cannot be loaded', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse({ stock: {}, catalog: EMPTY_CATALOG }))
  );
  renderProduct('frame-drum');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    /We couldn.t load this product right now/
  );
  expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();

  // The live catalog answers: this product does not exist.
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
});

it('caps the quantity at the per-order limit, counting what the cart already has', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ stock: {}, catalog: EMPTY_CATALOG }))
  );
  localStorage.setItem(
    'sattari-cart-v1',
    JSON.stringify([{ slug: 'cymbal-felts', size: null, color: null, quantity: 7 }])
  );
  renderProduct('cymbal-felts');
  await screen.findByRole('heading', { level: 1, name: 'Cymbal Felts' });
  expect(screen.getByText('Up to 10 per online order.')).toBeInTheDocument();

  const more = screen.getByRole('button', { name: 'Increase quantity' });
  for (let i = 0; i < 12; i += 1) fireEvent.click(more);
  expect(screen.getByRole('spinbutton')).toHaveValue(10);
  expect(more).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));
  expect(
    await screen.findByText(/Added 3\. 10 is the most one online order can include/)
  ).toBeInTheDocument();
  await waitFor(() => expect(storedCart()).toEqual([expect.objectContaining({ quantity: 10 })]));

  fireEvent.click(screen.getByRole('button', { name: /Add to Cart|Added/ }));
  expect(
    await screen.findByText(/Your cart already has 10\. 10 is the most one online order/)
  ).toBeInTheDocument();
  expect(storedCart()).toEqual([expect.objectContaining({ quantity: 10 })]);
});

it('shows the retry as busy while the catalog is asked again', async () => {
  const retry = deferred();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unavailable' }, 503))
      .mockImplementationOnce(() => retry.promise)
  );
  renderProduct('frame-drum');

  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

  const busy = screen.getByRole('button', { name: 'Trying again…' });
  expect(busy).toBeDisabled();
  expect(busy).toHaveAttribute('aria-busy', 'true');
  await act(async () => retry.resolve(jsonResponse({ error: 'Unavailable' }, 503)));
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeEnabled();
});
