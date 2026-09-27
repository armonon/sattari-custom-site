// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blobsModule, resetBlobs, seedBlob } from './helpers/blobsFake.js';

vi.mock('@netlify/blobs', async () => (await import('./helpers/blobsFake.js')).blobsModule);

const { default: adminOrders, config } = await import('../../netlify/functions/admin-orders.js');
const { createSession } = await import('../../server/staffAuth.js');

const STATIC_TOKEN = 'a-long-static-order-lookup-token-value';

function get(query = '', authorization) {
  return adminOrders(
    new Request(`https://sattarimusic.com/api/admin/orders${query}`, {
      headers: authorization ? { authorization } : {},
    }),
    { ip: '127.0.0.1' }
  );
}

beforeEach(() => {
  resetBlobs();
  process.env.STAFF_SESSION_SECRET = 'secret';
  delete process.env.ORDER_LOOKUP_TOKEN;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  seedBlob('orders', 'orders/cs_old.json', {
    id: 'cs_old',
    recordedAt: '2026-09-01T10:00:00.000Z',
    paymentStatus: 'paid',
    items: [{ quantity: 1 }],
  });
  seedBlob('orders', 'orders/cs_new.json', {
    id: 'cs_new',
    recordedAt: '2026-09-20T10:00:00.000Z',
    paymentStatus: 'paid',
    items: [{ quantity: 2 }],
  });
});

afterEach(() => {
  delete process.env.ORDER_LOOKUP_TOKEN;
});

describe('admin-orders', () => {
  it('answers on both public URLs', () => {
    expect(config.path).toEqual(['/api/admin/orders', '/.netlify/functions/admin-orders']);
  });

  it('answers identically whether or not the old static token is configured', async () => {
    const unset = await get('', `Bearer ${STATIC_TOKEN}`);
    process.env.ORDER_LOOKUP_TOKEN = STATIC_TOKEN;
    const configuredRight = await get('', `Bearer ${STATIC_TOKEN}`);
    const configuredWrong = await get('', 'Bearer nope');
    const missing = await get();

    const bodies = await Promise.all(
      [unset, configuredRight, configuredWrong, missing].map((response) => response.text())
    );
    expect([unset, configuredRight, configuredWrong, missing].map((r) => r.status)).toEqual([
      401, 401, 401, 401,
    ]);
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).not.toMatch(/ORDER_LOOKUP_TOKEN/);
  });

  it('lists recent orders newest first for a staff session', async () => {
    const response = await get('?limit=5', `Bearer ${createSession('Armon')}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orders.map((order) => order.id)).toEqual(['cs_new', 'cs_old']);
    expect(body.orders[0].itemCount).toBe(2);
  });

  it('looks up one order', async () => {
    const token = `Bearer ${createSession('Armon')}`;
    expect((await (await get('?session_id=cs_old', token)).json()).order.id).toBe('cs_old');
    expect((await get('?session_id=cs_missing', token)).status).toBe(404);
  });

  it('reports storage trouble without echoing it', async () => {
    const token = `Bearer ${createSession('Armon')}`;
    // The session check passes; then the order listing fails.
    const realGetStore = blobsModule.getStore.getMockImplementation();
    blobsModule.getStore.mockImplementation((options) => {
      const store = realGetStore(options);
      return options?.name === 'orders'
        ? { ...store, list: async () => Promise.reject(new Error('Blob backend exploded')) }
        : store;
    });
    try {
      const response = await get('', token);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('exploded');
    } finally {
      blobsModule.getStore.mockImplementation(realGetStore);
    }
  });
});
