import crypto from 'node:crypto';
import process from 'node:process';
import { Resend } from 'resend';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';
import {
  claimInquiryEmail,
  INQUIRY_EMAIL_LIMITS,
  saveInquiry,
  storageLimitReached,
} from '../../server/inquiryStore.js';
import { hashIp } from '../../server/ipHash.js';
import { getClientIp } from '../../server/staffAuth.js';

// The public form posts to Netlify Forms first and only falls back to this
// function, but the function is reachable directly, so it carries its own
// limits: this per-address edge limit, a honeypot, and email and storage
// allowances (see inquiryStore.js) for floods spread across many addresses.
export const config = {
  path: ['/api/service-inquiry', '/.netlify/functions/service-inquiry'],
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

const MAX_BODY_CHARS = 20000;

const SERVICE_LABELS = {
  'instrument-sales': 'Instruments / gear',
  accessories: 'Accessories',
  repairs: 'Repairs',
  rentals: 'Instrument rentals',
  rehearsal: 'Rehearsal space',
  lessons: 'Teachers / classes',
  studio: 'Rental studio',
  'audio-alpha': 'Audio Suite alpha access',
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function clean(value, maxLength = 2000) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeInquiryId() {
  return `inq_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// `bot-field` is the honeypot Netlify Forms already watches for this form.
function honeypotFilled(payload) {
  return ['bot-field', 'website'].some((field) => String(payload?.[field] ?? '').trim() !== '');
}

function buildInquiryText({ service, name, email, phone, details, source }) {
  const serviceLabel = SERVICE_LABELS[service] || service || 'Not specified';

  return [
    'New Sattari service inquiry',
    '',
    `Service: ${serviceLabel}`,
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || 'Not supplied'}`,
    `Source: ${source || 'Website service form'}`,
    '',
    'Details:',
    details,
  ].join('\n');
}

// A keyed hash of the sender's address, for the per-sender allowances. None
// without a known address or a key, and those allowances are then skipped.
function senderKey(event) {
  const ip = getClientIp(event);
  if (!ip || ip === 'unknown') return null;
  try {
    return hashIp(ip).slice(0, 16);
  } catch {
    return null;
  }
}

// Resolves { stored, limited }: `limited` when today's storage allowance was
// used up rather than storage failing.
async function storeInquiry(event, record, sender) {
  try {
    await saveInquiry(event, record, { sender });
    return { stored: true, limited: false };
  } catch (error) {
    const limited = storageLimitReached(error);
    console.error(
      JSON.stringify({
        type: limited ? 'service-inquiry-store-limited' : 'service-inquiry-store-failed',
        inquiryId: record.id,
        message: error?.message,
      })
    );
    return { stored: false, limited };
  }
}

// Resend reports API and network failures in `error` rather than throwing, so
// a resolved call is not a sent email until it returns an id.
async function sendInquiryEmail(record, { apiKey, from, to }) {
  try {
    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to,
      replyTo: record.email,
      subject: `New Sattari service inquiry: ${record.serviceLabel}`,
      text: buildInquiryText(record),
    });
    if (!error && data?.id) return data.id;
    console.error(
      JSON.stringify({
        type: 'service-inquiry-email-failed',
        inquiryId: record.id,
        reason: error?.name || 'no-email-id',
        message: error?.message,
      })
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        type: 'service-inquiry-email-failed',
        inquiryId: record.id,
        reason: error?.name || 'exception',
        message: error?.message,
      })
    );
  }
  return null;
}

export default async function serviceInquiry(request, context) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_CHARS) {
    return webResponse(json(413, { error: 'Request is too large.' }));
  }
  return webResponse(await handle(await lambdaEvent(request, context)));
}

async function handle(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }
  if ((event.body || '').length > MAX_BODY_CHARS) {
    return json(413, { error: 'Request is too large.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(400, { error: 'Invalid request body.' });
  }

  const id = makeInquiryId();

  if (honeypotFilled(payload)) {
    // Looks exactly like success; nothing is stored or emailed.
    console.log(JSON.stringify({ type: 'service-inquiry-honeypot' }));
    return json(200, { ok: true, id, inquiryId: id, emailSent: true, stored: true });
  }

  const service = clean(payload.service, 80);
  const name = clean(payload.name, 120);
  const email = clean(payload.email, 180);
  const phone = clean(payload.phone, 80);
  const details = clean(payload.details, 4000);
  const source = clean(payload.source, 200);

  if (!service || !name || !email || !details) {
    return json(400, { error: 'Please fill out service, name, email, and details.' });
  }

  if (!isEmail(email)) {
    return json(400, { error: 'Please enter a valid email address.' });
  }

  const sender = senderKey(event);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SERVICE_INQUIRY_FROM || process.env.ORDER_NOTIFICATION_FROM;
  const to = process.env.SERVICE_INQUIRY_TO || process.env.ORDER_NOTIFICATION_EMAIL;

  const record = {
    id,
    service,
    serviceLabel: SERVICE_LABELS[service] || service,
    name,
    email,
    phone,
    details,
    source: source || 'Website service form',
    recordedAt: new Date().toISOString(),
    emailSent: false,
  };

  if (!apiKey || !from || !to) {
    console.warn(
      JSON.stringify({
        type: 'service-inquiry-email-not-configured',
        inquiryId: id,
        hasApiKey: Boolean(apiKey),
        hasFrom: Boolean(from),
        hasTo: Boolean(to),
      })
    );
    record.emailError = 'not-configured';
  } else {
    let allowed = false;
    try {
      allowed = await claimInquiryEmail(event, Date.now(), INQUIRY_EMAIL_LIMITS, sender);
    } catch (error) {
      console.error(
        JSON.stringify({ type: 'service-inquiry-allowance-unavailable', message: error?.message })
      );
    }
    if (!allowed) {
      console.warn(JSON.stringify({ type: 'service-inquiry-email-limited', inquiryId: id }));
      record.emailError = 'limit';
    } else {
      const emailId = await sendInquiryEmail(record, { apiKey, from, to });
      if (emailId) {
        record.emailSent = true;
        record.emailId = emailId;
      } else {
        record.emailError = 'provider';
      }
    }
  }

  const { stored, limited } = await storeInquiry(event, record, sender);

  // Only tell the customer it arrived if someone will actually see it: in the
  // inbox, or in the staff page's inquiry list.
  if (!record.emailSent && !stored) {
    return limited
      ? json(429, {
          error:
            'We are receiving an unusual number of messages right now. Please call (424) 465-3020 or try again later.',
        })
      : json(500, { error: 'Unable to send your inquiry right now. Please try again soon.' });
  }

  return json(200, {
    ok: true,
    id: record.emailId || id,
    inquiryId: id,
    emailSent: record.emailSent,
    stored,
  });
}
