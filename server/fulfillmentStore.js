import {
  FULFILLMENT_BLOB_KEY,
  FULFILLMENT_STORE,
  sanitizeFulfillmentDoc,
} from '../src/utils/fulfillment.js';
import { openStore } from './blobs.js';

// One document for every order's fulfilment state. At a shop's order volume
// this stays small, and a single blob means one read for the whole dashboard
// and an atomic conditional write for updates. If order counts ever reach the
// tens of thousands, this is the thing to split by key.
export function getFulfillmentStore(event) {
  return openStore(event, FULFILLMENT_STORE);
}

export async function readFulfillmentDoc(event) {
  const store = getFulfillmentStore(event);
  const raw = await store.get(FULFILLMENT_BLOB_KEY, { type: 'json' });
  return sanitizeFulfillmentDoc(raw);
}

// Two staff marking different orders at the same counter is the normal case,
// so a lost update here means an order silently reverts to unpacked. The
// conditional write makes the loser retry against the winner's result.
export async function updateFulfillmentDoc(event, mutate, { attempts = 5 } = {}) {
  const store = getFulfillmentStore(event);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await store.getWithMetadata(FULFILLMENT_BLOB_KEY, { type: 'json' });
    const doc = sanitizeFulfillmentDoc(current?.data);

    const next = mutate(doc);
    if (!next) return { doc, changed: false };

    const clean = sanitizeFulfillmentDoc(next);
    const result = current?.etag
      ? await store.setJSON(FULFILLMENT_BLOB_KEY, clean, { onlyIfMatch: current.etag })
      : await store.setJSON(FULFILLMENT_BLOB_KEY, clean, { onlyIfNew: true });

    if (result?.modified !== false) return { doc: clean, changed: true };
  }

  throw new Error('Someone else is updating orders right now. Try again.');
}
