// Resolves the cart saved in the browser against the catalog the shop is
// showing: the base catalog merged with staff edits (see catalogMerge.js).
// create-checkout-session prices the order from that same merged catalog, so
// resolving here is what keeps the cart's prices equal to what Stripe charges.

import { buildCartKey, resolveSelectedOption } from '../data/catalog.js';

// Most of one item an online order may include: create-checkout-session
// refuses more (409 quantity_limit, MAX_UNITS_PER_VARIANT). A cart line is one
// variant, so capping each line keeps the cart within what checkout accepts.
export const MAX_LINE_QUANTITY = 10;

export function normalizeQuantity(quantity) {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(MAX_LINE_QUANTITY, Math.floor(value));
}

// A color the product does not offer (staff removed it, or it never existed) is
// cleared, as the server does.
function offeredColor(product, color) {
  if (!color) return null;
  return product.colors?.some((option) => option.name === color) ? color : null;
}

// Checkout refuses a product that comes in colors unless one of them is chosen
// (HTTP 409 `color_required`). Such a line stays in the cart, flagged, so the
// shopper can pick a color rather than lose the item.
export function needsColorChoice(product, entry) {
  return Boolean(product?.colors?.length) && !offeredColor(product, entry?.color);
}

function resolveEntry(entry, product) {
  const { size, unitPrice } = resolveSelectedOption(product, entry.size ?? null);
  if (typeof unitPrice !== 'number') return null;
  const color = offeredColor(product, entry.color);
  return {
    key: buildCartKey(entry.slug, size, color),
    size,
    color,
    unitPrice,
    needsColor: needsColorChoice(product, entry),
  };
}

function indexBySlug(products) {
  return new Map(products.map((product) => [product.slug, product]));
}

// Maps a stored entry to the key of the line it is displayed under. The key
// uses the resolved size, so an entry saved without one (a quick add of a
// sized product) still matches its line when it is updated or removed.
export function createEntryKeyResolver(products) {
  const bySlug = indexBySlug(products);
  return (entry) => {
    const product = bySlug.get(entry.slug);
    const resolved = product ? resolveEntry(entry, product) : null;
    return resolved ? resolved.key : buildCartKey(entry.slug, entry.size, entry.color);
  };
}

// Priced cart lines, plus the entries this catalog cannot price. Entries that
// resolve to the same product and options are shown as one line.
export function resolveCartLines(entries, products) {
  const bySlug = indexBySlug(products);
  const lines = [];
  const unresolved = [];

  for (const entry of entries) {
    const product = bySlug.get(entry.slug);
    const resolved = product ? resolveEntry(entry, product) : null;
    if (!resolved) {
      unresolved.push(entry);
      continue;
    }

    const existing = lines.find((line) => line.key === resolved.key);
    const quantity = normalizeQuantity(
      (existing?.quantity || 0) + normalizeQuantity(entry.quantity)
    );
    const line = {
      key: resolved.key,
      slug: entry.slug,
      size: resolved.size,
      color: resolved.color,
      needsColor: resolved.needsColor,
      quantity,
      product,
      unitPrice: resolved.unitPrice,
      lineTotal: resolved.unitPrice * quantity,
    };
    if (existing) lines[lines.indexOf(existing)] = line;
    else lines.push(line);
  }

  return { lines, unresolved };
}

// Brings stored entries in line with a fully loaded catalog: drops entries for
// products that are hidden or gone, stores the resolved size and color, and
// merges entries that now describe the same line. An entry whose color was
// removed is kept without one (see needsColorChoice). Only call this with the
// loaded catalog; the base catalog alone would drop staff-added products.
//
// Returns the same `entries` array when nothing changed.
export function reconcileCartEntries(entries, products) {
  const bySlug = indexBySlug(products);
  const next = [];
  const removed = [];
  let changed = false;

  for (const entry of entries) {
    const product = bySlug.get(entry.slug);
    const resolved = product ? resolveEntry(entry, product) : null;
    if (!resolved) {
      removed.push(entry);
      changed = true;
      continue;
    }

    const existing = next.find(
      (candidate) => buildCartKey(candidate.slug, candidate.size, candidate.color) === resolved.key
    );
    if (existing) {
      existing.quantity = normalizeQuantity(existing.quantity + normalizeQuantity(entry.quantity));
      changed = true;
      continue;
    }

    const normalized = {
      ...entry,
      size: resolved.size,
      color: resolved.color,
      quantity: normalizeQuantity(entry.quantity),
      name: product.name,
    };
    if (
      normalized.size !== (entry.size ?? null) ||
      normalized.color !== (entry.color ?? null) ||
      normalized.quantity !== entry.quantity ||
      normalized.name !== entry.name
    ) {
      changed = true;
    }
    next.push(normalized);
  }

  return { entries: changed ? next : entries, removed };
}
