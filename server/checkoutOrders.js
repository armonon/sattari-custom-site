import crypto from 'node:crypto';
import { aggregateStockLines, SOLD_HOLD_RETENTION_MS } from '../src/utils/inventory.js';
import { createOrderRecord } from '../src/utils/orderProcessing.js';
import { requestSiteRebuild } from './buildHook.js';
import { errorMessage, logError, logEvent } from './log.js';
import { sendOrderNotification } from './orderNotifications.js';
import {
  clearOrderWork,
  createOrder,
  listOrderIds,
  markOrderWork,
  readOrder,
  readOrderWorkQueue,
  updateOrder,
} from './orderStore.js';
import {
  commitStockSale,
  holdStockForPendingPayment,
  pruneStockHolds,
  readInventory,
  releaseStockHold,
} from './stockStore.js';

// Everything that happens to a shop order after Stripe says a checkout
// finished, shared by the webhook and the scheduled maintenance sweep.
//
// The order record is the claim and the checklist. It is created exactly once
// (a conditional create), BEFORE any side effect, and carries a state for each
// remaining step:
//
//   stock.state         awaiting_payment -> pending -> applied
//                       (or -> released, if a delayed payment failed)
//                       (or -> needs_review, if it could no longer be applied
//                       safely; see applyOrderStock)
//   notification.state  awaiting_payment -> pending -> sending -> sent | skipped
//                       (failed returns to sending on the next attempt)
//
// A checkout that completes unpaid (a bank debit still clearing) is recorded
// with both steps awaiting payment: nothing leaves stock and no sale email
// goes out until Stripe reports the money arrived.
//
// Any delivery, redelivery, or sweep reads that checklist and finishes what is
// left. Each step is idempotent on its own — the stock decrement writes its
// "sold" marker in the same conditional write as the decrement, and the email
// is sent under a lease plus a provider idempotency key — so neither a crash
// between steps nor two deliveries running at once repeats a finished step.

const SETTLED = new Set(['paid', 'no_payment_required']);

const RECORDED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
]);

// US bank debits settle in up to four business days.
const PENDING_PAYMENT_HOLD_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_RECHECK_MS = 60 * 60 * 1000;
const NOTIFICATION_LEASE_MS = 5 * 60 * 1000;
const MAX_NOTIFICATION_BACKOFF_MS = 60 * 60 * 1000;
// Stripe finalises a session shortly after its expires_at.
const SESSION_SETTLE_MS = 2 * 60 * 1000;
// A sale's "sold" marker is what makes a repeated stock decrement a no-op, and
// it is pruned SOLD_HOLD_RETENTION_MS after the sale. Past this age a paid
// order's stock is no longer applied automatically (see applyOrderStock).
const SAFE_APPLY_WINDOW_MS = SOLD_HOLD_RETENTION_MS - 24 * 60 * 60 * 1000;
// How far back the sweep asks Stripe for completed checkouts nobody recorded:
// Stripe stops retrying a webhook after three days.
const RECOVERY_WINDOW_MS = 72 * 60 * 60 * 1000;
const RECOVERY_PAGES = 5;
// After this many consecutive failures an order is parked: retried daily and
// listed for staff, so it cannot crowd out orders that can finish.
const MAX_WORK_FAILURES = 6;
const PARKED_RECHECK_MS = 24 * 60 * 60 * 1000;

export function isSettled(paymentStatus) {
  return SETTLED.has(paymentStatus);
}

// A scheduled run passes a `deadline`: no outside call (Stripe, the owner
// email) starts after it, so the run ends before Netlify stops it. Every step
// is safe to resume, and the next run picks up where this one stopped.
function outOfTime(deadline) {
  return Date.now() > deadline;
}

function stopIfOutOfTime(deadline) {
  if (outOfTime(deadline)) {
    throw Object.assign(new Error('Out of time for this run.'), { code: 'OUT_OF_TIME' });
  }
}

function isOutOfTime(error) {
  return error?.code === 'OUT_OF_TIME';
}

// Sessions created before holds existed carry no holdId; their session id
// stands in, so a redelivered sale is still recognised.
export function holdIdFor(session) {
  const holdId = session?.metadata?.holdId;
  return typeof holdId === 'string' && holdId ? holdId : `session:${session.id}`;
}

// The slug/size/color needed to find the right stock entry were written into
// product metadata when the session was created; 'default' is the placeholder
// for an absent size or color, and stockKey normalizes it away. Shipping lines
// and anything created outside this checkout carry no slug and are ignored.
export function buildStockLines(lineItems = []) {
  return aggregateStockLines(
    lineItems.flatMap((item) => {
      const metadata = item?.price?.product?.metadata;
      if (!metadata?.slug) return [];
      return [
        {
          slug: metadata.slug,
          size: metadata.size,
          color: metadata.color,
          name: item.description || item.price.product.name,
          quantity: item.quantity,
        },
      ];
    })
  );
}

function paymentOutcome(session, eventType) {
  if (eventType === 'checkout.session.async_payment_failed') return 'failed';
  if (isSettled(session.payment_status)) return 'paid';
  return 'pending';
}

// Payment state only moves forward, so an out-of-order or duplicate event can
// never turn a paid order back into a pending one. A failed delayed payment
// can still be overtaken by a late success: the money arrived, so it is a sale.
function withPaymentOutcome(record, session, outcome) {
  if (!record?.stock || isSettled(record.paymentStatus)) return null;

  if (outcome === 'paid') {
    return {
      ...record,
      status: session.status ?? record.status,
      paymentStatus: isSettled(session.payment_status) ? session.payment_status : 'paid',
      paidAt: new Date().toISOString(),
      stock: { ...record.stock, state: 'pending' },
      notification: { ...record.notification, state: 'pending' },
    };
  }

  if (outcome === 'failed' && record.paymentStatus !== 'failed') {
    return {
      ...record,
      status: session.status ?? record.status,
      paymentStatus: 'failed',
      notification: { ...record.notification, state: 'not_required' },
    };
  }

  return null;
}

function newOrderRecord(session, lineItems, outcome) {
  const record = {
    ...createOrderRecord(session, lineItems, { source: 'netlify-stripe-webhook' }),
    paymentStatus: 'unpaid',
    stock: {
      state: 'awaiting_payment',
      holdId: holdIdFor(session),
      lines: buildStockLines(lineItems),
    },
    notification: { state: 'awaiting_payment', attempts: 0 },
  };
  return withPaymentOutcome(record, session, outcome) || record;
}

async function ensureOrder(event, session, outcome, stripe, deadline) {
  if (!(await readOrder(event, session.id))) {
    stopIfOutOfTime(deadline);
    const { data: lineItems } = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
      expand: ['data.price.product'],
    });

    // The work marker goes first: if this invocation dies before the order
    // exists, the sweep still knows to come back for it.
    await markOrderWork(event, session.id);
    if (await createOrder(event, newOrderRecord(session, lineItems, outcome))) return;
  }

  const { changed } = await updateOrder(event, session.id, (current) =>
    withPaymentOutcome(current, session, outcome)
  );
  if (changed) await markOrderWork(event, session.id);
}

export function stockSettled(stock) {
  return stock?.state === 'applied' || stock?.state === 'needs_review';
}

// Staff are told to count by hand instead. Any earlier decrement for this sale
// happened after the order was paid, so its sold marker lives until at least
// paidAt + SOLD_HOLD_RETENTION_MS; past that, a retry can no longer tell a sale
// already applied from one that never was, and must not guess.
async function flagStockForReview(event, order) {
  logError('stock-apply-too-late', { sessionId: order.id, paidAt: order.paidAt });
  const { record } = await updateOrder(event, order.id, (current) =>
    current?.stock?.state === 'pending' && isSettled(current.paymentStatus)
      ? {
          ...current,
          stock: {
            ...current.stock,
            state: 'needs_review',
            reviewReason:
              'Stock was not confirmed as deducted within six days of payment. Count this order by hand.',
          },
        }
      : null
  );
  return record;
}

async function applyOrderStock(event, order) {
  const paidAt = Date.parse(order.paidAt || order.recordedAt);
  if (!(Date.now() - paidAt < SAFE_APPLY_WINDOW_MS)) return flagStockForReview(event, order);

  const sale = await commitStockSale(event, {
    holdId: order.stock.holdId,
    lines: order.stock.lines,
    sessionId: order.id,
  });

  if (!sale.alreadyApplied && sale.untracked.length) {
    // Untracked variants are skipped rather than created: a sale says one unit
    // left, not how many there were. Logged so staff can see which products
    // still need an opening count.
    logEvent({ type: 'stock-untracked-skip', sessionId: order.id, skipped: sale.untracked });
  }
  if (!sale.alreadyApplied && sale.oversold.length) {
    logError('stock-oversold', { sessionId: order.id, oversold: sale.oversold });
  }
  // A variant that just sold out reads "in stock" on its published page.
  if (!sale.alreadyApplied && sale.soldOut?.length) {
    await requestSiteRebuild(event, 'a product sold out');
  }

  const { record } = await updateOrder(event, order.id, (current) =>
    current?.stock?.state === 'pending' && isSettled(current.paymentStatus)
      ? {
          ...current,
          stock: {
            ...current.stock,
            state: 'applied',
            appliedAt: new Date(sale.appliedAt).toISOString(),
            applied: sale.applied,
            oversold: sale.oversold,
            untracked: sale.untracked,
          },
        }
      : null
  );
  return record;
}

async function releaseOrderHold(event, order) {
  await releaseStockHold(event, order.stock.holdId);

  const { record } = await updateOrder(event, order.id, (current) =>
    current?.paymentStatus === 'failed' && current.stock.state !== 'released'
      ? {
          ...current,
          stock: { ...current.stock, state: 'released', releasedAt: new Date().toISOString() },
        }
      : null
  );
  return record;
}

async function holdForDelayedPayment(event, order) {
  const heldUntil = Date.now() + PENDING_PAYMENT_HOLD_MS;
  await holdStockForPendingPayment(event, {
    holdId: order.stock.holdId,
    lines: order.stock.lines,
    expiresAt: heldUntil,
  });

  const { record } = await updateOrder(event, order.id, (current) =>
    current?.paymentStatus === 'unpaid' && !current.stock.heldUntil
      ? { ...current, stock: { ...current.stock, heldUntil: new Date(heldUntil).toISOString() } }
      : null
  );
  return record;
}

function notificationDue(notification, now, force) {
  switch (notification?.state) {
    case 'pending':
      return true;
    case 'failed':
      return force || !(notification.nextAttemptAt > now);
    case 'sending':
      // The previous sender died mid-send; its lease has run out.
      return !(notification.leaseUntil > now);
    default:
      return false;
  }
}

async function deliverOwnerNotification(event, order, { force, deadline }) {
  // Checked before the lease is claimed, so a skipped send leaves nothing to
  // wait out.
  if (outOfTime(deadline)) return order;
  const lease = crypto.randomUUID();
  const now = Date.now();

  const claim = await updateOrder(event, order.id, (current) => {
    if (!stockSettled(current?.stock)) return null;
    if (!notificationDue(current.notification, now, force)) return null;
    return {
      ...current,
      notification: {
        ...current.notification,
        state: 'sending',
        attempts: (current.notification.attempts || 0) + 1,
        lease,
        leaseUntil: now + NOTIFICATION_LEASE_MS,
      },
    };
  });
  if (!claim.changed) return claim.record;

  const attempt = claim.record.notification.attempts;
  let result;
  try {
    const sent = await sendOrderNotification(claim.record, {
      idempotencyKey: `sattari-order-${order.id}`,
    });
    result = sent.skipped
      ? { state: 'skipped', reason: sent.reason }
      : { state: 'sent', sentAt: new Date().toISOString(), providerId: sent.id };
  } catch (error) {
    logError('order-notification-error', {
      sessionId: order.id,
      attempt,
      message: errorMessage(error),
    });
    result = {
      state: 'failed',
      lastError: 'The email provider did not accept the notification.',
      nextAttemptAt: Date.now() + Math.min(MAX_NOTIFICATION_BACKOFF_MS, 60000 * 2 ** (attempt - 1)),
    };
  }

  const { record } = await updateOrder(event, order.id, (current) =>
    current?.notification?.lease === lease
      ? {
          ...current,
          notification: { ...current.notification, ...result, lease: null, leaseUntil: 0 },
        }
      : null
  );
  return record;
}

export function isOrderFinished(order) {
  // Records written before this pipeline existed were fully handled then.
  if (!order?.stock) return true;
  if (isSettled(order.paymentStatus)) {
    return stockSettled(order.stock) && ['sent', 'skipped'].includes(order.notification?.state);
  }
  if (order.paymentStatus === 'failed') return order.stock.state === 'released';
  return false;
}

// Finishes whatever the order's checklist says is left. Safe to call any
// number of times, concurrently, from anywhere.
export async function driveOrder(event, orderId, { force = false, deadline = Infinity } = {}) {
  let order = await readOrder(event, orderId);
  if (!order?.stock) return order;

  if (isSettled(order.paymentStatus)) {
    if (!stockSettled(order.stock)) order = await applyOrderStock(event, order);
    if (stockSettled(order.stock)) {
      order = await deliverOwnerNotification(event, order, { force, deadline });
    }
  } else if (order.paymentStatus === 'failed') {
    if (order.stock.state !== 'released') order = await releaseOrderHold(event, order);
  } else if (!order.stock.heldUntil) {
    order = await holdForDelayedPayment(event, order);
  }

  if (isOrderFinished(order)) await clearOrderWork(event, orderId);
  return order;
}

export async function recordCheckout(
  event,
  session,
  { stripe, eventType, force = false, deadline = Infinity }
) {
  await ensureOrder(event, session, paymentOutcome(session, eventType), stripe, deadline);
  return driveOrder(event, session.id, { force, deadline });
}

// Answering non-2xx makes Stripe redeliver. That is only worth it while the
// sale is not safely recorded: once the order and its stock are saved, a
// failed owner email is retried by the sweep, and a redelivery would only add
// failed deliveries to the endpoint's record at Stripe.
function needsRetry(order) {
  if (!order?.stock || !isSettled(order.paymentStatus)) return false;
  return !stockSettled(order.stock);
}

export async function handleCheckoutEvent(event, stripeEvent, { stripe }) {
  const session = stripeEvent.data.object;

  if (stripeEvent.type === 'checkout.session.expired') {
    await releaseStockHold(event, holdIdFor(session));
    return { order: null, retry: false };
  }

  if (!RECORDED_EVENTS.has(stripeEvent.type)) return { order: null, retry: false };

  // A redelivery is the moment to retry a failed email, whatever its backoff.
  const order = await recordCheckout(event, session, {
    stripe,
    eventType: stripeEvent.type,
    force: true,
  });
  return { order, retry: needsRetry(order) };
}

// A shop checkout the shopper walked away from: they followed the cancel link,
// or came back with Back and started another checkout. Expires the session at
// Stripe if it is still open, so nothing can be paid against it afterwards,
// and returns its hold id once Stripe confirms it is expired.
//
// Returns null for anything whose stock must stay put: a session that
// completed (paid, or waiting on a delayed payment), one Stripe would not
// expire, and anything that is not a shop checkout — a studio booking's
// payment link must never be cancelled from here.
export async function retireCheckoutSession(sessionId, { stripe }) {
  let session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session?.metadata?.kind !== 'shop_order') return null;

  if (session.status === 'open') {
    try {
      session = await stripe.checkout.sessions.expire(sessionId);
    } catch {
      // Paid, or expired by another request, in the meantime.
      session = await stripe.checkout.sessions.retrieve(sessionId);
    }
  }

  return session?.status === 'expired' ? holdIdFor(session) : null;
}

// Puts an abandoned checkout's units back on sale now rather than when its
// session times out. Only an active hold is released: a sold or pending one
// belongs to a completed checkout. A repeat call finds nothing to release.
export async function releaseCheckoutSession(event, sessionId, { stripe }) {
  const holdId = await retireCheckoutSession(sessionId, { stripe });
  return holdId ? releaseStockHold(event, holdId, { states: ['active'] }) : false;
}

function paymentResultEvent(session) {
  if (isSettled(session.payment_status)) return 'checkout.session.async_payment_succeeded';
  const intent = session.payment_intent;
  const status = intent && typeof intent === 'object' ? intent.status : null;
  if (status === 'requires_payment_method' || status === 'canceled') {
    return 'checkout.session.async_payment_failed';
  }
  return null;
}

async function sweepOrder(event, orderId, stripe, marker, deadline) {
  const order = await readOrder(event, orderId);

  // The marker was written but the order never was: the invocation that
  // claimed it died in between. Stripe knows what actually happened.
  if (!order) {
    stopIfOutOfTime(deadline);
    const session = await stripe.checkout.sessions.retrieve(orderId);
    if (session.status === 'complete') {
      return recordCheckout(event, session, {
        stripe,
        eventType: 'checkout.session.completed',
        deadline,
      });
    }
    if (session.status === 'expired') await clearOrderWork(event, orderId);
    // Still open: look again after the others.
    else await markOrderWork(event, orderId, workTimes(marker, Date.now()));
    return null;
  }

  // Waiting on a delayed payment. Stripe redelivers the result events, but a
  // lost one must not keep stock reserved for a week, so ask now and then.
  if (order.stock && order.paymentStatus === 'unpaid') {
    if (!(Number(marker?.nextCheckAt) > Date.now())) {
      stopIfOutOfTime(deadline);
      const session = await stripe.checkout.sessions.retrieve(orderId, {
        expand: ['payment_intent'],
      });
      const eventType = paymentResultEvent(session);
      if (eventType) return recordCheckout(event, session, { stripe, eventType, deadline });
      await markOrderWork(event, orderId, { nextCheckAt: Date.now() + PENDING_RECHECK_MS });
    }
  }

  return driveOrder(event, orderId, { deadline });
}

// The marker keeps when the work first appeared, so its age stays visible.
function workTimes(marker, nextCheckAt) {
  return { markedAt: Number(marker?.markedAt) || Date.now(), nextCheckAt };
}

// When an unfinished order is next worth looking at: when its email backoff
// or send lease ends, and in any case after every order that has waited
// longer, since the queue is taken oldest first. A delayed payment keeps the
// hourly check sweepOrder gave it.
async function rescheduleWork(event, marker, order) {
  if (!order || order.paymentStatus === 'unpaid') return;
  const nextCheckAt = Math.max(
    Date.now(),
    Number(order.notification?.nextAttemptAt) || 0,
    Number(order.notification?.leaseUntil) || 0
  );
  await markOrderWork(event, marker.orderId, workTimes(marker, nextCheckAt));
}

// Backs a failing order off, and parks it after MAX_WORK_FAILURES in a row.
async function recordWorkFailure(event, marker, error) {
  const failures = (Number(marker.failures) || 0) + 1;
  const parked = failures >= MAX_WORK_FAILURES;
  const now = Date.now();
  const backoff = parked
    ? PARKED_RECHECK_MS
    : Math.min(6 * 60 * 60 * 1000, 10 * 60 * 1000 * 2 ** (failures - 1));
  await markOrderWork(event, marker.orderId, {
    ...workTimes(marker, now + backoff),
    failures,
    lastError: errorMessage(error).slice(0, 200),
    ...(parked ? { parked: true, parkedAt: marker.parkedAt || new Date(now).toISOString() } : {}),
  });
  return parked;
}

// Completed shop checkouts from the last three days that have no order record.
// Holds only cover tracked stock, so a cart of untracked items leaves nothing
// for the hold check to find if every webhook for it failed.
async function recoverUnrecordedSessions(event, { stripe, deadline, summary }) {
  const recorded = new Set(await listOrderIds(event));
  const since = Math.floor((Date.now() - RECOVERY_WINDOW_MS) / 1000);
  let startingAfter;

  for (let page = 0; page < RECOVERY_PAGES && !outOfTime(deadline); page += 1) {
    const sessions = await stripe.checkout.sessions.list({
      status: 'complete',
      created: { gte: since },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const session of sessions.data || []) {
      if (session.metadata?.kind !== 'shop_order' || recorded.has(session.id)) continue;
      if (outOfTime(deadline)) return;
      try {
        await recordCheckout(event, session, {
          stripe,
          eventType: 'checkout.session.completed',
          deadline,
        });
        recorded.add(session.id);
        summary.sessionsRecovered += 1;
        logEvent({ type: 'checkout-session-recovered', sessionId: session.id });
      } catch (error) {
        if (isOutOfTime(error)) return;
        summary.errors += 1;
        logError('checkout-sweep-recover-error', {
          sessionId: session.id,
          message: errorMessage(error),
        });
      }
    }
    if (!sessions.has_more || !sessions.data?.length) return;
    startingAfter = sessions.data.at(-1).id;
  }
}

// Scheduled backstop for everything a lost or failed webhook would leave
// behind: holds whose checkout ended without an event, completed checkouts
// nobody recorded, and orders whose stock or owner email never finished.
//
// `deadline` is when to stop starting outside calls; the scheduled function
// sets it from its own start, so time spent before the sweep counts too.
export async function sweepCheckouts(
  event,
  { stripe, budgetMs = 20000, deadline = Date.now() + budgetMs, maxOrders = 25 } = {}
) {
  const overBudget = () => outOfTime(deadline);
  const summary = {
    holdsChecked: 0,
    holdsReleased: 0,
    sessionsRecovered: 0,
    ordersChecked: 0,
    ordersFinished: 0,
    ordersParked: 0,
    errors: 0,
  };

  const { holds } = await readInventory(event);
  for (const [holdId, hold] of Object.entries(holds)) {
    if (overBudget()) break;
    if (hold.state !== 'active') continue;

    const endsAt = Number(hold.checkoutExpiresAt) || Number(hold.expiresAt);
    if (Date.now() < endsAt + SESSION_SETTLE_MS) continue;

    summary.holdsChecked += 1;
    try {
      // No session id means the session was never created, or its id was
      // never recorded; either way its checkout window has closed.
      const session = hold.sessionId
        ? await stripe.checkout.sessions.retrieve(hold.sessionId)
        : null;

      if (session?.status === 'complete') {
        await recordCheckout(event, session, {
          stripe,
          eventType: 'checkout.session.completed',
          deadline,
        });
        summary.sessionsRecovered += 1;
      } else if (!session || session.status === 'expired') {
        if (await releaseStockHold(event, holdId)) summary.holdsReleased += 1;
      }
    } catch (error) {
      if (isOutOfTime(error)) break;
      summary.errors += 1;
      logError('checkout-sweep-hold-error', { holdId, message: errorMessage(error) });
    }
  }

  if (!overBudget()) {
    try {
      await recoverUnrecordedSessions(event, { stripe, deadline, summary });
    } catch (error) {
      summary.errors += 1;
      logError('checkout-sweep-recover-error', { message: errorMessage(error) });
    }
  }

  // Oldest due first, and anything looked at goes to the back, so a few
  // orders that keep failing cannot take every turn.
  const now = Date.now();
  const { markers } = await readOrderWorkQueue(event);
  const due = markers.filter((marker) => !(Number(marker.nextCheckAt) > now));
  for (const marker of due.slice(0, maxOrders)) {
    if (overBudget()) break;

    summary.ordersChecked += 1;
    try {
      // null: no order yet, and the marker was cleared or moved back.
      const order = await sweepOrder(event, marker.orderId, stripe, marker, deadline);
      if (!order) continue;
      if (isOrderFinished(order)) summary.ordersFinished += 1;
      else await rescheduleWork(event, marker, order);
    } catch (error) {
      // Stopped for time, not failed: it stays first in line for next run.
      if (isOutOfTime(error)) break;
      summary.errors += 1;
      const parked = await recordWorkFailure(event, marker, error).catch(() => false);
      if (parked) summary.ordersParked += 1;
      logError(parked ? 'checkout-order-parked' : 'checkout-sweep-order-error', {
        sessionId: marker.orderId,
        failures: (Number(marker.failures) || 0) + 1,
        message: errorMessage(error),
      });
    }
  }

  try {
    await pruneStockHolds(event);
  } catch (error) {
    summary.errors += 1;
    logError('checkout-sweep-prune-error', { message: errorMessage(error) });
  }

  return summary;
}
