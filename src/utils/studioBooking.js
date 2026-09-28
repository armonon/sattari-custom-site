export const STUDIO_TIME_ZONE = 'America/Los_Angeles';
export const STUDIO_HOURLY_CENTS = 2500;
export const STUDIO_FOUR_HOUR_CENTS = 6000;
export const BOOKING_STATUSES = {
  requested: 'Awaiting approval',
  approving: 'Preparing payment link',
  awaiting_payment: 'Approved - awaiting payment',
  paid: 'Booked and paid',
  declined: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Payment link expired',
  needs_review: 'Payment needs staff review',
};

// The address is handed to Stripe as the checkout's customer_email, and Stripe
// refuses the whole payment link over one it does not accept, so check it the
// same way up front: plain ASCII, a dotted domain of letters, digits and
// hyphens, and a letters-only top-level domain.
const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const EMAIL_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function validBookingEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return false;
  const at = value.lastIndexOf('@');
  if (at < 1) return false;
  const local = value.slice(0, at);
  const labels = value.slice(at + 1).split('.');
  return (
    local.length <= 64 &&
    EMAIL_LOCAL.test(local) &&
    labels.length >= 2 &&
    labels.every((label) => EMAIL_LABEL.test(label)) &&
    /^[A-Za-z]{2,63}$/.test(labels.at(-1))
  );
}

export function bookingPrice(hours) {
  if (!Number.isInteger(hours) || hours < 1 || hours > 12)
    throw new Error('Choose a valid duration.');
  return hours >= 4
    ? STUDIO_FOUR_HOUR_CENTS + (hours - 4) * STUDIO_HOURLY_CENTS
    : hours * STUDIO_HOURLY_CENTS;
}

export function money(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function hourLabel(hour) {
  if (hour === 24) return '12 AM (midnight)';
  return `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function localDate(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STUDIO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date;
}

// Resolve the studio's local hour, not the visitor's timezone. Verify the
// round-trip so nonexistent daylight-saving times are never accepted.
export function studioTimestamp(date, hour) {
  if (!validDate(date) || !Number.isInteger(hour) || hour < 0 || hour > 24) return NaN;
  const target = Date.parse(`${date}T00:00:00Z`) + hour * 3600000;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: STUDIO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const p = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map(({ type, value }) => [type, value])
    );
    const represented = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second)
    );
    if (represented === target) return guess;
    guess += target - represented;
  }
  return NaN;
}

export function bookingSummary(booking) {
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${booking.date}T12:00:00Z`));
  return `${date}, ${hourLabel(booking.startHour)} to ${hourLabel(booking.startHour + booking.hours)} (Los Angeles time)`;
}

export function overlaps(a, b) {
  return (
    a.date === b.date && a.startHour < b.startHour + b.hours && b.startHour < a.startHour + a.hours
  );
}

export function holdsTime(booking) {
  // Never release merely because our clock passed the checkout expiry. Stripe
  // must first confirm expired/unpaid; a paid webhook may still be in flight.
  // A payment waiting on staff review may be money already taken for it.
  return ['approving', 'awaiting_payment', 'paid', 'needs_review'].includes(booking.status);
}

export function availableHours(date, hours, config, reserved = [], now = Date.now()) {
  if (!validDate(date) || !config?.days?.includes(new Date(`${date}T12:00:00Z`).getUTCDay()))
    return [];
  const starts = [];
  for (let startHour = config.openHour; startHour + hours <= config.closeHour; startHour += 1) {
    // Written so that NaN, which studioTimestamp returns for an hour the
    // daylight-saving change skips, is refused rather than slipping past a
    // `<` comparison.
    if (!(studioTimestamp(date, startHour) >= now + 3600000)) continue;
    if (reserved.some((slot) => overlaps({ date, startHour, hours }, slot))) continue;
    starts.push(startHour);
  }
  return starts;
}
