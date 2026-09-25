import { patchBooking, readBookings } from '../../server/studioBookingStore.js';
import { reconcileBooking } from '../../server/studioBookings.js';
import { deliverBookingNotifications } from '../../server/studioBookingNotifications.js';

export async function handler(event) {
  const bookings = Object.values(await readBookings(event));
  const candidates = bookings
    .filter(
      (booking) =>
        ['approving', 'awaiting_payment'].includes(booking.status) ||
        Object.values(booking.notifications || {}).some(
          (n) =>
            !['sent', 'skipped'].includes(n.state) &&
            n.attempts < 8 &&
            !(n.nextAttemptAt > Date.now())
        )
    )
    .sort((a, b) => (a.lastMaintenanceAt || 0) - (b.lastMaintenanceAt || 0));
  const deadline = Date.now() + 40000;
  for (const booking of candidates.slice(0, 10)) {
    if (Date.now() > deadline) break;
    try {
      await patchBooking(event, booking.id, () => ({ lastMaintenanceAt: Date.now() }));
      if (['approving', 'awaiting_payment'].includes(booking.status))
        await reconcileBooking(event, booking.id);
      await deliverBookingNotifications(event, booking.id);
    } catch {
      console.error(
        JSON.stringify({ type: 'studio-booking-maintenance-failed', bookingId: booking.id })
      );
    }
  }
  return { statusCode: 200 };
}
