import crypto from 'node:crypto';
import process from 'node:process';
import { Resend } from 'resend';

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

async function storeInquiry(event, record) {
  try {
    const { connectLambda, getStore } = await import('@netlify/blobs');
    connectLambda(event);
    const inquiryStore = getStore('service-inquiries');
    await inquiryStore.setJSON(`inquiries/${record.id}.json`, record);
    return true;
  } catch (error) {
    console.error('Service inquiry storage failed:', error);
    return false;
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request body.' });
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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SERVICE_INQUIRY_FROM || process.env.ORDER_NOTIFICATION_FROM;
  const to = process.env.SERVICE_INQUIRY_TO || process.env.ORDER_NOTIFICATION_EMAIL;

  const id = makeInquiryId();
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
    console.warn('Service inquiry email configuration missing; storing inquiry only.', {
      hasApiKey: Boolean(apiKey),
      hasFrom: Boolean(from),
      hasTo: Boolean(to),
    });
    const stored = await storeInquiry(event, record);
    if (!stored) {
      return json(500, { error: 'Unable to save your inquiry right now. Please try again soon.' });
    }
    return json(200, { ok: true, id, emailSent: false, stored: true });
  }

  try {
    const resend = new Resend(apiKey);
    const serviceLabel = SERVICE_LABELS[service] || service;
    const response = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `New Sattari service inquiry: ${serviceLabel}`,
      text: buildInquiryText({ service, name, email, phone, details, source }),
    });

    record.emailSent = true;
    record.emailId = response.data?.id || null;
    await storeInquiry(event, record);

    return json(200, {
      ok: true,
      id: record.emailId || id,
      inquiryId: id,
      emailSent: true,
      stored: true,
    });
  } catch (error) {
    console.error('Service inquiry email failed; attempting storage fallback:', error);
    const stored = await storeInquiry(event, record);
    if (stored) {
      return json(200, { ok: true, id, emailSent: false, stored: true });
    }
    return json(500, { error: 'Unable to send your inquiry right now. Please try again soon.' });
  }
}
