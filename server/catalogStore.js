import {
  CATALOG_BLOB_KEY,
  CATALOG_STORE,
  EMPTY_CATALOG_DOC,
  sanitizeCatalogDoc,
} from '../src/utils/catalogMerge.js';
import { openStore, pauseBeforeRetry, writeIfUnchanged } from './blobs.js';

export function getCatalogStore(event) {
  return openStore(event, CATALOG_STORE);
}

export async function readCatalogDoc(event) {
  const store = getCatalogStore(event);
  const raw = await store.get(CATALOG_BLOB_KEY, { type: 'json' });
  return raw ? sanitizeCatalogDoc(raw) : { ...EMPTY_CATALOG_DOC };
}

// Same conditional-write pattern as the stock store: two employees editing at
// once must not silently overwrite each other, so the losing write re-reads and
// reapplies rather than clobbering.
export async function updateCatalogDoc(event, mutate, { attempts = 5 } = {}) {
  const store = getCatalogStore(event);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await store.getWithMetadata(CATALOG_BLOB_KEY, { type: 'json' });
    const doc = current?.data ? sanitizeCatalogDoc(current.data) : { ...EMPTY_CATALOG_DOC };

    const next = mutate(doc);
    if (!next) return { doc, changed: false };

    const clean = sanitizeCatalogDoc(next);
    if (await writeIfUnchanged(store, CATALOG_BLOB_KEY, clean, current)) {
      return { doc: clean, changed: true };
    }
    if (attempt + 1 < attempts) await pauseBeforeRetry(attempt);
  }

  throw new Error('The catalog is being edited by someone else. Try again.');
}
