import {
  STOCK_BLOB_KEY,
  STOCK_STORE,
  availableStock,
  buildInventoryDoc,
  commitSale,
  holdForPendingPayment,
  placeHold,
  pruneHolds,
  readInventoryDoc,
  releaseHold,
  updateHold,
} from '../src/utils/inventory.js';
import { openStore } from './blobs.js';

// Strong consistency rather than the eventual default. A stale read here is
// precisely how you sell the last item twice.
export function getStockStore(event) {
  return openStore(event, STOCK_STORE);
}

export const STOCK_CONTENTION = 'STOCK_CONTENTION';

export function isStockContention(error) {
  return error?.code === STOCK_CONTENTION;
}

// Counts and checkout holds, from the one blob that stores both.
export async function readInventory(event) {
  const store = getStockStore(event);
  return readInventoryDoc(await store.get(STOCK_BLOB_KEY, { type: 'json' }));
}

export async function readStock(event) {
  return (await readInventory(event)).stock;
}

// What customers may buy: counts minus units held by open checkouts.
export async function readAvailableStock(event, now = Date.now()) {
  const { stock, holds } = await readInventory(event);
  return availableStock(stock, holds, now);
}

// Read-modify-write guarded by a conditional write.
//
// Two writers can always interleave between the read and the write — the
// webhook decrementing a sale while an employee sets a count, for instance.
// `onlyIfMatch` makes the second write fail instead of silently discarding the
// first, and we re-read and retry rather than clobber.
//
// `mutate` receives `{ stock, holds }` and returns the next document, or null
// to abort without writing. It may run more than once.
export async function updateInventory(event, mutate, { attempts = 5 } = {}) {
  const store = getStockStore(event);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await store.getWithMetadata(STOCK_BLOB_KEY, { type: 'json' });
    const doc = readInventoryDoc(current?.data);

    const next = mutate(doc);
    if (!next) {
      return { doc, changed: false };
    }

    // Every write drops long-dead holds and old sold markers, so the document
    // stays small whether or not the maintenance sweep is running.
    const body = buildInventoryDoc({
      stock: next.stock,
      holds: pruneHolds(next.holds, Date.now()),
    });
    const result = current?.etag
      ? await store.setJSON(STOCK_BLOB_KEY, body, { onlyIfMatch: current.etag })
      : await store.setJSON(STOCK_BLOB_KEY, body, { onlyIfNew: true });

    // `modified: false` means another writer got there first. Re-read and
    // reapply the change against their result instead of overwriting it.
    if (result?.modified !== false) {
      return { doc: next, changed: true };
    }
  }

  throw Object.assign(new Error('Stock is being updated by someone else. Try again.'), {
    code: STOCK_CONTENTION,
  });
}

// Counts only. Holds pass through untouched, so a staff recount can never
// cancel a customer's reservation.
export async function updateStock(event, mutate, options) {
  const { doc, changed } = await updateInventory(
    event,
    (current) => {
      const stock = mutate(current.stock);
      return stock ? { stock, holds: current.holds } : null;
    },
    options
  );
  return { stock: doc.stock, holds: doc.holds, changed };
}

// Reserves a checkout's units. `{ held: false, shortfalls: [] }` means nothing
// in the cart is tracked, so there was nothing to reserve.
//
// `replaces` is the hold of a checkout the same shopper abandoned, already
// expired at Stripe. Releasing it in the same write as the new hold hands its
// units straight to this checkout instead of putting them back on sale first.
// It is released even when the new reservation falls short: nothing can be
// paid against it any more.
export async function reserveStock(event, { holdId, lines, expiresAt, extra, replaces = null }) {
  let outcome = { held: false, shortfalls: [] };

  await updateInventory(event, (doc) => {
    const released = replaces ? releaseHold(doc, replaces, { states: ['active'] }) : null;
    const placed = placeHold(released || doc, {
      holdId,
      lines,
      now: Date.now(),
      expiresAt,
      extra,
    });
    outcome = { held: placed.held, shortfalls: placed.shortfalls };
    return placed.doc || released;
  });

  return outcome;
}

export async function patchStockHold(event, holdId, patch) {
  const { changed } = await updateInventory(event, (doc) => updateHold(doc, holdId, patch));
  return changed;
}

export async function releaseStockHold(event, holdId, options) {
  const { changed } = await updateInventory(event, (doc) => releaseHold(doc, holdId, options));
  return changed;
}

export async function holdStockForPendingPayment(event, { holdId, lines, expiresAt }) {
  const { changed } = await updateInventory(event, (doc) =>
    holdForPendingPayment(doc, { holdId, lines, now: Date.now(), expiresAt })
  );
  return changed;
}

// Converts a paid order's hold into a sale. Idempotent: the sold tombstone is
// written in the same conditional write as the decrement, so a retry — or a
// duplicate delivery racing this one — finds it and changes nothing.
export async function commitStockSale(event, { holdId, lines, sessionId }) {
  let sale = null;

  await updateInventory(event, (doc) => {
    const result = commitSale(doc, { holdId, lines, now: Date.now(), sessionId });
    sale = result.sale;
    return result.doc;
  });

  return sale;
}

// Prunes even when nothing else is writing. Writes only when something changed.
export async function pruneStockHolds(event) {
  const { changed } = await updateInventory(event, (doc) => {
    const holds = pruneHolds(doc.holds, Date.now());
    return Object.keys(holds).length === Object.keys(doc.holds).length
      ? null
      : { stock: doc.stock, holds };
  });
  return changed;
}
