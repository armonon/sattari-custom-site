import { describe, expect, it } from 'vitest';
import {
  buildOrderNotificationText,
  createOrderRecord,
  formatOrderCurrency,
  getOrderStoreKey,
  summarizeOrderRecord,
} from './orderProcessing';

describe('order processing utilities', () => {
  it('formats Stripe amounts for display', () => {
    expect(formatOrderCurrency(12345, 'usd')).toBe('$123.45');
    expect(formatOrderCurrency(null, 'usd')).toBeNull();
  });

  it('builds stable store keys for recorded orders', () => {
    expect(getOrderStoreKey('cs_test_123')).toBe('orders/cs_test_123.json');
  });

  it('creates a normalized order record from a Stripe session', () => {
    const record = createOrderRecord(
      {
        id: 'cs_test_123',
        created: 1713888000,
        status: 'complete',
        payment_status: 'paid',
        amount_total: 15995,
        currency: 'usd',
        customer_details: {
          email: 'buyer@example.com',
          name: 'Alex Buyer',
          phone: '555-0100',
        },
        shipping_details: {
          name: 'Alex Buyer',
          address: {
            city: 'Los Angeles',
            country: 'US',
            line1: '123 Main St',
            postal_code: '90001',
            state: 'CA',
          },
        },
      },
      [{ description: 'Pirouz Series Cymbals', quantity: 1, amount_total: 15995, currency: 'usd' }],
      { source: 'test-suite', recordedAt: '2026-04-23T00:00:00.000Z' }
    );

    expect(record).toMatchObject({
      id: 'cs_test_123',
      source: 'test-suite',
      paymentStatus: 'paid',
      customerEmail: 'buyer@example.com',
      amountTotal: 15995,
      currency: 'usd',
      items: [{ description: 'Pirouz Series Cymbals', quantity: 1, amountTotal: 15995 }],
    });
  });

  it('builds a readable notification body', () => {
    const text = buildOrderNotificationText({
      id: 'cs_test_123',
      paymentStatus: 'paid',
      status: 'complete',
      amountTotal: 15995,
      currency: 'usd',
      customerName: 'Alex Buyer',
      customerEmail: 'buyer@example.com',
      items: [
        { description: 'Pirouz Series Cymbals', quantity: 1, amountTotal: 15995, currency: 'usd' },
      ],
      shipping: {
        name: 'Alex Buyer',
        address: {
          line1: '123 Main St',
          city: 'Los Angeles',
          state: 'CA',
          postalCode: '90001',
          country: 'US',
        },
      },
    });

    expect(text).toContain('New Sattari Music order received.');
    expect(text).toContain('Order ID: cs_test_123');
    expect(text).toContain('Pirouz Series Cymbals × 1 — $159.95');
    expect(text).toContain('buyer@example.com');
  });

  it('builds compact order summaries for admin views', () => {
    const summary = summarizeOrderRecord({
      id: 'cs_test_123',
      recordedAt: '2026-04-23T00:00:00.000Z',
      submittedAt: '2026-04-22T23:59:00.000Z',
      paymentStatus: 'paid',
      status: 'complete',
      customerEmail: 'buyer@example.com',
      customerName: 'Alex Buyer',
      amountTotal: 15995,
      currency: 'usd',
      items: [
        { description: 'Pirouz Series Cymbals', quantity: 1 },
        { description: 'Practice Pad', quantity: 2 },
      ],
    });

    expect(summary).toEqual({
      id: 'cs_test_123',
      recordedAt: '2026-04-23T00:00:00.000Z',
      submittedAt: '2026-04-22T23:59:00.000Z',
      paymentStatus: 'paid',
      status: 'complete',
      customerEmail: 'buyer@example.com',
      customerName: 'Alex Buyer',
      amountTotal: 15995,
      currency: 'usd',
      itemCount: 3,
    });
  });
});
