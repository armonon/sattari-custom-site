import {
  BACKUP_PREFIX,
  BACKUP_STORE,
  buildSnapshot,
  selectExpired,
  snapshotKey,
} from '../src/utils/backup.js';
import { STOCK_BLOB_KEY, STOCK_STORE } from '../src/utils/inventory.js';
import { CATALOG_BLOB_KEY, CATALOG_STORE } from '../src/utils/catalogMerge.js';
import { FULFILLMENT_BLOB_KEY, FULFILLMENT_STORE } from '../src/utils/fulfillment.js';
import { IMAGE_STORE } from './imageStore.js';
import { openStore } from './blobs.js';

// Reads every store directly rather than going through the typed helpers, so a
// snapshot captures exactly what is stored — including anything a future
// version writes that this code does not yet understand.
export async function captureSnapshot(event, reason = 'scheduled', at = Date.now()) {
  const stockStore = openStore(event, STOCK_STORE);
  const catalogStore = openStore(event, CATALOG_STORE);
  const fulfillmentStore = openStore(event, FULFILLMENT_STORE);
  const imageStore = openStore(event, IMAGE_STORE);

  const [stock, catalog, fulfillment, images] = await Promise.all([
    stockStore.get(STOCK_BLOB_KEY, { type: 'json' }).catch(() => null),
    catalogStore.get(CATALOG_BLOB_KEY, { type: 'json' }).catch(() => null),
    fulfillmentStore.get(FULFILLMENT_BLOB_KEY, { type: 'json' }).catch(() => null),
    imageStore.list().catch(() => ({ blobs: [] })),
  ]);

  return buildSnapshot({
    stock,
    catalog,
    fulfillment,
    imageKeys: (images?.blobs || []).map((blob) => blob.key),
    reason,
    at,
  });
}

export async function writeSnapshot(event, snapshot) {
  const store = openStore(event, BACKUP_STORE);
  const key = snapshotKey(snapshot.createdAt);
  await store.setJSON(key, snapshot);
  return key;
}

export async function listSnapshots(event) {
  const store = openStore(event, BACKUP_STORE);
  const { blobs } = await store.list({ prefix: BACKUP_PREFIX });
  return blobs.map((blob) => blob.key).sort().reverse();
}

export async function readSnapshot(event, key) {
  if (!key.startsWith(BACKUP_PREFIX)) return null;
  const store = openStore(event, BACKUP_STORE);
  return store.get(key, { type: 'json' });
}

export async function pruneSnapshots(event, keep) {
  const store = openStore(event, BACKUP_STORE);
  const { blobs } = await store.list({ prefix: BACKUP_PREFIX });
  const expired = selectExpired(
    blobs.map((blob) => blob.key),
    keep
  );

  for (const key of expired) {
    await store.delete(key).catch(() => {});
  }
  return expired.length;
}

// Overwrites live data. Callers must have taken a safety snapshot first —
// see staff-backup, which does exactly that so a mistaken restore is itself
// reversible.
export async function restoreSnapshot(event, snapshot) {
  const stockStore = openStore(event, STOCK_STORE);
  const catalogStore = openStore(event, CATALOG_STORE);
  const fulfillmentStore = openStore(event, FULFILLMENT_STORE);

  await Promise.all([
    stockStore.setJSON(STOCK_BLOB_KEY, snapshot.stock || {}),
    catalogStore.setJSON(CATALOG_BLOB_KEY, snapshot.catalog || {}),
    fulfillmentStore.setJSON(FULFILLMENT_BLOB_KEY, snapshot.fulfillment || {}),
  ]);
}
