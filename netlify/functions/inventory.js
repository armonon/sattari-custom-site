import { connectLambda, getStore } from '@netlify/blobs';
import { STOCK_BLOB_KEY, STOCK_STORE, sanitizeStockMap } from '../../src/utils/inventory.js';

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

// Public, unauthenticated: this returns only stock counts, which are already
// visible on the storefront as in/out of stock. No prices, costs, or customer
// data pass through here.
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    connectLambda(event);
    // Strong consistency, not the eventual default: an employee who sets a
    // count expects to see it on the storefront immediately, and a stale read
    // right after a sale is what allows overselling.
    const store = getStore({ name: STOCK_STORE, consistency: 'strong' });
    const raw = await store.get(STOCK_BLOB_KEY, { type: 'json' });

    return json(200, { stock: sanitizeStockMap(raw) });
  } catch (error) {
    // Degrade to "nothing is tracked" rather than failing the storefront. An
    // empty map means every variant reads as available, which is exactly how
    // the site behaves today, so a blob outage costs stock badges — not sales.
    console.error(
      JSON.stringify({ type: 'inventory-read-error', message: error?.message || String(error) })
    );
    return json(200, { stock: {}, degraded: true });
  }
}
