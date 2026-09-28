import { connectLambda, getStore } from '@netlify/blobs';
import { localDate } from '../src/utils/studioBooking.js';
import { pauseBeforeRetry, writeIfUnchanged } from './blobs.js';
import { blobsEvent } from './functionAdapter.js';

export const BOOKING_STORE = 'studio-bookings';
const KEY = 'calendar-v1';

// Every booking lives in one document that is rewritten, conditionally, on
// every change. Keeping it to recent and upcoming bookings keeps those writes
// small and short. Older bookings move to one archive entry each, which
// nothing rewrites.
export const ARCHIVE_PREFIX = 'archive/';
export const ARCHIVE_AFTER_DAYS = 30;
// 'approving' and 'awaiting_payment' may still have money moving at Stripe, and
// 'needs_review' is waiting on staff, so they stay in the live calendar.
const SETTLED_STATUSES = new Set(['requested', 'declined', 'cancelled', 'expired', 'paid']);

function store(event) {
  const lambda = blobsEvent(event);
  if (lambda) connectLambda(lambda);
  // Fail closed if strong reads are unavailable. Reservations cannot use the
  // eventual-consistency fallback used by the general-purpose shop store. The
  // runtime only provides strong reads to v2 functions, which is why every
  // function that reaches this store is one.
  return getStore({ name: BOOKING_STORE, consistency: 'strong' });
}

function storeError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode, expose: true });
}

export async function readBookings(event) {
  return (await store(event).get(KEY, { type: 'json', consistency: 'strong' })) || {};
}

export async function updateBookings(event, mutate, { attempts = 8 } = {}) {
  const blob = store(event);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await blob.getWithMetadata(KEY, { type: 'json', consistency: 'strong' });
    const doc = current?.data || {};
    const next = mutate(doc);
    if (!next) return doc;
    if (await writeIfUnchanged(blob, KEY, next, current)) return next;
    if (attempt + 1 < attempts) await pauseBeforeRetry(attempt);
  }
  throw storeError('Bookings are being updated. Please try again.', 409);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

// `update` returns the fields to change. When none of them differ from what is
// stored, nothing is written: every write rewrites the whole calendar, and
// most calls (a delivery check, a payment lookup) find nothing to change.
export async function patchBooking(event, id, update) {
  const doc = await updateBookings(event, (records) => {
    if (!records[id]) throw storeError('Booking not found.', 404);
    const changes = update(records[id]) || {};
    if (Object.entries(changes).every(([field, value]) => sameValue(records[id][field], value))) {
      return null;
    }
    return {
      ...records,
      [id]: { ...records[id], ...changes, updatedAt: new Date().toISOString() },
    };
  });
  return doc[id];
}

export function archiveKey(booking) {
  return `${ARCHIVE_PREFIX}${booking.date.slice(0, 7)}/${booking.id}.json`;
}

// Moves settled bookings whose date is more than ARCHIVE_AFTER_DAYS behind the
// studio's calendar out of the live document. Copies first and removes second,
// so an interruption leaves a duplicate the next run overwrites, never a lost
// booking. A booking that changed after it was copied stays for the next run.
export async function archivePastBookings(event, { now = Date.now(), limit = 100 } = {}) {
  const cutoff = localDate(now - ARCHIVE_AFTER_DAYS * 86400000);
  const due = Object.values(await readBookings(event))
    .filter(
      (booking) =>
        typeof booking?.date === 'string' &&
        booking.date < cutoff &&
        SETTLED_STATUSES.has(booking.status)
    )
    .slice(0, limit);
  if (!due.length) return 0;

  const blob = store(event);
  for (const booking of due) await blob.setJSON(archiveKey(booking), booking);

  let removed = 0;
  await updateBookings(event, (records) => {
    const next = { ...records };
    removed = 0;
    for (const booking of due) {
      if (records[booking.id] && JSON.stringify(records[booking.id]) === JSON.stringify(booking)) {
        delete next[booking.id];
        removed += 1;
      }
    }
    return removed ? next : null;
  });
  return removed;
}
