import process from 'node:process';
import { Resend } from 'resend';
import { buildOrderNotificationText, formatOrderCurrency } from '../src/utils/orderProcessing.js';

function getNotificationConfig() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.ORDER_NOTIFICATION_FROM,
    to: process.env.ORDER_NOTIFICATION_EMAIL,
  };
}

export async function sendOrderNotification(orderRecord) {
  const { apiKey, from, to } = getNotificationConfig();

  if (!apiKey || !from || !to) {
    return {
      skipped: true,
      reason: 'Missing RESEND_API_KEY, ORDER_NOTIFICATION_FROM, or ORDER_NOTIFICATION_EMAIL.',
    };
  }

  const resend = new Resend(apiKey);
  const subject = `New Sattari order ${formatOrderCurrency(orderRecord.amountTotal, orderRecord.currency) || ''}`.trim();

  const response = await resend.emails.send({
    from,
    to,
    subject,
    text: buildOrderNotificationText(orderRecord),
  });

  return {
    skipped: false,
    id: response.data?.id || null,
  };
}