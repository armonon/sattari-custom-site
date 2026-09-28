import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { InventoryProvider, useInventory } from './InventoryContext';
import { deferred } from '../test/deferred';

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// What the page was prerendered with: a staff price and a sold-out product.
const SNAPSHOT = {
  stock: { 'cymbal-felts::::': 0 },
  catalog: { overrides: { 'cymbal-felts': { price: 9.5 } }, added: [], hidden: [] },
};

function Felts() {
  const { productBySlug, isSoldOut, status } = useInventory();
  const felts = productBySlug('cymbal-felts');
  return (
    <p>
      {status} ${felts.price.toFixed(2)} {isSoldOut(felts) ? 'sold out' : 'available'}
    </p>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it('renders the prerendered snapshot first, without treating it as the live catalog', async () => {
  const live = deferred();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => live.promise)
  );

  render(
    <InventoryProvider initialInventory={SNAPSHOT}>
      <Felts />
    </InventoryProvider>
  );

  // Same prices and stock as the HTML, but still waiting for the live answer.
  expect(screen.getByText('loading $9.50 sold out')).toBeInTheDocument();

  await act(async () =>
    live.resolve(
      jsonResponse({
        stock: { 'cymbal-felts::::': 4 },
        catalog: { overrides: { 'cymbal-felts': { price: 11 } }, added: [], hidden: [] },
      })
    )
  );

  expect(screen.getByText('ready $11.00 available')).toBeInTheDocument();
});

it('keeps the prices and stock the page was built with when the live read fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ stock: {}, catalog: SNAPSHOT.catalog, degraded: true }))
  );

  render(
    <InventoryProvider initialInventory={SNAPSHOT}>
      <Felts />
    </InventoryProvider>
  );

  // Still sold out: a failed read is no news, not a restock.
  expect(await screen.findByText('error $9.50 sold out')).toBeInTheDocument();
});

it('keeps the last live answer when a later read fails', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      jsonResponse({
        stock: { 'cymbal-felts::::': 0 },
        catalog: { overrides: { 'cymbal-felts': { price: 11 } }, added: [], hidden: [] },
      })
    )
    .mockRejectedValueOnce(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetchMock);
  let inventory;
  function Capture() {
    inventory = useInventory();
    return null;
  }

  render(
    <InventoryProvider>
      <Felts />
      <Capture />
    </InventoryProvider>
  );
  expect(await screen.findByText('ready $11.00 sold out')).toBeInTheDocument();

  await act(() => inventory.refresh());

  expect(screen.getByText('error $11.00 sold out')).toBeInTheDocument();
});

it('without a snapshot (the app shell) shows the built-in catalog and no sold-out states while loading', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {}))
  );

  render(
    <InventoryProvider>
      <Felts />
    </InventoryProvider>
  );

  expect(screen.getByText('loading $6.99 available')).toBeInTheDocument();
});
