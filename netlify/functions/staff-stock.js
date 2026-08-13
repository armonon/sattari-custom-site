import { products } from '../../src/data/catalog.js';
import { listVariants, sanitizeStockMap, stockKey } from '../../src/utils/inventory.js';
import { readStock, updateStock } from '../../server/stockStore.js';
import { requireStaff } from '../../server/staffAuth.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

// Every purchasable variant in the catalog, so the staff page can render a row
// per item without duplicating the catalog shape in the browser.
function buildVariantRows(stock) {
  const rows = [];

  for (const product of products) {
    for (const variant of listVariants(product)) {
      const key = stockKey(product.slug, variant.size, variant.color);
      const tracked = Object.prototype.hasOwnProperty.call(stock, key);

      rows.push({
        key,
        slug: product.slug,
        name: product.name,
        category: product.category,
        size: variant.size,
        color: variant.color,
        tracked,
        quantity: tracked ? stock[key] : null,
      });
    }
  }

  return rows;
}

export async function handler(event) {
  const session = requireStaff(event);
  if (!session) {
    // Same response for a missing and an invalid token: no signal about which
    // part was wrong.
    return json(401, { error: 'Sign in to continue.' });
  }

  if (event.httpMethod === 'GET') {
    const stock = await readStock(event);
    return json(200, { staff: session.staff, items: buildVariantRows(stock) });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (!updates.length) {
    return json(400, { error: 'No changes were submitted.' });
  }

  // Only keys that correspond to a real catalog variant are accepted. Without
  // this, a malformed or hostile request could write arbitrary keys into the
  // stock blob, and untracking a typo'd key later is guesswork.
  const validKeys = new Set(
    products.flatMap((product) =>
      listVariants(product).map((variant) => stockKey(product.slug, variant.size, variant.color))
    )
  );

  const applied = [];
  const rejected = [];

  for (const update of updates) {
    const key = String(update?.key || '');
    if (!validKeys.has(key)) {
      rejected.push({ key, reason: 'unknown variant' });
      continue;
    }

    // null means "stop tracking this variant", which is different from zero:
    // zero hides it from the shop, untracked returns it to always-available.
    if (update.quantity === null) {
      applied.push({ key, quantity: null });
      continue;
    }

    const quantity = Number(update.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      rejected.push({ key, reason: 'quantity must be zero or more' });
      continue;
    }

    applied.push({ key, quantity: Math.trunc(quantity) });
  }

  if (!applied.length) {
    return json(400, { error: 'Nothing valid to save.', rejected });
  }

  try {
    const { stock } = await updateStock(event, (current) => {
      const next = { ...current };
      for (const change of applied) {
        if (change.quantity === null) {
          delete next[change.key];
        } else {
          next[change.key] = change.quantity;
        }
      }
      return sanitizeStockMap(next);
    });

    console.log(
      JSON.stringify({
        type: 'staff-stock-update',
        staff: session.staff,
        changed: applied.length,
      })
    );

    return json(200, { staff: session.staff, items: buildVariantRows(stock), rejected });
  } catch (error) {
    // updateStock throws only after losing the conditional-write race
    // repeatedly, which means someone else is editing at the same moment.
    return json(409, { error: error?.message || 'Could not save. Try again.' });
  }
}
