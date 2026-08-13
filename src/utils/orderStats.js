// Revenue and order counts for the staff dashboard.
//
// Kept pure and separate from the function so the arithmetic — the part that
// is easy to get quietly wrong — can be tested without blobs or Stripe.

// Only count money that actually arrived. Stripe records a session as soon as
// checkout completes, but `payment_status` can still be 'unpaid' (bank
// transfers, delayed methods, abandoned-then-expired sessions). Counting those
// as revenue would overstate takings.
export function isPaid(order) {
  return order?.paymentStatus === 'paid';
}

function orderTime(order) {
  const stamp = order?.recordedAt || order?.submittedAt;
  const time = stamp ? new Date(stamp).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

function amount(order) {
  // Stripe amounts are in the smallest currency unit (cents).
  const value = Number(order?.amountTotal);
  return Number.isFinite(value) ? value : 0;
}

export function buildOrderStats(orders = [], now = Date.now()) {
  const paid = orders.filter(isPaid);

  const dayMs = 24 * 60 * 60 * 1000;
  const since = (days) => now - days * dayMs;

  const inWindow = (days) =>
    paid.filter((order) => {
      const time = orderTime(order);
      return time !== null && time >= since(days);
    });

  const sum = (list) => list.reduce((total, order) => total + amount(order), 0);

  const last24h = inWindow(1);
  const last7d = inWindow(7);
  const last30d = inWindow(30);

  const allTimeCents = sum(paid);

  return {
    currency: paid.find((order) => order.currency)?.currency || 'usd',
    orders: {
      all: orders.length,
      paid: paid.length,
      // Surfaced rather than hidden: an order that never completed payment is
      // something staff may need to chase, not something to quietly drop.
      unpaid: orders.length - paid.length,
      last24h: last24h.length,
      last7d: last7d.length,
      last30d: last30d.length,
    },
    revenueCents: {
      allTime: allTimeCents,
      last24h: sum(last24h),
      last7d: sum(last7d),
      last30d: sum(last30d),
    },
    averageOrderCents: paid.length ? Math.round(allTimeCents / paid.length) : 0,
  };
}

export function formatCents(cents, currency = 'usd') {
  // Number(null) is 0, so a blind coercion would print "$0.00" for a missing
  // total — telling staff a sale was free rather than that we do not know.
  if (typeof cents !== 'number' && typeof cents !== 'string') return '—';
  if (typeof cents === 'string' && cents.trim() === '') return '—';

  const value = Number(cents);
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
  }).format(value / 100);
}
