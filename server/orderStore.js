import { getOrderStoreKey } from '../src/utils/orderProcessing.js';
import { eachLimited, openStore, pauseBeforeRetry, writeIfUnchanged } from './blobs.js';
import { errorMessage, logError } from './log.js';

export const ORDER_STORE = 'orders';
const ORDER_PREFIX = 'orders/';

// One small marker per order that still has work outstanding (stock not yet
// applied, owner email not yet sent, a delayed payment not yet settled). The
// maintenance sweep lists these instead of reading every order ever placed.
const WORK_PREFIX = 'outbox/';

export function getOrderStore(event) {
  return openStore(event, ORDER_STORE);
}

export async function readOrder(event, orderId) {
  return getOrderStore(event).get(getOrderStoreKey(orderId), { type: 'json' });
}

// The claim. Exactly one delivery of a given checkout session creates its
// record; every other concurrent or later delivery gets `false` and continues
// from whatever that record says is left to do.
export async function createOrder(event, record) {
  return writeIfUnchanged(getOrderStore(event), getOrderStoreKey(record.id), record, null);
}

// Conditional read-modify-write, same discipline as the stock store. `mutate`
// receives the current record (or null) and returns the next one, or null to
// leave it untouched.
export async function updateOrder(event, orderId, mutate, { attempts = 8 } = {}) {
  const store = getOrderStore(event);
  const key = getOrderStoreKey(orderId);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await store.getWithMetadata(key, { type: 'json' });
    const record = current?.data ?? null;

    const next = mutate(record);
    if (!next) return { record, changed: false };

    if (await writeIfUnchanged(store, key, next, current)) return { record: next, changed: true };
    if (attempt + 1 < attempts) await pauseBeforeRetry(attempt);
  }

  throw new Error(`Order ${orderId} is being updated concurrently.`);
}

// `strict` makes one unreadable order fail the whole list. A restore needs
// that: an order it cannot see is a sale it would put back on the shelf.
export async function listOrders(event, { strict = false } = {}) {
  const store = getOrderStore(event);
  const { blobs } = await store.list({ prefix: ORDER_PREFIX });

  const read = (key) => store.get(key, { type: 'json' });
  const records = (
    await Promise.all(
      blobs.map((blob) => (strict ? read(blob.key) : read(blob.key).catch(() => null)))
    )
  ).filter(Boolean);

  records.sort(
    (left, right) =>
      new Date(right.recordedAt || right.submittedAt || 0).getTime() -
      new Date(left.recordedAt || left.submittedAt || 0).getTime()
  );

  return records;
}

// Parked orders (see sweepCheckouts) are also indexed here, so the Orders tab
// lists every one of them without reading every work marker.
const PARKED_PREFIX = 'parked/';

// Marking replaces whatever the marker said before, so a fresh event for an
// order clears an earlier failure count and any parking.
export async function markOrderWork(event, orderId, details = {}) {
  const store = getOrderStore(event);
  await store.setJSON(`${WORK_PREFIX}${orderId}`, {
    orderId,
    markedAt: Date.now(),
    ...details,
  });
  const { parked, parkedAt, failures, lastError } = details;
  await syncParkedIndex(store, orderId, parked ? { orderId, parkedAt, failures, lastError } : null);
}

// The index only drives the Orders tab list, so failing to update it must not
// fail the order work that triggered it; the next update corrects it.
async function syncParkedIndex(store, orderId, entry) {
  try {
    if (entry) await store.setJSON(`${PARKED_PREFIX}${orderId}`, entry);
    else await store.delete(`${PARKED_PREFIX}${orderId}`);
  } catch (error) {
    logError('parked-order-index-error', { sessionId: orderId, message: errorMessage(error) });
  }
}

export async function readOrderWork(event, orderId) {
  return getOrderStore(event).get(`${WORK_PREFIX}${orderId}`, { type: 'json' });
}

export async function clearOrderWork(event, orderId) {
  const store = getOrderStore(event);
  await store.delete(`${WORK_PREFIX}${orderId}`);
  await syncParkedIndex(store, orderId, null);
}

// Ids of every recorded order, from one listing rather than a read per order.
export async function listOrderIds(event) {
  const { blobs } = await getOrderStore(event).list({ prefix: ORDER_PREFIX });
  return blobs
    .map((blob) => blob.key.slice(ORDER_PREFIX.length).replace(/\.json$/, ''))
    .filter(Boolean);
}

export async function listOrderWork(event) {
  const { blobs } = await getOrderStore(event).list({ prefix: WORK_PREFIX });
  return blobs.map((blob) => blob.key.slice(WORK_PREFIX.length)).filter(Boolean);
}

// An unreadable marker still names an order to check, so it reads as empty.
function readEach(store, keys) {
  return eachLimited(keys, (key) => store.get(key, { type: 'json' }).catch(() => ({})));
}

function dueAt(marker) {
  return Number(marker.nextCheckAt) || Number(marker.markedAt) || 0;
}

// Every work marker, oldest (soonest due) first, for the sweep to take in
// order; `total` is how many exist. Past `limit` markers — a backlog far beyond
// anything normal — a window of `limit` keys is read, moving on by `limit`
// every ten minutes, so each marker is still read within a few runs rather
// than the same ones every time.
export async function readOrderWorkQueue(event, { limit = 500, now = Date.now() } = {}) {
  const store = getOrderStore(event);
  const ids = (await listOrderWork(event)).sort();
  const total = ids.length;
  let window = ids;
  if (total > limit) {
    const start = (Math.floor(now / 600000) * limit) % total;
    window = [...ids.slice(start), ...ids.slice(0, start)].slice(0, limit);
  }
  // An unreadable marker still names an order to check; a missing one was
  // cleared since the listing.
  const read = await readEach(
    store,
    window.map((orderId) => `${WORK_PREFIX}${orderId}`)
  );
  const markers = window
    .map((orderId, index) => (read[index] ? { ...read[index], orderId } : null))
    .filter(Boolean)
    .sort((left, right) => dueAt(left) - dueAt(right) || left.orderId.localeCompare(right.orderId));
  return { markers, total };
}

// Orders the sweep parked, longest parked first, for the Orders tab.
export async function readParkedOrders(event) {
  const store = getOrderStore(event);
  const { blobs } = await store.list({ prefix: PARKED_PREFIX });
  const keys = blobs.map((blob) => blob.key).sort();
  const read = await readEach(store, keys);
  const orders = keys
    .map((key, index) => ({ ...read[index], orderId: key.slice(PARKED_PREFIX.length) }))
    .sort(
      (left, right) =>
        String(left.parkedAt || '').localeCompare(String(right.parkedAt || '')) ||
        left.orderId.localeCompare(right.orderId)
    );
  return { orders, total: orders.length };
}

// Stops retrying a parked order (a test-mode session left over after going
// live, say). Refuses an order that is not parked: that one may still finish.
export async function dismissParkedOrder(event, orderId) {
  const marker = await readOrderWork(event, orderId);
  if (!marker?.parked) return false;
  await clearOrderWork(event, orderId);
  return true;
}
