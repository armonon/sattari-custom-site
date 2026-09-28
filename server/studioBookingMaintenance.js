import process from 'node:process';
import Stripe from 'stripe';
import { deliverBookingNotifications } from './studioBookingNotifications.js';
import { archivePastBookings, patchBooking, readBookings } from './studioBookingStore.js';
import { reconcileBooking } from './studioBookings.js';

// Netlify stops a scheduled function at 30 seconds. New work only starts
// inside BUDGET_MS, and every provider call gives up after
// PROVIDER_TIMEOUT_MS, so a call begun at the end of the budget still ends
// well before the limit and a run is not cut off mid-send. Whatever is left
// runs five minutes later: every step is safe to repeat.
export const MAINTENANCE_BUDGET_MS = 20000;
export const PROVIDER_TIMEOUT_MS = 6000;

const RECONCILED = ['approving', 'awaiting_payment'];

function hasDueNotification(booking, now) {
  return Object.values(booking.notifications || {}).some(
    (n) => !['sent', 'skipped'].includes(n.state) && n.attempts < 8 && !(n.nextAttemptAt > now)
  );
}

export async function runBookingMaintenance(
  event,
  { budgetMs = MAINTENANCE_BUDGET_MS, stripe = null, limit = 10 } = {}
) {
  const deadline = Date.now() + budgetMs;
  const summary = { checked: 0, failed: 0, deferred: 0, archived: 0 };
  const client =
    stripe ||
    new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      timeout: PROVIDER_TIMEOUT_MS,
      maxNetworkRetries: 0,
    });

  const now = Date.now();
  const candidates = Object.values(await readBookings(event))
    .filter((booking) => RECONCILED.includes(booking.status) || hasDueNotification(booking, now))
    .sort((a, b) => (a.lastMaintenanceAt || 0) - (b.lastMaintenanceAt || 0));

  for (const booking of candidates.slice(0, limit)) {
    if (Date.now() > deadline) {
      summary.deferred += 1;
      continue;
    }
    summary.checked += 1;
    try {
      // Rotates the queue: bookings looked at last go to the back next time.
      await patchBooking(event, booking.id, () => ({ lastMaintenanceAt: Date.now() }));
      if (RECONCILED.includes(booking.status))
        await reconcileBooking(event, booking.id, null, {
          stripe: client,
          deadline,
          timeoutMs: PROVIDER_TIMEOUT_MS,
        });
      await deliverBookingNotifications(event, booking.id, {
        deadline,
        timeoutMs: PROVIDER_TIMEOUT_MS,
      });
    } catch (error) {
      summary.failed += 1;
      console.error(
        JSON.stringify({
          type: 'studio-booking-maintenance-failed',
          bookingId: booking.id,
          message: error?.expose ? error.message : error?.name,
        })
      );
    }
  }

  if (Date.now() < deadline) {
    try {
      summary.archived = await archivePastBookings(event);
    } catch (error) {
      console.error(
        JSON.stringify({ type: 'studio-booking-archive-failed', message: error?.message })
      );
    }
  }
  return summary;
}
