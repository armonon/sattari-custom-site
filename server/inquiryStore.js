import { eachLimited, openStore, pauseBeforeRetry, writeIfUnchanged } from './blobs.js';
import { blobsEvent } from './functionAdapter.js';
import { errorMessage, logError } from './log.js';

// Service inquiries, one entry each. Read by the staff page so that a lead
// whose email never arrived is still seen and answered.
export const INQUIRY_STORE = 'service-inquiries';
const PREFIX = 'inquiries/';
// One marker per inquiry that was never emailed and is not yet handled, so the
// staff page can list exactly those without reading every inquiry.
const UNSENT_PREFIX = 'unsent/';
// Progress of giving older inquiries their markers (see ensureUnsentIndex):
// `before` while it runs, `builtAt` once every stored inquiry has one.
const UNSENT_INDEX_KEY = 'index/unsent-v1';
// Inquiries checked per staff page load while that runs.
export const UNSENT_INDEX_BATCH = 100;
const EMAIL_BUDGET_KEY = 'budget/email';
const STORE_BUDGET_KEY = 'budget/store';

export const INQUIRY_ID_PATTERN = /^inq_\d{13}_[a-f0-9]{8}$/;

// Inquiry emails go out on the same Resend key as order confirmations. A flood
// of form posts must not be able to spend the quota orders depend on, so past
// this the inquiry is kept for staff but not emailed. The per-sender share
// (by keyed IP hash) stops one address from using up the day for everyone.
export const INQUIRY_EMAIL_LIMITS = { perHour: 10, perDay: 40, perSenderPerDay: 3 };

// The form is public, so storage is bounded too: a daily allowance (with a
// per-sender share), a ceiling on what is kept, and a retention period.
export const INQUIRY_STORAGE_LIMITS = {
  perDay: 200,
  perSenderPerDay: 20,
  maxStored: 2000,
  keepDays: 365,
};

const DAY_MS = 86400000;

function store(event) {
  return openStore(blobsEvent(event), INQUIRY_STORE);
}

export function inquiryKey(id) {
  return `${PREFIX}${id}.json`;
}

function unsentKey(id) {
  return `${UNSENT_PREFIX}${id}`;
}

function idFromKey(key) {
  return key.startsWith(PREFIX) ? key.slice(PREFIX.length).replace(/\.json$/, '') : '';
}

function createdAt(id) {
  return Number(/^inq_(\d{13})_/.exec(id)?.[1]) || 0;
}

function needsReply(record) {
  return Boolean(record) && record.emailSent !== true && !record.handledAt;
}

export function storageLimitReached(error) {
  return error?.code === 'INQUIRY_STORAGE_LIMIT';
}

// Read-modify-write of one small document under a conditional write.
// `decide` returns { write, ...result }: `write` is stored before `result` is
// returned; without it, nothing is written.
async function claim(blob, key, decide, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await blob.getWithMetadata(key, { type: 'json' });
    const { write, ...result } = decide(current?.data || {});
    if (!write) return result;
    if (await writeIfUnchanged(blob, key, write, current)) return result;
    if (attempt + 1 < attempts) await pauseBeforeRetry(attempt);
  }
  throw new Error(`Inquiry record ${key} stayed contended.`);
}

function dailyCount(doc, day, sender) {
  const today = doc.day === day;
  return {
    count: today ? Number(doc.count) || 0 : 0,
    senders: today && doc.senders && typeof doc.senders === 'object' ? doc.senders : {},
    mine: today && sender ? Number(doc.senders?.[sender]) || 0 : 0,
  };
}

// Stores an inquiry. Throws a storage-limit error (see storageLimitReached)
// when today's allowance is used up, and a plain error when storage failed.
export async function saveInquiry(event, record, { sender = null, now = Date.now() } = {}) {
  const blob = store(event);
  const day = Math.floor(now / DAY_MS);
  const limits = INQUIRY_STORAGE_LIMITS;

  // A count that cannot be updated does not stop a customer's message being
  // kept: the allowance bounds a flood, and losing a real inquiry to a busy
  // counter would cost more than a few extra stored ones.
  let allowance;
  try {
    allowance = await claim(blob, STORE_BUDGET_KEY, (doc) => {
      const today = dailyCount(doc, day, sender);
      if (today.count >= limits.perDay || today.mine >= limits.perSenderPerDay) {
        return { allowed: false };
      }
      const senders = sender ? { ...today.senders, [sender]: today.mine + 1 } : today.senders;
      return { allowed: true, write: { day, count: today.count + 1, senders } };
    });
  } catch (error) {
    logError('service-inquiry-allowance-unavailable', { message: errorMessage(error) });
    allowance = { allowed: true };
  }
  if (!allowance.allowed) {
    throw Object.assign(new Error('The inquiry storage allowance is used up for today.'), {
      code: 'INQUIRY_STORAGE_LIMIT',
    });
  }

  // The marker goes first: a marker whose inquiry was never written is
  // skipped and cleared when listed, while an inquiry without its marker
  // would be missing from the list staff work from.
  if (needsReply(record)) await blob.setJSON(unsentKey(record.id), { id: record.id });
  await blob.setJSON(inquiryKey(record.id), record);
}

// Deletes inquiries older than the retention period, then the oldest past
// the storage ceiling, at most `maxDeletes` per call (the nightly job runs it;
// anything left over goes the next night). Returns how many were removed.
export async function pruneInquiries(event, { now = Date.now(), maxDeletes = 400 } = {}) {
  const blob = store(event);
  const { blobs = [] } = await blob.list({ prefix: PREFIX });
  const ids = blobs
    .map((item) => idFromKey(item.key))
    .filter(Boolean)
    .sort();
  const cutoff = now - INQUIRY_STORAGE_LIMITS.keepDays * DAY_MS;
  const expired = ids.filter((id) => createdAt(id) < cutoff);
  const kept = ids.length - expired.length;
  const overflow = ids
    .filter((id) => createdAt(id) >= cutoff)
    .slice(0, Math.max(0, kept - INQUIRY_STORAGE_LIMITS.maxStored));

  const doomed = [...expired, ...overflow].slice(0, maxDeletes);
  await eachLimited(
    doomed,
    async (id) => {
      await blob.delete(inquiryKey(id));
      await blob.delete(unsentKey(id));
    },
    5
  );
  return doomed.length;
}

// Inquiries stored before the markers existed get theirs here, newest first,
// at most `batch` per staff page load and a few reads at a time, so no load
// can run long. Progress is saved after each batch, so the next load carries
// on instead of starting over. Resolves true once every inquiry is covered.
async function ensureUnsentIndex(blob, batch) {
  const state = (await blob.get(UNSENT_INDEX_KEY, { type: 'json' })) || {};
  if (state.builtAt) return true;
  const { blobs = [] } = await blob.list({ prefix: PREFIX });
  const ids = blobs
    .map((item) => idFromKey(item.key))
    .filter(Boolean)
    .sort()
    .reverse()
    .filter((id) => !state.before || id < state.before);
  const slice = ids.slice(0, batch);
  const records = await eachLimited(
    slice,
    (id) => blob.get(inquiryKey(id), { type: 'json' }).catch(() => null),
    5
  );
  const unsent = slice.filter((id, index) => needsReply(records[index]));
  await eachLimited(unsent, (id) => blob.setJSON(unsentKey(id), { id }), 5);
  const done = ids.length <= batch;
  await blob.setJSON(
    UNSENT_INDEX_KEY,
    done
      ? { builtAt: new Date().toISOString() }
      : { before: slice.at(-1), updatedAt: new Date().toISOString() }
  );
  return done;
}

// One page, newest first. `filter: 'unsent'` lists only inquiries that were
// never emailed and are not handled — the ones that exist nowhere else.
// `before` is the id of the last inquiry on the previous page. `indexing` is
// true while older inquiries are still being checked for that list.
export async function listInquiries(
  event,
  { limit = 50, before = null, filter = 'all', indexBatch = UNSENT_INDEX_BATCH } = {}
) {
  const blob = store(event);
  const indexed = await ensureUnsentIndex(blob, indexBatch);

  const [all, unsent] = await Promise.all([
    blob.list({ prefix: PREFIX }),
    blob.list({ prefix: UNSENT_PREFIX }),
  ]);
  const allIds = (all.blobs || []).map((item) => idFromKey(item.key)).filter(Boolean);
  const unsentIds = (unsent.blobs || [])
    .map((item) => item.key.slice(UNSENT_PREFIX.length))
    .filter((id) => INQUIRY_ID_PATTERN.test(id));

  const ids = (filter === 'unsent' ? unsentIds : allIds)
    .sort()
    .reverse()
    .filter((id) => !before || id < before);
  const page = ids.slice(0, limit);
  const records = await Promise.all(
    page.map((id) => blob.get(inquiryKey(id), { type: 'json' }).catch(() => null))
  );

  if (filter === 'unsent') {
    // A marker whose inquiry is gone, or was handled or emailed since.
    const stale = page.filter((id, index) => !needsReply(records[index]));
    await Promise.all(stale.map((id) => blob.delete(unsentKey(id)).catch(() => {})));
  }

  const inquiries = records.filter(filter === 'unsent' ? needsReply : Boolean);
  return {
    inquiries,
    total: allIds.length,
    unsentTotal: unsentIds.length,
    nextBefore: ids.length > limit ? page.at(-1) : null,
    indexing: !indexed,
  };
}

// Returns the updated record, or null when there is no such inquiry.
export async function updateInquiry(event, id, change, attempts = 5) {
  const blob = store(event);
  const key = inquiryKey(id);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await blob.getWithMetadata(key, { type: 'json' });
    if (!current?.data) return null;
    const next = change(current.data);
    if (await writeIfUnchanged(blob, key, next, current)) {
      // The marker follows the record. It only drives the "needs reply" list,
      // so a failure here is logged rather than undoing the change.
      try {
        if (needsReply(next)) await blob.setJSON(unsentKey(id), { id });
        else await blob.delete(unsentKey(id));
      } catch (error) {
        logError('staff-inquiry-marker-failed', { id, message: errorMessage(error) });
      }
      return next;
    }
    if (attempt + 1 < attempts) await pauseBeforeRetry(attempt);
  }
  throw Object.assign(new Error('Someone else is updating that inquiry. Reload and try again.'), {
    statusCode: 409,
    expose: true,
  });
}

// Claims one email from the hourly, daily and per-sender allowance. Resolves
// true when the email may be sent and false when the allowance is spent;
// throws when the count could not be updated, which callers treat as spent.
export async function claimInquiryEmail(
  event,
  now = Date.now(),
  limits = INQUIRY_EMAIL_LIMITS,
  sender = null
) {
  const hour = Math.floor(now / 3600000);
  const day = Math.floor(now / DAY_MS);
  const { allowed } = await claim(store(event), EMAIL_BUDGET_KEY, (doc) => {
    const hourCount = doc.hour === hour ? Number(doc.hourCount) || 0 : 0;
    const dayCount = doc.day === day ? Number(doc.dayCount) || 0 : 0;
    const senders =
      doc.day === day && doc.senders && typeof doc.senders === 'object' ? doc.senders : {};
    const mine = sender ? Number(senders[sender]) || 0 : 0;
    if (hourCount >= limits.perHour || dayCount >= limits.perDay) return { allowed: false };
    if (sender && limits.perSenderPerDay && mine >= limits.perSenderPerDay) {
      return { allowed: false };
    }
    return {
      allowed: true,
      write: {
        hour,
        hourCount: hourCount + 1,
        day,
        dayCount: dayCount + 1,
        senders: sender ? { ...senders, [sender]: mine + 1 } : senders,
      },
    };
  });
  return allowed;
}
