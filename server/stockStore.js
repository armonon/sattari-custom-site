import { STOCK_BLOB_KEY, STOCK_STORE, sanitizeStockMap } from '../src/utils/inventory.js';
import { openStore } from './blobs.js';

// Strong consistency rather than the eventual default. A stale read here is
// precisely how you sell the last item twice.
export function getStockStore(event) {
  return openStore(event, STOCK_STORE);
}

export async function readStock(event) {
  const store = getStockStore(event);
  const raw = await store.get(STOCK_BLOB_KEY, { type: 'json' });
  return sanitizeStockMap(raw);
}

// Read-modify-write guarded by a conditional write.
//
// Two writers can always interleave between the read and the write — the
// webhook decrementing a sale while an employee sets a count, for instance.
// `onlyIfMatch` makes the second write fail instead of silently discarding the
// first, and we re-read and retry rather than clobber.
//
// `mutate` receives the current map and returns the next one, or null to abort
// without writing.
export async function updateStock(event, mutate, { attempts = 5 } = {}) {
  const store = getStockStore(event);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await store.getWithMetadata(STOCK_BLOB_KEY, { type: 'json' });
    const stock = sanitizeStockMap(current?.data);

    const next = mutate(stock);
    if (!next) {
      return { stock, changed: false };
    }

    const result = current?.etag
      ? await store.setJSON(STOCK_BLOB_KEY, next, { onlyIfMatch: current.etag })
      : await store.setJSON(STOCK_BLOB_KEY, next, { onlyIfNew: true });

    // `modified: false` means another writer got there first. Re-read and
    // reapply the change against their result instead of overwriting it.
    if (result?.modified !== false) {
      return { stock: next, changed: true };
    }
  }

  throw new Error('Stock is being updated by someone else. Try again.');
}
