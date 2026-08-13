// Stock tracking for the shop.
//
// Stock is tracked per purchasable VARIANT, not per product. A 15" and a 17"
// effect cymbal are different physical items, as are a black and a green
// practice pad. Tracking a single number per product would let a sold-out size
// stay buyable, which is the failure mode that costs money.
//
// Shared by the storefront, the checkout function, and the Stripe webhook so
// all three compute the same key for the same physical item.

export const STOCK_STORE = 'inventory';
export const STOCK_BLOB_KEY = 'stock';

const VARIANT_NONE = '';

// Stripe metadata values cannot be null, so create-checkout-session writes the
// literal string 'default' for an absent size or color. Both spellings have to
// collapse to the same key or the webhook would decrement a variant that the
// storefront never displays.
export function normalizeVariantPart(value) {
  if (value === null || value === undefined) return VARIANT_NONE;
  const text = String(value).trim();
  if (!text || text === 'default') return VARIANT_NONE;
  return text;
}

// Always three segments so the key is unambiguous: a product whose size is
// empty can never collide with one whose color is empty.
export function stockKey(slug, size = null, color = null) {
  return [String(slug ?? '').trim(), normalizeVariantPart(size), normalizeVariantPart(color)].join(
    '::'
  );
}

// Every purchasable combination of a product. Products with neither sizes nor
// colors have exactly one variant: the product itself.
export function listVariants(product) {
  const sizes = product?.sizes?.length ? product.sizes.map((option) => option.size) : [null];
  const colors = product?.colors?.length ? product.colors.map((option) => option.name) : [null];

  const variants = [];
  for (const size of sizes) {
    for (const color of colors) {
      variants.push({ size, color });
    }
  }
  return variants;
}

// Returns the tracked count, or null when this variant is not tracked at all.
//
// "Not tracked" is deliberately distinct from zero. When stock tracking first
// ships, no variant has an entry yet — if absence meant zero, all 26 products
// would read as sold out on deploy. Employees opt each variant in by setting a
// count, and everything else keeps behaving exactly as it does today.
export function getTrackedQuantity(stockMap, slug, size = null, color = null) {
  if (!stockMap || typeof stockMap !== 'object') return null;
  const value = stockMap[stockKey(slug, size, color)];
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

export function isTracked(stockMap, slug, size = null, color = null) {
  return getTrackedQuantity(stockMap, slug, size, color) !== null;
}

// Untracked variants are unlimited, so callers can compare against a quantity
// without special-casing.
export function availableQuantity(stockMap, slug, size = null, color = null) {
  const tracked = getTrackedQuantity(stockMap, slug, size, color);
  return tracked === null ? Number.POSITIVE_INFINITY : Math.max(0, tracked);
}

export function isVariantOutOfStock(stockMap, slug, size = null, color = null) {
  return availableQuantity(stockMap, slug, size, color) <= 0;
}

// A product is sold out only when every one of its variants is tracked AND at
// zero. One available size keeps the product buyable.
export function isProductSoldOut(stockMap, product) {
  if (!product) return false;
  return listVariants(product).every((variant) =>
    isVariantOutOfStock(stockMap, product.slug, variant.size, variant.color)
  );
}

// True when at least one variant is tracked, used to decide whether to show
// stock messaging at all.
export function hasAnyTracking(stockMap, product) {
  if (!product) return false;
  return listVariants(product).some((variant) =>
    isTracked(stockMap, product.slug, variant.size, variant.color)
  );
}

// Applies signed deltas to a stock map and returns a NEW map.
//
// Untracked variants are skipped rather than created: a sale tells us one unit
// left the building, not how many were there to begin with, and inventing a
// count of -1 would show a product as sold out on the strength of a guess.
export function applyStockDeltas(stockMap, deltas = []) {
  const next = { ...(stockMap || {}) };
  const skipped = [];

  for (const delta of deltas) {
    const key = stockKey(delta.slug, delta.size, delta.color);
    const current = next[key];

    if (typeof current !== 'number' || !Number.isFinite(current)) {
      skipped.push(key);
      continue;
    }

    next[key] = Math.max(0, Math.trunc(current) + Math.trunc(delta.delta || 0));
  }

  return { stock: next, skipped };
}

// Reports every cart line that asks for more than is available.
//
// Quantities are aggregated by variant first. The same variant can appear on
// two separate cart lines, and checking each line on its own would let 1 + 1
// both pass against a stock of 1 — the exact case a per-line check misses.
export function findStockShortfalls(stockMap, items = []) {
  const totals = new Map();

  for (const item of items) {
    const key = stockKey(item.slug, item.size, item.color);
    const entry = totals.get(key) || {
      slug: item.slug,
      size: item.size ?? null,
      color: item.color ?? null,
      name: item.name || item.slug,
      requested: 0,
    };
    entry.requested += Math.max(0, Math.trunc(Number(item.quantity) || 0));
    totals.set(key, entry);
  }

  const shortfalls = [];
  for (const entry of totals.values()) {
    const available = availableQuantity(stockMap, entry.slug, entry.size, entry.color);
    if (entry.requested > available) {
      shortfalls.push({
        ...entry,
        available: available === Number.POSITIVE_INFINITY ? null : available,
      });
    }
  }

  return shortfalls;
}

// Human-readable label for a variant, used in checkout error messages.
export function describeVariant({ name, slug, size, color }) {
  const variant = [size, color].filter(Boolean).join(', ');
  const label = name || slug;
  return variant ? `${label} (${variant})` : label;
}

// Validates a stock map coming from storage or from the staff page. Anything
// that is not a finite non-negative integer is dropped rather than trusted.
export function sanitizeStockMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const clean = {};
  for (const [key, value] of Object.entries(raw)) {
    // Number(null) is 0 and Number(true) is 1. Coercing blindly would turn a
    // null left by a bad write into a tracked count of zero, which reads as
    // "sold out" — a false negative that silently stops sales.
    if (typeof value !== 'number' && typeof value !== 'string') continue;
    if (typeof value === 'string' && value.trim() === '') continue;

    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      clean[key] = Math.trunc(numeric);
    }
  }
  return clean;
}
