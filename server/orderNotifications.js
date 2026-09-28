import process from 'node:process';
import { Resend } from 'resend';
import {
  buildOrderNotificationSubject,
  buildOrderNotificationText,
} from '../src/utils/orderProcessing.js';

// Recipients are comma-separated so the shop can notify more than one inbox
// (e.g. the owner and the shop address) without a code change.
export function parseRecipients(raw) {
  if (typeof raw !== 'string') return [];

  const seen = new Set();
  const recipients = [];

  for (const part of raw.split(/[,;]/)) {
    const address = part.trim();
    // Deliberately loose: this is a config value the shop controls, not user
    // input. The check exists to drop empties and obvious typos, not to
    // validate email grammar.
    if (!address || !address.includes('@') || address.includes(' ')) continue;

    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(address);
  }

  return recipients;
}

function getNotificationConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.ORDER_NOTIFICATION_FROM,
    to: parseRecipients(process.env.ORDER_NOTIFICATION_EMAIL),
  };
}

// The send gives up after this long, so a slow provider cannot hold the
// webhook or the scheduled sweep past its time limit. A send that timed out
// may still have gone through; the retry reuses the idempotency key, so the
// owner does not get it twice.
export const EMAIL_TIMEOUT_MS = 7000;

// `idempotencyKey` makes a retry after an uncertain outcome (a crash between
// Resend accepting the email and the order recording it) return the original
// send instead of emailing the owner twice. Resend honours a key for 24 hours
// and only for an identical payload, so the message must be built from order
// fields that no longer change once the sale is recorded.
export async function sendOrderNotification(
  orderRecord,
  { idempotencyKey, timeoutMs = EMAIL_TIMEOUT_MS } = {}
) {
  const { apiKey, from, to } = getNotificationConfig();

  if (!apiKey || !from || !to.length) {
    return {
      skipped: true,
      reason: 'Missing RESEND_API_KEY, ORDER_NOTIFICATION_FROM, or ORDER_NOTIFICATION_EMAIL.',
    };
  }

  const resend = new Resend(apiKey);
  const payload = {
    from,
    to,
    subject: buildOrderNotificationSubject(orderRecord),
    text: buildOrderNotificationText(orderRecord),
  };

  const response = await resend.emails.send(payload, {
    ...(idempotencyKey ? { idempotencyKey } : {}),
    signal: AbortSignal.timeout(timeoutMs),
  });

  // Resend reports per-request failures in the body rather than by throwing,
  // so a caller that only catches exceptions would record a silent success.
  if (response?.error) {
    throw new Error(response.error.message || 'Resend rejected the notification.');
  }

  return {
    skipped: false,
    id: response.data?.id || null,
    recipients: to.length,
  };
}
