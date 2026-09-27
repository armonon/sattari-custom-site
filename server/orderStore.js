import { getOrderStoreKey } from '../src/utils/orderProcessing.js';
import { openStore } from './blobs.js';

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
  const result = await getOrderStore(event).setJSON(getOrderStoreKey(record.id), record, {
    onlyIfNew: true,
  });
  return result?.modified !== false;
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

    const result = current?.etag
      ? await store.setJSON(key, next, { onlyIfMatch: current.etag })
      : await store.setJSON(key, next, { onlyIfNew: true });

    if (result?.modified !== false) return { record: next, changed: true };
  }

  throw new Error(`Order ${orderId} is being updated concurrently.`);
}

export async function listOrders(event) {
  const store = getOrderStore(event);
  const { blobs } = await store.list({ prefix: ORDER_PREFIX });

  const records = (
    await Promise.all(blobs.map((blob) => store.get(blob.key, { type: 'json' }).catch(() => null)))
  ).filter(Boolean);

  records.sort(
    (left, right) =>
      new Date(right.recordedAt || right.submittedAt || 0).getTime() -
      new Date(left.recordedAt || left.submittedAt || 0).getTime()
  );

  return records;
}

export async function markOrderWork(event, orderId, details = {}) {
  await getOrderStore(event).setJSON(`${WORK_PREFIX}${orderId}`, {
    orderId,
    markedAt: Date.now(),
    ...details,
  });
}

export async function readOrderWork(event, orderId) {
  return getOrderStore(event).get(`${WORK_PREFIX}${orderId}`, { type: 'json' });
}

export async function clearOrderWork(event, orderId) {
  await getOrderStore(event).delete(`${WORK_PREFIX}${orderId}`);
}

export async function listOrderWork(event) {
  const { blobs } = await getOrderStore(event).list({ prefix: WORK_PREFIX });
  return blobs.map((blob) => blob.key.slice(WORK_PREFIX.length)).filter(Boolean);
}
