import { products as baseProducts } from '../../src/data/catalog.js';
import {
  listVariants,
  reservedQuantities,
  sanitizeStockMap,
  stockKey,
} from '../../src/utils/inventory.js';
import { mergeCatalog } from '../../src/utils/catalogMerge.js';
import { isStockContention, readInventory, updateStock } from '../../server/stockStore.js';
import { readCatalogDoc } from '../../server/catalogStore.js';
import { errorMessage, logError, logEvent } from '../../server/log.js';
import { requireStaff } from '../../server/staffAuth.js';

// Stock rows come from the merged catalog, not the base file, so products an
// employee added are stockable and edited variants line up with what the shop
// is actually selling.
async function getProducts(event) {
  try {
    return mergeCatalog(baseProducts, await readCatalogDoc(event));
  } catch {
    return baseProducts;
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

// Every purchasable variant in the catalog, so the staff page can render a row
// per item without duplicating the catalog shape in the browser. `quantity` is
// the count on the shelf; `held` is how many of those are reserved by
// customers who are in checkout right now.
function buildVariantRows(stock, holds, products) {
  const reserved = reservedQuantities(holds, Date.now());
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
        held: tracked ? reserved[key] || 0 : 0,
      });
    }
  }

  return rows;
}

export async function handler(event) {
  const session = await requireStaff(event);
  if (!session) {
    // Same response for a missing and an invalid token: no signal about which
    // part was wrong.
    return json(401, { error: 'Sign in to continue.' });
  }

  const products = await getProducts(event);

  if (event.httpMethod === 'GET') {
    const { stock, holds } = await readInventory(event);
    return json(200, { staff: session.staff, items: buildVariantRows(stock, holds, products) });
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
    const { stock, holds } = await updateStock(event, (current) => {
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

    logEvent({ type: 'staff-stock-update', staff: session.staff, changed: applied.length });

    return json(200, {
      staff: session.staff,
      items: buildVariantRows(stock, holds, products),
      rejected,
    });
  } catch (error) {
    // Losing the conditional-write race repeatedly means someone else — staff
    // or a checkout — is changing stock at the same moment; anything else is
    // a storage failure.
    const conflict = isStockContention(error);
    logError(conflict ? 'staff-stock-update-conflict' : 'staff-stock-update-error', {
      staff: session.staff,
      message: errorMessage(error),
    });
    return conflict
      ? json(409, { error: 'Stock was changing while you saved. Reload and try again.' })
      : json(503, { error: 'Could not save right now. Reload and try again.' });
  }
}
