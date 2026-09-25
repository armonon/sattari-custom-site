import { connectLambda, getStore } from '@netlify/blobs';

export const BOOKING_STORE = 'studio-bookings';
const KEY = 'calendar-v1';

function store(event) {
  if (event) connectLambda(event);
  // Fail closed if strong reads are unavailable. Reservations cannot use the
  // eventual-consistency fallback used by the general-purpose shop store.
  return getStore({ name: BOOKING_STORE, consistency: 'strong' });
}

export async function readBookings(event) {
  return (await store(event).get(KEY, { type: 'json', consistency: 'strong' })) || {};
}

export async function updateBookings(event, mutate) {
  const blob = store(event);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await blob.getWithMetadata(KEY, { type: 'json', consistency: 'strong' });
    const doc = current?.data || {};
    const next = mutate(doc);
    if (!next) return doc;
    const result = await blob.setJSON(
      KEY,
      next,
      current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
    );
    if (result?.modified === true) return next;
    if (result?.modified !== false)
      throw new Error('Booking storage does not support conditional writes.');
  }
  throw Object.assign(new Error('Bookings are being updated. Please try again.'), {
    statusCode: 409,
  });
}

export async function patchBooking(event, id, update) {
  const doc = await updateBookings(event, (records) => {
    if (!records[id]) throw Object.assign(new Error('Booking not found.'), { statusCode: 404 });
    return {
      ...records,
      [id]: { ...records[id], ...update(records[id]), updatedAt: new Date().toISOString() },
    };
  });
  return doc[id];
}
