import {
  BACKUP_PREFIX,
  BACKUP_STORE,
  buildSnapshot,
  reconcileRestoredFulfillment,
  reconcileRestoredStock,
  selectExpired,
  snapshotKey,
  splitStockForSnapshot,
} from '../src/utils/backup.js';
import { STOCK_BLOB_KEY, STOCK_STORE } from '../src/utils/inventory.js';
import { CATALOG_BLOB_KEY, CATALOG_STORE } from '../src/utils/catalogMerge.js';
import { FULFILLMENT_BLOB_KEY, FULFILLMENT_STORE } from '../src/utils/fulfillment.js';
import { IMAGE_STORE } from './imageStore.js';
import { openStore } from './blobs.js';
import { updateFulfillmentDoc } from './fulfillmentStore.js';
import { listOrders } from './orderStore.js';
import { updateInventory } from './stockStore.js';

// Reads every store directly rather than going through the typed helpers, so a
// snapshot captures exactly what is stored — including anything a future
// version writes that this code does not yet understand. The one exception is
// open checkout holds, which only mean something while their session is live.
//
// Any read failure fails the whole snapshot. A key that does not exist reads as
// null and is captured as empty, but a store that could not be read must not:
// an "empty" snapshot restored later would wipe the stock counts and catalog.
export async function captureSnapshot(
  event,
  reason = 'scheduled',
  at = Date.now(),
  kind = 'scheduled'
) {
  const stockStore = openStore(event, STOCK_STORE);
  const catalogStore = openStore(event, CATALOG_STORE);
  const fulfillmentStore = openStore(event, FULFILLMENT_STORE);
  const imageStore = openStore(event, IMAGE_STORE);

  const [rawStock, catalog, fulfillment, images] = await Promise.all([
    stockStore.get(STOCK_BLOB_KEY, { type: 'json' }),
    catalogStore.get(CATALOG_BLOB_KEY, { type: 'json' }),
    fulfillmentStore.get(FULFILLMENT_BLOB_KEY, { type: 'json' }),
    imageStore.list(),
  ]);

  const { stock, stockSales } = splitStockForSnapshot(rawStock);

  return buildSnapshot({
    stock,
    stockSales,
    catalog,
    fulfillment,
    imageKeys: (images?.blobs || []).map((blob) => blob.key),
    reason,
    at,
    kind,
  });
}

export async function writeSnapshot(event, snapshot) {
  const store = openStore(event, BACKUP_STORE);
  const key = snapshotKey(snapshot.createdAt, snapshot.kind);
  await store.setJSON(key, snapshot);
  return key;
}

export async function listSnapshots(event) {
  const store = openStore(event, BACKUP_STORE);
  const { blobs } = await store.list({ prefix: BACKUP_PREFIX });
  return blobs
    .map((blob) => blob.key)
    .sort()
    .reverse();
}

export async function readSnapshot(event, key) {
  if (!key.startsWith(BACKUP_PREFIX)) return null;
  const store = openStore(event, BACKUP_STORE);
  return store.get(key, { type: 'json' });
}

// Nightly and staff-taken snapshots are counted separately (see selectExpired).
export async function pruneSnapshots(event, keep, keepStaff) {
  const store = openStore(event, BACKUP_STORE);
  const { blobs } = await store.list({ prefix: BACKUP_PREFIX });
  const expired = selectExpired(
    blobs.map((blob) => blob.key),
    keep,
    keepStaff
  );

  for (const key of expired) {
    await store.delete(key).catch(() => {});
  }
  return expired.length;
}

// Overwrites the live catalog, restores stock reconciled against every sale
// since the snapshot (see reconcileRestoredStock), and restores fulfilment
// without touching orders the snapshot knows nothing about (see
// reconcileRestoredFulfillment). Callers must have taken a safety snapshot
// first — see staff-backup, which does exactly that so a mistaken restore is
// itself reversible.
//
// Stock goes first and through the conditional write every other stock writer
// uses, so a sale landing mid-restore is either counted or forces a retry; it
// is never overwritten. Open checkout holds are kept as they are. Fulfilment
// is written the same way, so an order marked shipped mid-restore is kept.
export async function restoreSnapshot(event, snapshot) {
  // Read before any write: if the orders cannot all be read, nothing is
  // restored. A sale in an unreadable order would go back on the shelf.
  const orders = await listOrders(event, { strict: true });

  let report = null;
  await updateInventory(event, (live) => {
    const reconciled = reconcileRestoredStock({ snapshot, live, orders, now: Date.now() });
    report = reconciled.report;
    return { stock: reconciled.stock, holds: live.holds };
  });

  let fulfillmentKept = [];
  const catalogStore = openStore(event, CATALOG_STORE);
  await Promise.all([
    catalogStore.setJSON(CATALOG_BLOB_KEY, snapshot.catalog || {}),
    updateFulfillmentDoc(event, (live) => {
      const reconciled = reconcileRestoredFulfillment({ snapshot, live, orders });
      fulfillmentKept = reconciled.kept;
      return reconciled.doc;
    }),
  ]);

  return { ...report, fulfillmentKept };
}
