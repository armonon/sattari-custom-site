import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  availableQuantity,
  hasAnyTracking,
  isProductSoldOut,
  isVariantOutOfStock,
  sanitizeStockMap,
} from '../utils/inventory';

const InventoryContext = createContext(null);

const INVENTORY_ENDPOINT = import.meta.env.VITE_INVENTORY_URL || '/api/inventory';

export function InventoryProvider({ children }) {
  const [stock, setStock] = useState({});
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async (signal) => {
    try {
      const response = await fetch(INVENTORY_ENDPOINT, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Inventory request failed: ${response.status}`);

      const payload = await response.json();
      setStock(sanitizeStockMap(payload?.stock));
      setStatus('ready');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // An empty map means "nothing is tracked", which reads as available
      // everywhere. A failed stock lookup must never make the shop look sold
      // out — the worst case is that badges disappear, not that sales stop.
      setStock({});
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const value = useMemo(
    () => ({
      stock,
      status,
      refresh,
      // Until the first response lands, treat everything as available so the
      // page does not flash "Out of stock" on a slow connection.
      isSoldOut: (product) => (status === 'loading' ? false : isProductSoldOut(stock, product)),
      isVariantSoldOut: (slug, size, color) =>
        status === 'loading' ? false : isVariantOutOfStock(stock, slug, size, color),
      quantityFor: (slug, size, color) => availableQuantity(stock, slug, size, color),
      isTracked: (product) => hasAnyTracking(stock, product),
    }),
    [stock, status, refresh]
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
