import { getOrderStoreKey, summarizeOrderRecord } from '../../src/utils/orderProcessing.js';
import { openStore } from '../../server/blobs.js';
import { requireStaff } from '../../server/staffAuth.js';
import { blobsEvent, lambdaEvent, webResponse } from '../../server/functionAdapter.js';

// Scripted order lookups use the staff session from /api/staff/login
// (Authorization: Bearer <token>), so access expires, can be revoked and is attributed.
export const config = {
  path: ['/api/admin/orders', '/.netlify/functions/admin-orders'],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export default async function adminOrders(request, context) {
  return webResponse(await handle(await lambdaEvent(request, context)));
}

async function handle(event) {
  const session = await requireStaff(event);
  if (!session) {
    return json(401, { error: 'Sign in to continue.' });
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  try {
    const orderStore = openStore(blobsEvent(event), 'orders');
    const sessionId = event.queryStringParameters?.session_id;
    console.log(
      JSON.stringify({
        type: 'admin-orders-read',
        staff: session.staff,
        lookup: Boolean(sessionId),
      })
    );

    if (sessionId) {
      const orderRecord = await orderStore.get(getOrderStoreKey(sessionId), { type: 'json' });

      if (!orderRecord) {
        return json(404, { error: 'Order not found.' });
      }

      return json(200, { order: orderRecord });
    }

    const limit = Math.max(1, Math.min(100, Number(event.queryStringParameters?.limit) || 20));
    const { blobs } = await orderStore.list({ prefix: 'orders/' });

    const orders = await Promise.all(
      blobs.map((blob) => orderStore.get(blob.key, { type: 'json' }))
    );

    const summaries = orders
      .filter(Boolean)
      .sort(
        (left, right) =>
          new Date(right.recordedAt || 0).getTime() - new Date(left.recordedAt || 0).getTime()
      )
      .slice(0, limit)
      .map((orderRecord) => summarizeOrderRecord(orderRecord));

    return json(200, { orders: summaries });
  } catch (error) {
    console.error(JSON.stringify({ type: 'admin-orders-error', message: error?.message }));
    return json(503, { error: 'Orders are temporarily unavailable. Try again shortly.' });
  }
}
