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

  const chooseColor = await screen.findByRole(
    'link',
    { name: 'Choose a color for Cymbal Felts' },
    { timeout: 5000 }
  );
  expect(chooseColor).toHaveAttribute('href', '/product/cymbal-felts');
  expect(screen.queryByRole('button', { name: 'Add Cymbal Felts to cart' })).toBeNull();

  // A product without colors is still added straight from the shop.
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
  const catalog = screen.getByRole('region', { name: 'Ready to play' });
  const cards = within(catalog).getAllByRole('article');
  expect(cards).toHaveLength(10);
  expect(cards.slice(0, 4).map((card) => within(card).getByRole('heading').textContent)).toEqual([
    'Pirouz Series Cymbals',
    'CREMONA - Handmade Acoustic Violin',
    '5 String Bass Guitar',
    '4 Pairs of Drumsticks +FREE BAG',
  ]);
  expect(within(cards[0]).getByText('$80.00')).toBeInTheDocument();
  expect(
    within(cards[0]).getByText('Out of stock', { selector: '.shop-featured-stock' })
  ).toBeInTheDocument();
  const soldOut = within(cards[0]).getByRole('button', {
    name: 'Pirouz Series Cymbals is out of stock',
  });
  expect(soldOut).toBeDisabled();
  fireEvent.click(soldOut);
  expect(JSON.parse(localStorage.getItem('sattari-cart-v1') || '[]')).toEqual([]);
  expect(within(cards[1]).getByRole('img')).toHaveAttribute(
    'alt',
    'CREMONA - Handmade Acoustic Violin'
  );
}, 15000);
