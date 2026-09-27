import { requireStaff } from '../../server/staffAuth.js';
import { bookingConfig } from '../../server/studioBookingConfig.js';
import { readBookings } from '../../server/studioBookingStore.js';
import {
  approveBooking,
  bookingJson as json,
  cancelUnpaidBooking,
  declineBooking,
  reconcileBooking,
  retryBookingNotifications,
} from '../../server/studioBookings.js';

export async function handler(event) {
  const session = await requireStaff(event);
  if (!session) return json(401, { error: 'Sign in to continue.' });
  try {
    if (event.httpMethod === 'GET') {
      const bookings = Object.values(await readBookings(event))
        .map(({ fingerprint, ipHash, ...booking }) => booking)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json(200, { bookings, setupMissing: bookingConfig().missing });
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Invalid request.' });
    }
    const actions = {
      approve: approveBooking,
      decline: declineBooking,
      cancel: cancelUnpaidBooking,
      sync: reconcileBooking,
      retry: retryBookingNotifications,
    };
    if (
      !payload ||
      !Object.hasOwn(actions, payload.action) ||
      typeof payload.id !== 'string' ||
      !/^studio_[a-f0-9-]{36}$/i.test(payload.id)
    )
      return json(400, { error: 'Invalid booking action.' });
    await actions[payload.action](event, payload.id, session.staff);
    return json(200, { ok: true });
  } catch (error) {
    // Only messages written for staff are shown; provider and storage errors
    // (Stripe errors carry a statusCode too) are logged, never echoed.
    const status = error?.expose ? error.statusCode : 503;
    console.error(
      JSON.stringify({
        type: 'staff-booking-action-failed',
        status,
        ...(error?.expose ? {} : { name: error?.name, message: error?.message }),
      })
    );
    return json(status, {
      error: error?.expose
        ? error.message
        : 'Unable to finish this action. The request is saved; reload to check its status before retrying.',
    });
  }
}
