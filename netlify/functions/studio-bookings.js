import { bookingConfig } from '../../server/studioBookingConfig.js';
import { readBookings } from '../../server/studioBookingStore.js';
import { holdsTime } from '../../src/utils/studioBooking.js';
import { requestBooking, lookupBookingPayment } from '../../server/studioBookings.js';

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'Referrer-Policy': 'no-referrer',
    },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
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
    if ((event.body || '').length > 10000) return json(413, { error: 'Request is too large.' });
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
    if (!error.statusCode)
      console.error(
        JSON.stringify({
          type: 'studio-booking-error',
          message: 'Booking request could not be processed.',
        })
      );
    return json(error.statusCode || 503, {
      error: error.statusCode
        ? error.message
        : 'Unable to process studio bookings right now. Please try again or call (424) 465-3020.',
    });
  }
}
