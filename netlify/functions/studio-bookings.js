import { bookingConfig } from '../../server/studioBookingConfig.js';
import { readBookings } from '../../server/studioBookingStore.js';
import { holdsTime } from '../../src/utils/studioBooking.js';
import {
  bookingJson as json,
  lookupBookingPayment,
  requestBooking,
} from '../../server/studioBookings.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';

const MAX_BODY_CHARS = 10000;

// Both URLs are listed: a custom path replaces the default one otherwise.
// There is no edge rate limit here (the plan's two rules are spent on
// site-event and service-inquiry). Requests are bounded by the per-sender and
// site-wide limits in requestBooking, and a payment-status lookup only calls
// Stripe while that payment is still outstanding (see lookupBookingPayment).
export const config = {
  path: ['/api/studio-bookings', '/.netlify/functions/studio-bookings'],
};

export default async function studioBookings(request, context) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_CHARS) {
    return webResponse(json(413, { error: 'Request is too large.' }));
  }
  return webResponse(await handle(await lambdaEvent(request, context)));
}

async function handle(event) {
  try {
    if (event.httpMethod === 'GET') {
      if (event.queryStringParameters?.session_id)
        return json(200, {
          booking: await lookupBookingPayment(event, event.queryStringParameters.session_id),
        });
      const { publicConfig } = bookingConfig();
      const reserved = publicConfig.enabled
        ? Object.values(await readBookings(event))
            .filter(holdsTime)
            .map(({ date, startHour, hours }) => ({ date, startHour, hours }))
        : [];
      return json(200, { ...publicConfig, reserved });
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
    if ((event.body || '').length > MAX_BODY_CHARS)
      return json(413, { error: 'Request is too large.' });
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'Invalid request.' });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return json(400, { error: 'Invalid request.' });
    return json(201, { booking: await requestBooking(event, payload) });
  } catch (error) {
    if (!error?.expose)
      console.error(
        JSON.stringify({
          type: 'studio-booking-error',
          name: error?.name,
          message: error?.message,
        })
      );
    return json(error?.expose ? error.statusCode : 503, {
      error: error?.expose
        ? error.message
        : 'Unable to process studio bookings right now. Please try again or call (424) 465-3020.',
    });
  }
}
