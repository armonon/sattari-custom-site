import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProductBySlug } from '../data/catalog';
import { useInventory } from './InventoryContext';
import {
  createEntryKeyResolver,
  normalizeQuantity,
  reconcileCartEntries,
  resolveCartLines,
} from '../utils/cartCatalog';

const STORAGE_KEY = 'sattari-cart-v1';

const CartContext = createContext(null);

function readStoredCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((entry) => entry && typeof entry.slug === 'string')
      : [];
  } catch {
    return [];
  }
}

function describeRemoved(entries) {
  const bySlug = new Map();
  for (const entry of entries) {
    if (!bySlug.has(entry.slug)) {
      // A hidden base product still has its name in the base catalog; a removed
      // staff-added product only has the name saved with the cart entry.
      bySlug.set(entry.slug, entry.name || getProductBySlug(entry.slug)?.name || null);
    }
  }
  return [...bySlug].map(([slug, name]) => ({ slug, name }));
}

export function CartProvider({ children }) {
  // The same merged catalog the shop renders and create-checkout-session
  // charges from, so the cart cannot show a price Stripe will not charge.
  const { products, status: catalogStatus, refresh } = useInventory();
  const [cart, setCart] = useState(readStoredCart);
  const [removedItems, setRemovedItems] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Full or blocked storage (private browsing) only costs persistence.
    }
  }, [cart]);

  // Until the catalog has loaded, only the base catalog is known. Pruning
  // against it would throw away every staff-added product in the cart, so
  // entries are only removed once the full catalog is in.
  useEffect(() => {
    if (catalogStatus !== 'ready') return;
    const { entries, removed } = reconcileCartEntries(cart, products);
    if (entries === cart) return;
    setCart((prev) => (prev === cart ? entries : reconcileCartEntries(prev, products).entries));
    if (!removed.length) return;
    setRemovedItems((prev) => {
      const additions = describeRemoved(removed).filter(
        (item) => !prev.some((existing) => existing.slug === item.slug)
      );
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [catalogStatus, products, cart]);

  const { lines: cartItems, unresolved } = useMemo(
    () => resolveCartLines(cart, products),
    [cart, products]
  );

  const subtotal = useMemo(
    () => cartItems.reduce((sum, line) => sum + line.lineTotal, 0),
    [cartItems]
  );

  const itemCount = useMemo(
    () => cartItems.reduce((sum, line) => sum + line.quantity, 0),
    [cartItems]
  );

  const keyOf = useMemo(() => createEntryKeyResolver(products), [products]);

  const addToCart = useCallback(
    ({ slug, size = null, color = null, quantity = 1 }) => {
      const safeQty = normalizeQuantity(quantity);
      const name = products.find((product) => product.slug === slug)?.name;
      const entry = { slug, size, color, quantity: safeQty, ...(name ? { name } : {}) };
      const key = keyOf(entry);

      setCart((prev) => {
        const existingIndex = prev.findIndex((candidate) => keyOf(candidate) === key);
        if (existingIndex === -1) return [...prev, entry];

        const next = [...prev];
        const existing = next[existingIndex];
        next[existingIndex] = {
          ...existing,
          quantity: normalizeQuantity(existing.quantity + safeQty),
        };
        return next;
      });
    },
    [keyOf, products]
  );

  const removeFromCart = useCallback(
    (key) => {
      setCart((prev) => prev.filter((entry) => keyOf(entry) !== key));
    },
    [keyOf]
  );

  const updateQuantity = useCallback(
    (key, quantity) => {
      const safeQty = Number(quantity);
      if (Number.isNaN(safeQty) || safeQty < 1) {
        removeFromCart(key);
        return;
      }

      setCart((prev) => {
        let updated = false;
        return prev.flatMap((entry) => {
          if (keyOf(entry) !== key) return [entry];
          // Two stored entries can resolve to one line; the line keeps one.
          if (updated) return [];
          updated = true;
          return [{ ...entry, quantity: normalizeQuantity(safeQty) }];
        });
      });
    },
    [keyOf, removeFromCart]
  );

  // Idempotent: clearing an empty cart keeps the same state, so callers that
  // clear from an effect do not cause another render.
  const clearCart = useCallback(() => {
    setCart((prev) => (prev.length ? [] : prev));
  }, []);

  const dismissRemovedItems = useCallback(() => {
    setRemovedItems((prev) => (prev.length ? [] : prev));
  }, []);

  const refreshCatalog = useCallback(() => refresh(), [refresh]);

  // Entries that cannot be priced yet (loading) or right now (the catalog
  // request failed). They stay saved, but are not shown or sent to checkout.
  const unavailableCount = catalogStatus === 'ready' ? 0 : unresolved.length;

  const value = useMemo(
    () => ({
      cartItems,
      itemCount,
      subtotal,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      catalogStatus,
      unavailableCount,
      refreshCatalog,
      removedItems,
      dismissRemovedItems,
    }),
    [
      cartItems,
      itemCount,
      subtotal,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      catalogStatus,
      unavailableCount,
      refreshCatalog,
      removedItems,
      dismissRemovedItems,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
