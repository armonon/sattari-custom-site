import { getOrderStoreKey, summarizeOrderRecord } from '../../src/utils/orderProcessing.js';
import { buildOrderStats } from '../../src/utils/orderStats.js';
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

// Reads the same 'orders' store the Stripe webhook writes to. There is no
// second source of truth: what the dashboard shows is exactly what was
// recorded when payment completed.
//
// Distinct from the existing admin-orders function, which is gated by a static
// shared token meant for scripted lookups. This one uses the staff session, so
// the dashboard needs no second credential.
export async function handler(event) {
  const session = requireStaff(event);
  if (!session) {
    return json(401, { error: 'Sign in to continue.' });
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  const store = openStore(event, ORDER_STORE);
  const sessionId = event.queryStringParameters?.session_id;

  // Single order, for the detail view.
  if (sessionId) {
    const record = await store.get(getOrderStoreKey(sessionId), { type: 'json' });
    if (!record) return json(404, { error: 'Order not found.' });
    return json(200, { staff: session.staff, order: record });
  }

  const limit = Math.max(1, Math.min(200, Number(event.queryStringParameters?.limit) || 50));

  let blobs = [];
  try {
    ({ blobs } = await store.list({ prefix: 'orders/' }));
  } catch (error) {
    console.error(
      JSON.stringify({ type: 'staff-orders-list-error', message: error?.message || String(error) })
    );
    return json(200, { staff: session.staff, orders: [], stats: buildOrderStats([]), degraded: true });
  }

  const records = (
    await Promise.all(
      blobs.map((blob) =>
        store.get(blob.key, { type: 'json' }).catch(() => null)
      )
    )
  ).filter(Boolean);

  // Newest first. recordedAt is set by the webhook; submittedAt comes from
  // Stripe and can be absent on older records.
  records.sort(
    (left, right) =>
      new Date(right.recordedAt || right.submittedAt || 0).getTime() -
      new Date(left.recordedAt || left.submittedAt || 0).getTime()
  );

  // Stats are computed over every order, not just the page being shown, so the
  // revenue figures do not silently change when the limit does.
  const stats = buildOrderStats(records);

  return json(200, {
    staff: session.staff,
    orders: records.slice(0, limit).map((record) => ({
      ...summarizeOrderRecord(record),
      items: Array.isArray(record.items) ? record.items : [],
      shippingCity: record.shipping?.address?.city || null,
      shippingState: record.shipping?.address?.state || null,
    })),
    stats,
    total: records.length,
  });
}
