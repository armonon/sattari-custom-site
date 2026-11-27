import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ShopPage from './ShopPage';
import { CartProvider } from '../context/CartContext';
import { InventoryProvider } from '../context/InventoryContext';

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('sends products that come in colors to their page instead of adding them without one', async () => {
  // Staff gave the felts colors, so the featured row has a colored product.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jsonResponse({
        stock: {},
        catalog: {
          overrides: {
            'cymbal-felts': {
              colors: [
                { name: 'Black', hex: '#111111' },
                { name: 'Red', hex: '#d21f2a' },
              ],
            },
          },
          added: [],
          hidden: [],
        },
      })
    )
  );
  await act(async () => {
    render(
      <HelmetProvider>
        <InventoryProvider>
          <CartProvider>
            <MemoryRouter>
              <ShopPage />
            </MemoryRouter>
          </CartProvider>
        </InventoryProvider>
      </HelmetProvider>
    );
  });

  fireEvent.click(screen.getByRole('button', { name: 'Show more products' }));
  fireEvent.click(screen.getByRole('button', { name: 'Feature Cymbal Felts' }));
  const chooseColor = await screen.findByRole(
    'link',
    { name: 'Choose a color for Cymbal Felts' },
    { timeout: 5000 }
  );
  expect(chooseColor).toHaveAttribute('href', '/product/cymbal-felts');
  expect(screen.queryByRole('button', { name: 'Add Cymbal Felts to cart' })).toBeNull();

  // A product without colors is still added straight from the shop.
  fireEvent.click(screen.getByRole('button', { name: 'Feature Pirouz Series Cymbals' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Pirouz Series Cymbals to cart' }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('sattari-cart-v1'))).toEqual([
      expect.objectContaining({ slug: 'pirouz-series-cymbals', color: null, quantity: 1 }),
    ])
  );
}, 15000);

it('shows a varied featured selection with current prices and sold-out controls', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {}))
  );
  render(
    <HelmetProvider>
      <InventoryProvider
        initialInventory={{ stock: { 'pirouz-series-cymbals::::': 0 }, catalog: {} }}
      >
        <CartProvider>
          <MemoryRouter>
            <ShopPage />
          </MemoryRouter>
        </CartProvider>
      </InventoryProvider>
    </HelmetProvider>
  );
  const catalog = screen.getByRole('region', { name: 'Featured products' });
  const rows = within(catalog).getAllByRole('button', { name: /^Feature / });
  expect(rows).toHaveLength(4);
  expect(rows[0]).toHaveAccessibleName('Feature Pirouz Series Cymbals');
  expect(rows[0]).toHaveAttribute('aria-pressed', 'true');
  expect(
    within(catalog).getByRole('heading', { name: 'Pirouz Series Cymbals' })
  ).toBeInTheDocument();
  expect(within(catalog).getAllByText('$80.00')).toHaveLength(2);
  expect(
    within(catalog).getByRole('button', { name: 'Pirouz Series Cymbals is out of stock' })
  ).toBeDisabled();
  fireEvent.click(rows[1]);
  expect(
    within(catalog).getByRole('heading', { name: 'CREMONA - Handmade Acoustic Violin' })
  ).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '3D guitar wall' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Explore the 3D guitar wall' }));
  expect(screen.getByRole('region', { name: '3D guitar wall' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to featured products' }));
  expect(screen.queryByRole('region', { name: '3D guitar wall' })).toBeNull();
}, 15000);
