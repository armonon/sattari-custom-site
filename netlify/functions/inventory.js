import { availableStock } from '../../src/utils/inventory.js';
import {
  CATALOG_BLOB_KEY,
  CATALOG_STORE,
  EMPTY_CATALOG_DOC,
  sanitizeCatalogDoc,
} from '../../src/utils/catalogMerge.js';
import { isConsistencyDegraded, openStore } from '../../server/blobs.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';
import { readInventory } from '../../server/stockStore.js';

// A custom path replaces the default URL, so both are listed.
export const config = {
  path: ['/api/inventory', '/.netlify/functions/inventory'],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      // Stock is the one thing on this site that must never be stale: a cached
      // count is how you sell something you already sold. The payload is a few
      // hundred bytes, so there is nothing to gain by caching it anyway.
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export default async function inventory(request, context) {
  return webResponse(await handle(await lambdaEvent(request, context)));
}

// Public and unauthenticated. Returns stock counts and the employee-edited
// catalog layer — both of which are already visible on the storefront. No
// costs, suppliers, or customer data pass through here.
//
// Stock and catalog are served together in one response so the storefront makes
// a single request and cannot end up rendering a product from one snapshot with
// stock from another.
async function handle(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  let stock = {};
  let catalog = { ...EMPTY_CATALOG_DOC };
  let degraded = false;

  try {
    // Strong consistency, not the eventual default: an employee who sets a
    // count expects to see it on the storefront immediately, and a stale read
    // right after a sale is what allows overselling.
    const catalogStore = openStore(event, CATALOG_STORE);

    const [inventoryDoc, rawCatalog] = await Promise.all([
      readInventory(event),
      catalogStore.get(CATALOG_BLOB_KEY, { type: 'json' }),
    ]);

    // Units in someone else's open checkout are not for sale, so the badge
    // reads what checkout will actually accept.
    stock = availableStock(inventoryDoc.stock, inventoryDoc.holds, Date.now());
    if (rawCatalog) catalog = sanitizeCatalogDoc(rawCatalog);
  } catch (error) {
    // Degrade rather than fail the storefront. An empty stock map means every
    // variant reads as available and an empty catalog layer means the base
    // catalog renders — which is exactly how the site behaved before any of
    // this shipped. A blob outage costs badges and edits, never sales.
    degraded = true;
    console.error(
      JSON.stringify({ type: 'inventory-read-error', message: error?.message || String(error) })
    );
  }

  // Whether reads here were strongly consistent. A stale stock number is how
  // an out-of-stock item gets sold, so a fallback must not be invisible.
  const eventual = isConsistencyDegraded();
  return json(200, {
    stock,
    catalog,
    degraded,
    consistency: eventual ? 'eventual' : 'strong',
    eventualConsistency: eventual,
  });
}
