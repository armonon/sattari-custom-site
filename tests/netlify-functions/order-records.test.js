// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildOrderNotificationSubject,
  buildOrderNotificationText,
  createOrderRecord,
} from '../../src/utils/orderProcessing.js';

const ADDRESS = {
  city: 'Los Angeles',
  country: 'US',
  line1: '123 Main St',
  line2: null,
  postal_code: '90001',
  state: 'CA',
};

const SESSION = {
  id: 'cs_test_shipping',
  created: 1790000000,
  status: 'complete',
  payment_status: 'paid',
  amount_total: 8795,
  currency: 'usd',
  customer_details: { email: 'buyer@example.com', name: 'Alex Buyer' },
};

const EXPECTED = {
  name: 'Alex Buyer',
  address: {
    city: 'Los Angeles',
    country: 'US',
    line1: '123 Main St',
    line2: null,
    postalCode: '90001',
    state: 'CA',
  },
};

describe('the shipping address on an order record', () => {
  // Webhook payloads follow the API version of their endpoint, so an order
  // can arrive in either shape.
  it('reads the shape from Stripe API versions before 2025-03-31.basil', () => {
    const record = createOrderRecord({
      ...SESSION,
      shipping_details: { name: 'Alex Buyer', address: ADDRESS },
    });
    expect(record.shipping).toEqual(EXPECTED);
  });

  it('reads the 2025-03-31.basil shape, collected_information.shipping_details', () => {
    const record = createOrderRecord({
      ...SESSION,
      collected_information: { shipping_details: { name: 'Alex Buyer', address: ADDRESS } },
    });
    expect(record.shipping).toEqual(EXPECTED);
    expect(buildOrderNotificationText({ ...record, items: [] })).toContain('123 Main St');
  });

  it('prefers collected_information when both are present', () => {
    const record = createOrderRecord({
      ...SESSION,
      shipping_details: { name: 'Old Shape', address: { ...ADDRESS, city: 'Old City' } },
      collected_information: { shipping_details: { name: 'Alex Buyer', address: ADDRESS } },
    });
    expect(record.shipping).toEqual(EXPECTED);
  });

  it('records no shipping when neither shape has an address', () => {
    expect(createOrderRecord(SESSION).shipping).toBeNull();
    expect(createOrderRecord({ ...SESSION, collected_information: null }).shipping).toBeNull();
  });
});

describe('the owner email for an order whose stock needs checking', () => {
  it('says so in the subject and at the top', () => {
    const record = {
      ...createOrderRecord(SESSION),
      stock: { state: 'needs_review' },
    };

    expect(buildOrderNotificationSubject(record)).toMatch(/^ACTION NEEDED: check stock by hand/);
    expect(buildOrderNotificationText(record).split('\n')[0]).toMatch(/STOCK WAS NOT UPDATED/);
  });
});
