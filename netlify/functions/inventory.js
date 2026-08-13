import { connectLambda, getStore } from '@netlify/blobs';
import { STOCK_BLOB_KEY, STOCK_STORE, sanitizeStockMap } from '../../src/utils/inventory.js';
import {
  CATALOG_BLOB_KEY,
  CATALOG_STORE,
  EMPTY_CATALOG_DOC,
  sanitizeCatalogDoc,
} from '../../src/utils/catalogMerge.js';

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

// Public and unauthenticated. Returns stock counts and the employee-edited
// catalog layer — both of which are already visible on the storefront. No
// costs, suppliers, or customer data pass through here.
//
// Stock and catalog are served together in one response so the storefront makes
// a single request and cannot end up rendering a product from one snapshot with
// stock from another.
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  let stock = {};
  let catalog = { ...EMPTY_CATALOG_DOC };
  let degraded = false;

  try {
    connectLambda(event);

    // Strong consistency, not the eventual default: an employee who sets a
    // count expects to see it on the storefront immediately, and a stale read
    // right after a sale is what allows overselling.
    const stockStore = getStore({ name: STOCK_STORE, consistency: 'strong' });
    const catalogStore = getStore({ name: CATALOG_STORE, consistency: 'strong' });

    const [rawStock, rawCatalog] = await Promise.all([
      stockStore.get(STOCK_BLOB_KEY, { type: 'json' }),
      catalogStore.get(CATALOG_BLOB_KEY, { type: 'json' }),
    ]);

    stock = sanitizeStockMap(rawStock);
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

  return json(200, { stock, catalog, degraded });
}
