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
  const from = process.env.ORDER_NOTIFICATION_FROM;
  const to = process.env.ORDER_NOTIFICATION_EMAIL;

  if (!apiKey || !from || !to) {
    return json(500, { error: 'Service inquiry email is not configured yet.' });
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

    return json(200, { ok: true, id: response.data?.id || null });
  } catch (error) {
    console.error('Service inquiry failed:', error);
    return json(500, { error: 'Unable to send your inquiry right now. Please try again soon.' });
  }
}
