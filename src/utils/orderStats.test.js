import { describe, expect, it } from 'vitest';
import { buildOrderStats, formatCents, isPaid } from './orderStats.js';

const NOW = new Date('2026-08-13T12:00:00Z').getTime();
const hoursAgo = (h) => new Date(NOW - h * 3600 * 1000).toISOString();

const order = (overrides = {}) => ({
  paymentStatus: 'paid',
  amountTotal: 10000,
  currency: 'usd',
  recordedAt: hoursAgo(1),
  ...overrides,
});

describe('isPaid', () => {
  it('only counts orders Stripe marked paid', () => {
    expect(isPaid(order())).toBe(true);
    expect(isPaid(order({ paymentStatus: 'unpaid' }))).toBe(false);
    expect(isPaid(order({ paymentStatus: null }))).toBe(false);
    expect(isPaid(undefined)).toBe(false);
  });
});

describe('buildOrderStats', () => {
  it('excludes unpaid orders from revenue but still counts them', () => {
    // A checkout session exists the moment payment starts; counting an unpaid
    // one as revenue would overstate takings.
    const stats = buildOrderStats(
      [order(), order({ paymentStatus: 'unpaid', amountTotal: 999999 })],
      NOW
    );

    expect(stats.revenueCents.allTime).toBe(10000);
    expect(stats.orders.all).toBe(2);
    expect(stats.orders.paid).toBe(1);
    expect(stats.orders.unpaid).toBe(1);
  });

  it('buckets by time window', () => {
    const stats = buildOrderStats(
      [
        order({ recordedAt: hoursAgo(2) }),
        order({ recordedAt: hoursAgo(48) }),
        order({ recordedAt: hoursAgo(24 * 10) }),
        order({ recordedAt: hoursAgo(24 * 100) }),
      ],
      NOW
    );

    expect(stats.orders.last24h).toBe(1);
    expect(stats.orders.last7d).toBe(2);
    expect(stats.orders.last30d).toBe(3);
    expect(stats.orders.paid).toBe(4);
    expect(stats.revenueCents.last24h).toBe(10000);
    expect(stats.revenueCents.allTime).toBe(40000);
  });

  it('falls back to submittedAt when recordedAt is absent', () => {
    const stats = buildOrderStats(
      [order({ recordedAt: undefined, submittedAt: hoursAgo(3) })],
      NOW
    );
    expect(stats.orders.last24h).toBe(1);
  });

  it('ignores orders with an unusable timestamp instead of crashing', () => {
    const stats = buildOrderStats([order({ recordedAt: 'not-a-date' })], NOW);
    expect(stats.orders.last24h).toBe(0);
    // Still counted in all-time revenue — the money arrived even if we cannot
    // place it on a timeline.
    expect(stats.revenueCents.allTime).toBe(10000);
  });

  it('treats a missing amount as zero rather than NaN', () => {
    const stats = buildOrderStats([order({ amountTotal: null })], NOW);
    expect(stats.revenueCents.allTime).toBe(0);
    expect(stats.averageOrderCents).toBe(0);
  });

  it('computes an average over paid orders only', () => {
    const stats = buildOrderStats(
      [
        order({ amountTotal: 10000 }),
        order({ amountTotal: 20000 }),
        order({ paymentStatus: 'unpaid' }),
      ],
      NOW
    );
    expect(stats.averageOrderCents).toBe(15000);
  });

  it('handles an empty store', () => {
    const stats = buildOrderStats([], NOW);
    expect(stats.orders.all).toBe(0);
    expect(stats.revenueCents.allTime).toBe(0);
    expect(stats.averageOrderCents).toBe(0);
  });
});

describe('formatCents', () => {
  it('renders cents as currency', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(0)).toBe('$0.00');
  });

  it('does not render junk as money', () => {
    expect(formatCents(null)).toBe('—');
    expect(formatCents('abc')).toBe('—');
  });
});
