import { runBookingMaintenance } from '../../server/studioBookingMaintenance.js';

// Every five minutes on published production deploys: checks unfinished
// payment links with Stripe, retries notifications that failed, and archives
// old bookings. A v2 scheduled function, so it gets the strong Blobs reads the
// booking store requires; the Lambda-style version could not read it at all.
export const config = { schedule: '*/5 * * * *' };

export default async function studioBookingMaintenance() {
  const startedAt = Date.now();
  let summary;
  try {
    summary = await runBookingMaintenance(undefined);
  } catch (error) {
    // The calendar could not be read; nothing was changed.
    console.error(
      JSON.stringify({ type: 'studio-booking-maintenance-read-failed', message: error?.message })
    );
    throw error;
  }
  if (summary.checked || summary.archived || summary.deferred) {
    console.log(
      JSON.stringify({
        type: 'studio-booking-maintenance',
        ...summary,
        ms: Date.now() - startedAt,
      })
    );
  }
}
