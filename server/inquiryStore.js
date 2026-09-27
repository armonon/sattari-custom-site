import { openStore } from './blobs.js';
import { blobsEvent } from './functionAdapter.js';

// Service inquiries, one entry each. Read by the staff page so that a lead
// whose email never arrived is still seen and answered.
export const INQUIRY_STORE = 'service-inquiries';
const PREFIX = 'inquiries/';
const EMAIL_BUDGET_KEY = 'budget/email';

export const INQUIRY_ID_PATTERN = /^inq_\d{13}_[a-f0-9]{8}$/;

// Inquiry emails go out on the same Resend key as order confirmations. A flood
// of form posts must not be able to spend the quota orders depend on, so past
// this the inquiry is kept for staff but not emailed.
export const INQUIRY_EMAIL_LIMITS = { perHour: 10, perDay: 40 };

function store(event) {
  return openStore(blobsEvent(event), INQUIRY_STORE);
}

export function inquiryKey(id) {
  return `${PREFIX}${id}.json`;
}

export async function saveInquiry(event, record) {
  await store(event).setJSON(inquiryKey(record.id), record);
}

// Ids start with the creation time in milliseconds, so newest-first is a key
// sort and only the page being shown is read.
export async function listInquiries(event, { limit = 100 } = {}) {
  const blob = store(event);
  const { blobs = [] } = await blob.list({ prefix: PREFIX });
  const keys = blobs
    .map((item) => item.key)
    .sort()
    .reverse();
  const records = await Promise.all(
    keys.slice(0, limit).map((key) => blob.get(key, { type: 'json' }).catch(() => null))
  );
  return { inquiries: records.filter(Boolean), total: keys.length };
}

// Returns the updated record, or null when there is no such inquiry.
export async function updateInquiry(event, id, change, attempts = 5) {
  const blob = store(event);
  const key = inquiryKey(id);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await blob.getWithMetadata(key, { type: 'json' });
    if (!current?.data) return null;
    const next = change(current.data);
    const result = await blob.setJSON(key, next, { onlyIfMatch: current.etag });
    if (result?.modified === true) return next;
    if (result?.modified !== false) {
      throw new Error('Inquiry storage ignored a conditional write.');
    }
  }
  throw Object.assign(new Error('Someone else is updating that inquiry. Reload and try again.'), {
    statusCode: 409,
    expose: true,
  });
}

// Claims one email from the hourly and daily allowance. Resolves true when the
// email may be sent and false when the allowance is spent; throws when the
// count could not be updated, which callers treat as spent.
export async function claimInquiryEmail(event, now = Date.now(), limits = INQUIRY_EMAIL_LIMITS) {
  const blob = store(event);
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / 86400000);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await blob.getWithMetadata(EMAIL_BUDGET_KEY, { type: 'json' });
    const doc = current?.data || {};
    const hourCount = doc.hour === hour ? Number(doc.hourCount) || 0 : 0;
    const dayCount = doc.day === day ? Number(doc.dayCount) || 0 : 0;
    if (hourCount >= limits.perHour || dayCount >= limits.perDay) return false;
    const result = await blob.setJSON(
      EMAIL_BUDGET_KEY,
      { hour, hourCount: hourCount + 1, day, dayCount: dayCount + 1 },
      current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true }
    );
    if (result?.modified === true) return true;
    if (result?.modified !== false) {
      throw new Error('Inquiry storage ignored a conditional write.');
    }
  }
  throw new Error('Inquiry email allowance stayed contended.');
}
