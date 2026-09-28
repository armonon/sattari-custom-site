import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  availableQuantity,
  hasAnyTracking,
  isProductSoldOut,
  isVariantOutOfStock,
  sanitizeStockMap,
} from '../utils/inventory';
import { products as baseProducts } from '../data/catalog';
import { EMPTY_CATALOG_DOC, mergeCatalog } from '../utils/catalogMerge';

const InventoryContext = createContext(null);

const INVENTORY_ENDPOINT = import.meta.env.VITE_INVENTORY_URL || '/api/inventory';

// `initialInventory` is the inventory a prerendered page was built with (see
// scripts/prerender.mjs). Rendering from it makes the first client render
// match the HTML, so prices and sold-out states do not flicker while the live
// request below runs. It is never treated as final: products staff added since
// the build are missing from it, so `status` stays 'loading' until the live
// response arrives ('ready') or fails ('error').
/**
 * @param {{
 *   children?: import('react').ReactNode,
 *   initialInventory?: { stock?: object, catalog?: object } | null,
 * }} props
 */
export function InventoryProvider({ children, initialInventory = null }) {
  const [snapshot] = useState(() =>
    initialInventory && typeof initialInventory === 'object'
      ? {
          stock: sanitizeStockMap(initialInventory.stock),
          catalog: initialInventory.catalog || EMPTY_CATALOG_DOC,
        }
      : null
  );
  const [stock, setStock] = useState(() => snapshot?.stock ?? {});
  const [catalogDoc, setCatalogDoc] = useState(() => snapshot?.catalog ?? EMPTY_CATALOG_DOC);
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async (signal) => {
    // A failed read keeps the last known stock and catalog: the ones this
    // page was built with, or the last live answer. Throwing them away would
    // turn an item that is sold out back into "Add to Cart" (checkout still
    // refuses it) and change prices under the reader. Without either, the
    // stock map stays empty ("nothing tracked", so nothing reads as sold out)
    // and the built-in catalog shows.
    // Applied as a transition: the first answer usually arrives while React
    // is still hydrating the page, and an urgent context change then would
    // make it discard the server HTML (see ThemeContext).
    const fail = () => startTransition(() => setStatus('error'));
    try {
      const response = await fetch(INVENTORY_ENDPOINT, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Inventory request failed: ${response.status}`);

      const payload = await response.json();
      // A degraded response is the server's read failing: it must not be
      // mistaken for the complete catalog (the cart prunes against a ready one).
      if (payload?.degraded) {
        fail();
        return;
      }
      startTransition(() => {
        setStock(sanitizeStockMap(payload?.stock));
        setCatalogDoc(payload?.catalog || EMPTY_CATALOG_DOC);
        setStatus('ready');
      });
    } catch (error) {
      if (error?.name === 'AbortError') return;
      fail();
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  // The base catalog renders immediately and employee edits are layered on when
  // they arrive, so a slow or failed request shows today's shop rather than an
  // empty one.
  const products = useMemo(() => mergeCatalog(baseProducts, catalogDoc), [catalogDoc]);

  // Stock is known from the build snapshot, or once the live request is done.
  // Until then everything reads as available, so the page does not flash
  // "Out of stock" on a slow connection.
  const stockKnown = status !== 'loading' || Boolean(snapshot);

  const value = useMemo(
    () => ({
      stock,
      status,
      refresh,
      products,
      isSoldOut: (product) => (stockKnown ? isProductSoldOut(stock, product) : false),
      isVariantSoldOut: (slug, size, color) =>
        stockKnown ? isVariantOutOfStock(stock, slug, size, color) : false,
      quantityFor: (slug, size, color) => availableQuantity(stock, slug, size, color),
      isTracked: (product) => hasAnyTracking(stock, product),
      productBySlug: (slug) => products.find((product) => product.slug === slug) || null,
    }),
    [stock, status, stockKnown, refresh, products]
  );

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
}
