import { getOrderStoreKey, summarizeOrderRecord } from '../../src/utils/orderProcessing.js';
import { buildOrderStats } from '../../src/utils/orderStats.js';
import {
  applyFulfillmentUpdate,
  countOpen,
  fulfillmentFor,
  isValidStatus,
} from '../../src/utils/fulfillment.js';
import { readFulfillmentDoc, updateFulfillmentDoc } from '../../server/fulfillmentStore.js';
import { requireStaff } from '../../server/staffAuth.js';
import { openStore } from '../../server/blobs.js';

const ORDER_STORE = 'orders';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

async function loadOrders(event) {
  const store = openStore(event, ORDER_STORE);
  const { blobs } = await store.list({ prefix: 'orders/' });

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

function decorate(records, fulfillmentDoc, limit) {
  return records.slice(0, limit).map((record) => ({
    ...summarizeOrderRecord(record),
    items: Array.isArray(record.items) ? record.items : [],
    shippingCity: record.shipping?.address?.city || null,
    shippingState: record.shipping?.address?.state || null,
    shippingName: record.shipping?.name || null,
    fulfillment: fulfillmentFor(fulfillmentDoc, record.id),
  }));
}

// Reads the same 'orders' store the Stripe webhook writes to, and layers this
// shop's own fulfilment state on top. The two are stored separately so that
// re-reading an order from Stripe can never wipe the fact that it shipped.
//
// Distinct from admin-orders, which is gated by a static shared token meant for
// scripted lookups. This one uses the staff session.
export async function handler(event) {
  const session = requireStaff(event);
  if (!session) {
    return json(401, { error: 'Sign in to continue.' });
  }

  // --- update fulfilment -------------------------------------------------
  if (event.httpMethod === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Invalid request.' });
    }

    const orderId = String(body.orderId || '');
    if (!orderId) return json(400, { error: 'Which order?' });
    if (!isValidStatus(body.status)) return json(400, { error: 'Unknown fulfilment status.' });

    // Only orders we actually hold can be marked. Without this, a typo would
    // write a fulfilment record for an order that does not exist and quietly
    // inflate the open count forever.
    const store = openStore(event, ORDER_STORE);
    const exists = await store.get(getOrderStoreKey(orderId), { type: 'json' });
    if (!exists) return json(404, { error: 'That order does not exist.' });

    let failure = null;
    const { doc } = await updateFulfillmentDoc(event, (current) => {
      const result = applyFulfillmentUpdate(current[orderId], body, session.staff, Date.now());
      if (!result.ok) {
        failure = result.error;
        return null;
      }
      return { ...current, [orderId]: result.record };
    });

    if (failure) return json(400, { error: failure });

    console.log(
      JSON.stringify({
        type: 'staff-fulfillment-update',
        staff: session.staff,
        orderId,
        status: body.status,
      })
    );

    return json(200, { staff: session.staff, fulfillment: doc[orderId] });
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  // --- read --------------------------------------------------------------
  const sessionId = event.queryStringParameters?.session_id;

  if (sessionId) {
    const store = openStore(event, ORDER_STORE);
    const record = await store.get(getOrderStoreKey(sessionId), { type: 'json' });
    if (!record) return json(404, { error: 'Order not found.' });

    const doc = await readFulfillmentDoc(event).catch(() => ({}));
    return json(200, {
      staff: session.staff,
      order: record,
      fulfillment: fulfillmentFor(doc, record.id),
    });
  }

  const limit = Math.max(1, Math.min(200, Number(event.queryStringParameters?.limit) || 50));

  let records = [];
  let fulfillmentDoc = {};
  try {
    [records, fulfillmentDoc] = await Promise.all([
      loadOrders(event),
      readFulfillmentDoc(event).catch(() => ({})),
    ]);
  } catch (error) {
    console.error(
      JSON.stringify({ type: 'staff-orders-list-error', message: error?.message || String(error) })
    );
    return json(200, {
      staff: session.staff,
      orders: [],
      stats: buildOrderStats([]),
      openCount: 0,
      degraded: true,
    });
  }

  // Stats cover every order, not just the page shown, so revenue figures do not
  // change when the limit does.
  return json(200, {
    staff: session.staff,
    orders: decorate(records, fulfillmentDoc, limit),
    stats: buildOrderStats(records),
    openCount: countOpen(fulfillmentDoc, records),
    total: records.length,
  });
}
