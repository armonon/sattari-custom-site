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
//
// A count cannot be stored below zero, so a decrement larger than the count is
// clamped — and reported in `oversold`, because a clamp nobody hears about is
// how a shop finds out it sold something it did not have.
export function applyStockDeltas(stockMap, deltas = []) {
  const next = { ...(stockMap || {}) };
  const skipped = [];
  const oversold = [];

  for (const delta of deltas) {
    const key = stockKey(delta.slug, delta.size, delta.color);
    const current = next[key];

    if (typeof current !== 'number' || !Number.isFinite(current)) {
      skipped.push(key);
      continue;
    }

    const target = Math.trunc(current) + Math.trunc(delta.delta || 0);
    if (target < 0) oversold.push({ key, requested: -Math.trunc(delta.delta), available: current });
    next[key] = Math.max(0, target);
  }

  return { stock: next, skipped, oversold };
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

// --- Checkout holds ---------------------------------------------------------
//
// A hold reserves units for an open Stripe Checkout session, so two customers
// can never both be sent to pay for the last one. Holds are stored inside the
// stock blob, under a key that cannot collide with a `slug::size::color` key,
// so a single conditional write covers counts and reservations together: a
// reservation, a sale, and a staff recount can never interleave into a state
// where two checkouts both own the same unit.
//
// sanitizeStockMap drops the field (its value is an object), so every reader
// that only wants counts keeps seeing a plain map.
//
// Hold states:
//   active  — reserved for an open checkout session
//   pending — checkout finished with a delayed payment method; still reserved
//   sold    — the sale came out of stock; kept as a tombstone so a redelivered
//             webhook recognises it instead of decrementing twice
// A released hold is simply deleted.

export const HOLDS_FIELD = '__holds';

// Stripe retries a webhook for up to three days; a week covers that and the
// maintenance sweep's own retries with room to spare.
export const SOLD_HOLD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// An expired hold stops reserving immediately. It is only kept so the sweep
// can ask Stripe whether that session was paid after all.
export const EXPIRED_HOLD_RETENTION_MS = 24 * 60 * 60 * 1000;

const HOLD_STATES = new Set(['active', 'pending', 'sold']);

function cleanHoldLines(lines) {
  if (!Array.isArray(lines)) return [];
  const clean = [];
  for (const line of lines) {
    const quantity = Math.trunc(Number(line?.quantity));
    if (typeof line?.key !== 'string' || !line.key) continue;
    if (!Number.isFinite(quantity) || quantity < 0) continue;
    clean.push({ key: line.key, quantity });
  }
  return clean;
}

export function sanitizeHolds(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const holds = {};
  for (const [id, hold] of Object.entries(raw)) {
    if (!hold || typeof hold !== 'object' || !HOLD_STATES.has(hold.state)) continue;
    holds[id] = { ...hold, lines: cleanHoldLines(hold.lines) };
  }
  return holds;
}

export function readInventoryDoc(raw) {
  return {
    stock: sanitizeStockMap(raw),
    holds: sanitizeHolds(raw && typeof raw === 'object' ? raw[HOLDS_FIELD] : null),
  };
}

export function buildInventoryDoc({ stock, holds }) {
  const doc = sanitizeStockMap(stock);
  if (holds && Object.keys(holds).length) doc[HOLDS_FIELD] = holds;
  return doc;
}

export function isHoldReserving(hold, now) {
  return (hold?.state === 'active' || hold?.state === 'pending') && Number(hold.expiresAt) > now;
}

export function reservedQuantities(holds, now, excludeId = null) {
  const reserved = {};
  for (const [id, hold] of Object.entries(holds || {})) {
    if (id === excludeId || !isHoldReserving(hold, now)) continue;
    for (const line of hold.lines) {
      reserved[line.key] = (reserved[line.key] || 0) + line.quantity;
    }
  }
  return reserved;
}

// What a customer can buy right now: tracked counts minus the units open
// checkouts are holding. Untracked variants stay absent, which reads as
// unlimited everywhere else in this module.
export function availableStock(stock, holds, now) {
  const reserved = reservedQuantities(holds, now);
  const available = {};
  for (const [key, count] of Object.entries(stock || {})) {
    available[key] = Math.max(0, count - (reserved[key] || 0));
  }
  return available;
}

// Collapses cart or order lines onto one entry per variant, carrying enough
// detail to name the item in a customer message or an owner alert.
export function aggregateStockLines(items = []) {
  const lines = new Map();

  for (const item of items) {
    const quantity = Math.max(0, Math.trunc(Number(item?.quantity) || 0));
    if (!item?.slug || !quantity) continue;

    const key = stockKey(item.slug, item.size, item.color);
    const line = lines.get(key) || {
      key,
      slug: item.slug,
      size: normalizeVariantPart(item.size) || null,
      color: normalizeVariantPart(item.color) || null,
      name: item.name || item.slug,
      quantity: 0,
    };
    line.quantity += quantity;
    lines.set(key, line);
  }

  return [...lines.values()];
}

export function pruneHolds(holds, now) {
  const next = {};
  for (const [id, hold] of Object.entries(holds || {})) {
    const keep =
      hold.state === 'sold'
        ? Number(hold.soldAt) > now - SOLD_HOLD_RETENTION_MS
        : Number(hold.expiresAt) > now - EXPIRED_HOLD_RETENTION_MS;
    if (keep) next[id] = hold;
  }
  return next;
}

function isTrackedKey(stock, key) {
  return Object.prototype.hasOwnProperty.call(stock, key);
}

// Opening a checkout takes no sign-in and reserves units for up to 46 minutes
// whether or not anyone pays. These bound what one address (`owner`, a keyed
// hash of it) can hold in open checkouts at once, so a script cannot take the
// whole shop off sale. A shopper starting over replaces their earlier hold
// rather than adding to it, and a completed checkout's hold no longer counts.
export const HOLD_BUDGET = { holdsPerOwner: 3, unitsPerOwner: 30 };

export function heldByOwner(holds, owner, now) {
  const held = { holds: 0, units: 0 };
  if (!owner) return held;
  for (const hold of Object.values(holds || {})) {
    if (hold?.owner !== owner || hold.state !== 'active' || !isHoldReserving(hold, now)) continue;
    held.holds += 1;
    held.units += hold.lines.reduce((total, line) => total + line.quantity, 0);
  }
  return held;
}

// Reserves `lines` for a new checkout. Returns the next document, or the
// shortfalls that prevented the reservation. Untracked lines are never held.
// With an `owner` and a `budget`, a reservation that would take that owner
// past the budget is refused with `overBudget`.
export function placeHold(
  doc,
  { holdId, lines, now, expiresAt, extra = {}, owner = null, budget = null }
) {
  const holds = { ...doc.holds };
  const available = availableStock(doc.stock, holds, now);

  const shortfalls = findStockShortfalls(available, lines).map((entry) => ({
    ...entry,
    onHand: doc.stock[stockKey(entry.slug, entry.size, entry.color)] ?? null,
  }));
  if (shortfalls.length) return { doc: null, shortfalls, held: false };

  const tracked = lines.filter((line) => isTrackedKey(doc.stock, line.key));
  if (!tracked.length) return { doc: null, shortfalls: [], held: false };

  if (owner && budget) {
    const held = heldByOwner(holds, owner, now);
    const units = tracked.reduce((total, line) => total + line.quantity, 0);
    if (held.holds >= budget.holdsPerOwner || held.units + units > budget.unitsPerOwner) {
      return { doc: null, shortfalls: [], held: false, overBudget: true };
    }
  }

  holds[holdId] = {
    ...extra,
    ...(owner ? { owner } : {}),
    state: 'active',
    lines: tracked.map(({ key, quantity }) => ({ key, quantity })),
    createdAt: now,
    expiresAt,
  };
  return { doc: { stock: doc.stock, holds }, shortfalls: [], held: true };
}

export function updateHold(doc, holdId, patch, { states = ['active', 'pending'] } = {}) {
  const hold = doc.holds[holdId];
  if (!hold || !states.includes(hold.state)) return null;
  return { stock: doc.stock, holds: { ...doc.holds, [holdId]: { ...hold, ...patch } } };
}

// A sold hold is never released. Callers that only know the shopper walked
// away pass `states: ['active']`, so a delayed payment's hold stays too.
export function releaseHold(doc, holdId, { states = ['active', 'pending'] } = {}) {
  const hold = doc.holds[holdId];
  if (!hold || !states.includes(hold.state)) return null;
  const holds = { ...doc.holds };
  delete holds[holdId];
  return { stock: doc.stock, holds };
}

// Keeps stock reserved while a delayed payment (a bank debit, say) settles. A
// hold that already lapsed is placed again if the units are still free; if
// they are not, the payment may still succeed and the sale path reports the
// shortfall then.
export function holdForPendingPayment(doc, { holdId, lines, now, expiresAt }) {
  const hold = doc.holds[holdId];
  if (hold?.state === 'sold') return null;

  if (isHoldReserving(hold, now)) {
    return updateHold(doc, holdId, {
      state: 'pending',
      expiresAt: Math.max(Number(hold.expiresAt), expiresAt),
    });
  }

  const holds = { ...doc.holds };
  delete holds[holdId];
  const placed = placeHold({ stock: doc.stock, holds }, { holdId, lines, now, expiresAt });
  if (!placed.doc) return null;
  placed.doc.holds[holdId].state = 'pending';
  return placed.doc;
}

// Takes a paid order's units out of stock, exactly once per hold. `lines` are
// one entry per variant, as aggregateStockLines produces.
//
// Units reserved by OTHER open checkouts are not available to this sale: if
// this order's own hold lapsed and someone else reserved the unit meanwhile,
// this order is the one reported as oversold, and the other customer's
// reservation stays intact. The count never goes below zero; any shortfall is
// returned in `oversold` for the owner to act on.
export function commitSale(doc, { holdId, lines, now, sessionId = null }) {
  const existing = doc.holds[holdId];
  if (existing?.state === 'sold') {
    return {
      doc: null,
      sale: {
        alreadyApplied: true,
        appliedAt: Number(existing.soldAt) || now,
        applied: existing.lines,
        oversold: Array.isArray(existing.oversold) ? existing.oversold : [],
        untracked: Array.isArray(existing.untracked) ? existing.untracked : [],
        soldOut: [],
      },
    };
  }

  const holds = { ...doc.holds };
  const reservedElsewhere = reservedQuantities(holds, now, holdId);
  const stock = { ...doc.stock };
  const applied = [];
  const oversold = [];
  const untracked = [];
  // Variants this sale emptied: what the storefront shows for them changes
  // from in stock to sold out.
  const soldOut = [];

  for (const line of lines) {
    if (!isTrackedKey(stock, line.key)) {
      untracked.push(line.key);
      continue;
    }

    const available = Math.max(0, stock[line.key] - (reservedElsewhere[line.key] || 0));
    const take = Math.min(line.quantity, available);
    stock[line.key] -= take;
    if (take) applied.push({ key: line.key, quantity: take });
    if (take && stock[line.key] === 0) soldOut.push(line.key);
    if (take < line.quantity) {
      oversold.push({
        key: line.key,
        slug: line.slug,
        size: line.size,
        color: line.color,
        name: line.name,
        requested: line.quantity,
        available,
      });
    }
  }

  const sale = { alreadyApplied: false, appliedAt: now, applied, oversold, untracked, soldOut };

  // Nothing held and nothing tracked: there is no count to protect, so there
  // is nothing to write.
  if (!existing && !applied.length && !oversold.length) return { doc: null, sale };

  holds[holdId] = { state: 'sold', soldAt: now, sessionId, lines: applied, oversold, untracked };
  return { doc: { stock, holds }, sale };
}
