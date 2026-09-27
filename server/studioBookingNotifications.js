import crypto from 'node:crypto';
import { Resend } from 'resend';
import { bookingSummary, money } from '../src/utils/studioBooking.js';
import { bookingConfig } from './studioBookingConfig.js';
import { patchBooking, readBookings } from './studioBookingStore.js';

// `text: false` records the owner's SMS alerts as skipped rather than pending,
// so a burst of requests cannot turn into a burst of paid text messages. The
// owner email is still queued and staff still see the request.
export function queueNotifications(booking, kind, { text = true } = {}) {
  const smsKeys = kind === 'request' ? bookingConfig().smsTo.map((_, i) => `ownerSms${i}`) : [];
  const keys =
    kind === 'request'
      ? ['ownerEmail', ...smsKeys]
      : [
          kind === 'approved'
            ? 'customerApproved'
            : kind === 'paid'
              ? 'customerPaid'
              : 'customerDeclined',
        ];
  const notifications = { ...booking.notifications };
  for (const key of keys) {
    notifications[key] ||=
      !text && smsKeys.includes(key)
        ? { state: 'skipped', attempts: 0, reason: 'Text alert limit reached' }
        : { state: 'pending', attempts: 0 };
  }
  return notifications;
}

function emailMessage(booking, key, config) {
  const details = `${bookingSummary(booking)}\n${booking.hours} hour${booking.hours === 1 ? '' : 's'}: ${money(booking.amountCents)}\nReference: ${booking.id}\n4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364`;
  if (key === 'ownerEmail')
    return {
      to: config.emailTo,
      replyTo: booking.email,
      subject: `Studio booking request: ${booking.date} - ${booking.name}`,
      text: `A customer requested studio / rehearsal time. It is not confirmed or paid.\n\n${details}\n\nName: ${booking.name}\nEmail: ${booking.email}\nPhone: ${booking.phone || 'Not supplied'}\nUse: ${booking.purpose}\nNotes: ${booking.notes || 'None'}\n\nReview and approve after signing in:\n${config.origin}/staff-cc6436694e.html#bookings`,
    };
  const messages = {
    customerApproved: () => ({
      subject: 'Your Sattari studio time is approved - complete your booking',
      text: `Hi ${booking.name},\n\nWe approved your studio time. Your booking is only final once payment succeeds.\n\n${details}\n\nPay securely with Stripe:\n${booking.checkoutUrl}\n\nThe payment link expires ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(booking.checkoutExpiresAt))} (Los Angeles time).\n\nQuestions or changes? Call (424) 465-3020.`,
    }),
    customerPaid: () => ({
      subject: 'Your Sattari studio booking is finalized',
      text: `Hi ${booking.name},\n\nPayment received. Your studio / rehearsal booking is finalized.\n\n${details}\n\nQuestions or changes? Call (424) 465-3020.`,
    }),
    customerDeclined: () => ({
      subject: 'An update on your Sattari studio request',
      text: `Hi ${booking.name},\n\nYour requested studio time could not be confirmed, or the unpaid reservation was cancelled. No studio booking has been finalized.\n\n${details}\n\nPlease contact (424) 465-3020 to arrange another time.`,
    }),
  };
  return { to: booking.email, ...messages[key]() };
}

async function send(booking, key) {
  const config = bookingConfig();
  if (key.startsWith('ownerSms')) {
    const to = config.smsTo[Number(key.slice('ownerSms'.length))];
    if (
      !to ||
      !process.env.TWILIO_ACCOUNT_SID ||
      !process.env.TWILIO_AUTH_TOKEN ||
      !process.env.TWILIO_FROM_NUMBER
    )
      throw new Error('SMS is not configured.');
    const body = new URLSearchParams({
      To: to,
      From: process.env.TWILIO_FROM_NUMBER,
      Body: `Sattari studio request: ${bookingSummary(booking)}. ${money(booking.amountCents)}. Ref ${booking.id}. Review: ${config.origin}/staff-cc6436694e.html#bookings`,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(process.env.TWILIO_ACCOUNT_SID)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      }
    );
    const result = await response.json();
    if (!response.ok || !result.sid || ['failed', 'undelivered'].includes(result.status))
      throw new Error('SMS provider rejected the booking alert.');
    return { providerId: result.sid, providerStatus: result.status };
  }
  if (!process.env.RESEND_API_KEY || !config.emailFrom) throw new Error('Email is not configured.');
  const response = await new Resend(process.env.RESEND_API_KEY).emails.send(
    {
      from: config.emailFrom,
      ...emailMessage(booking, key, config),
    },
    { idempotencyKey: `studio-${booking.id}-${key}` }
  );
  if (response.error || !response.data?.id)
    throw new Error('Email provider rejected the booking message.');
  return { providerId: response.data.id, providerStatus: 'accepted' };
}

export async function deliverBookingNotifications(event, id) {
  let booking = (await readBookings(event))[id];
  if (!booking) return;
  for (const key of Object.keys(booking.notifications || {})) {
    const lease = crypto.randomUUID();
    const now = Date.now();
    booking = await patchBooking(event, id, (current) => {
      const item = current.notifications[key];
      if (
        ['sent', 'skipped'].includes(item.state) ||
        item.attempts >= 8 ||
        item.nextAttemptAt > now ||
        item.leaseUntil > now
      )
        return {};
      if (
        (key === 'customerApproved' && current.status !== 'awaiting_payment') ||
        (key === 'customerPaid' && current.status !== 'paid')
      ) {
        return {
          notifications: { ...current.notifications, [key]: { ...item, state: 'skipped' } },
        };
      }
      return {
        notifications: {
          ...current.notifications,
          [key]: {
            ...item,
            state: 'sending',
            attempts: item.attempts + 1,
            lease,
            leaseUntil: now + 300000,
          },
        },
      };
    });
    if (booking.notifications[key].lease !== lease) continue;
    let result;
    try {
      result = { state: 'sent', sentAt: new Date().toISOString(), ...(await send(booking, key)) };
    } catch {
      result = {
        state: 'failed',
        error: 'Notification was not accepted by the provider. Check configuration and retry.',
        nextAttemptAt: now + Math.min(3600000, 60000 * 2 ** booking.notifications[key].attempts),
      };
      console.error(
        JSON.stringify({ type: 'studio-notification-failed', bookingId: id, channel: key })
      );
    }
    booking = await patchBooking(event, id, (current) =>
      current.notifications[key].lease !== lease
        ? {}
        : {
            notifications: {
              ...current.notifications,
              [key]: { ...current.notifications[key], ...result, lease: null, leaseUntil: 0 },
            },
          }
    );
  }
  return booking;
}
