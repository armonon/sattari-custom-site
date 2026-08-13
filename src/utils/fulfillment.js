// Fulfilment state for orders.
//
// Deliberately stored apart from the order record. An order record is what
// Stripe told us happened; fulfilment is what the shop did about it. Keeping
// them separate means re-reading an order from Stripe can never wipe the fact
// that it was shipped, and a fulfilment bug can never corrupt the record of a
// payment.

export const FULFILLMENT_STORE = 'fulfillment';
export const FULFILLMENT_BLOB_KEY = 'status';

export const STATUSES = ['new', 'packed', 'shipped', 'collected', 'cancelled'];

export const STATUS_LABELS = {
  new: 'New',
  packed: 'Packed',
  shipped: 'Shipped',
  collected: 'Picked up',
  cancelled: 'Cancelled',
};

// Orders still needing attention. Used for the dashboard's "to do" count —
// shipped, collected, and cancelled are all finished as far as staff go.
export const OPEN_STATUSES = ['new', 'packed'];

const MAX_HISTORY = 20;
const MAX_TEXT = 200;

export function isValidStatus(status) {
  return STATUSES.includes(status);
}

function cleanText(value, max = MAX_TEXT) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

// No transition rules on purpose. A real shop hits every out-of-order case —
// something is marked shipped that then comes back, a pickup becomes a
// delivery. Blocking those would just teach staff to work around the tool.
// Every change is attributed and kept in history instead, so the sequence is
// always recoverable.
export function applyFulfillmentUpdate(current, update, staff, now) {
  if (!isValidStatus(update?.status)) {
    return { ok: false, error: 'Unknown fulfilment status.' };
  }

  const previous = current || { status: 'new', history: [] };
  const timestamp = new Date(now).toISOString();

  const entry = {
    status: update.status,
    staff: cleanText(staff, 40) || 'unknown',
    at: timestamp,
  };

  const note = cleanText(update.note);
  if (note) entry.note = note;

  const next = {
    status: update.status,
    staff: entry.staff,
    updatedAt: timestamp,
    // Tracking survives a later status change: an order marked shipped and
    // then corrected should not silently lose its tracking number.
    tracking: cleanText(update.tracking ?? previous.tracking, 80),
    carrier: cleanText(update.carrier ?? previous.carrier, 40),
    note,
    history: [entry, ...(Array.isArray(previous.history) ? previous.history : [])].slice(
      0,
      MAX_HISTORY
    ),
  };

  return { ok: true, record: next };
}

export function sanitizeFulfillmentRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const status = isValidStatus(raw.status) ? raw.status : 'new';
  const history = Array.isArray(raw.history)
    ? raw.history
        .filter((entry) => entry && isValidStatus(entry.status))
        .slice(0, MAX_HISTORY)
        .map((entry) => ({
          status: entry.status,
          staff: cleanText(entry.staff, 40) || 'unknown',
          at: typeof entry.at === 'string' ? entry.at : '',
          ...(cleanText(entry.note) ? { note: cleanText(entry.note) } : {}),
        }))
    : [];

  return {
    status,
    staff: cleanText(raw.staff, 40),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    tracking: cleanText(raw.tracking, 80),
    carrier: cleanText(raw.carrier, 40),
    note: cleanText(raw.note),
    history,
  };
}

export function sanitizeFulfillmentDoc(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const clean = {};
  for (const [orderId, record] of Object.entries(raw)) {
    const sanitized = sanitizeFulfillmentRecord(record);
    if (sanitized) clean[orderId] = sanitized;
  }
  return clean;
}

// An order with no record has never been touched, which is 'new' rather than
// missing — so the dashboard shows a real state for every order from day one,
// including ones placed before this feature existed.
export function fulfillmentFor(doc, orderId) {
  return (
    (doc && doc[orderId]) || {
      status: 'new',
      staff: '',
      updatedAt: '',
      tracking: '',
      carrier: '',
      note: '',
      history: [],
    }
  );
}

export function countOpen(doc, orders = []) {
  return orders.filter((order) => OPEN_STATUSES.includes(fulfillmentFor(doc, order.id).status))
    .length;
}
