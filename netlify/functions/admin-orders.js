import { connectLambda, getStore } from '@netlify/blobs';
import { getOrderStoreKey, summarizeOrderRecord } from '../../src/utils/orderProcessing.js';
import { validateOrderLookupAccess } from '../../server/adminOrderAccess.js';

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

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed.' });
  }

  const access = validateOrderLookupAccess(event.headers || {});
  if (!access.ok) {
    return json(access.statusCode, { error: access.error });
  }

  connectLambda(event);
  const orderStore = getStore('orders');
  const sessionId = event.queryStringParameters?.session_id;

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
      (left, right) => new Date(right.recordedAt || 0).getTime() - new Date(left.recordedAt || 0).getTime()
    )
    .slice(0, limit)
    .map((orderRecord) => summarizeOrderRecord(orderRecord));

  return json(200, { orders: summaries });
}