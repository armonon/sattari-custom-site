import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getProductBySlug, resolveSelectedOption } from '../data/catalog';

const STORAGE_KEY = 'sattari-cart-v1';

const CartContext = createContext(null);

function normalizeQuantity(quantity) {
  const value = Number(quantity);
  if (Number.isNaN(value) || value < 1) return 1;
  return Math.min(99, Math.floor(value));
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const cartItems = useMemo(() => {
    return cart
      .map((entry) => {
        const product = getProductBySlug(entry.slug);
        if (!product) return null;

        const { size, unitPrice } = resolveSelectedOption(product, entry.size);
        if (typeof unitPrice !== 'number') return null;

        return {
          key: `${entry.slug}::${size || 'default'}`,
          slug: entry.slug,
          size,
          quantity: normalizeQuantity(entry.quantity),
          product,
          unitPrice,
          lineTotal: unitPrice * normalizeQuantity(entry.quantity),
        };
      })
      .filter(Boolean);
  }, [cart]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, line) => sum + line.lineTotal, 0),
    [cartItems]
  );

  const itemCount = useMemo(
    () => cartItems.reduce((sum, line) => sum + line.quantity, 0),
    [cartItems]
  );

  function addToCart({ slug, size = null, quantity = 1 }) {
    const safeQty = normalizeQuantity(quantity);
    const key = `${slug}::${size || 'default'}`;

    setCart((prev) => {
      const existingIndex = prev.findIndex((entry) => `${entry.slug}::${entry.size || 'default'}` === key);
      if (existingIndex === -1) {
        return [...prev, { slug, size, quantity: safeQty }];
      }

      const next = [...prev];
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        quantity: normalizeQuantity(existing.quantity + safeQty),
      };
      return next;
    });
  }

  function updateQuantity(key, quantity) {
    const safeQty = Number(quantity);
    if (Number.isNaN(safeQty) || safeQty < 1) {
      removeFromCart(key);
      return;
    }

    setCart((prev) =>
      prev.map((entry) => {
        const entryKey = `${entry.slug}::${entry.size || 'default'}`;
        if (entryKey !== key) return entry;
        return { ...entry, quantity: normalizeQuantity(safeQty) };
      })
    );
  }

  function removeFromCart(key) {
    setCart((prev) => prev.filter((entry) => `${entry.slug}::${entry.size || 'default'}` !== key));
  }

  function clearCart() {
    setCart([]);
  }

  const value = {
    cartItems,
    itemCount,
    subtotal,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
