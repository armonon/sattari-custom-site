import { parseRecipients } from './orderNotifications.js';
import { STUDIO_TIME_ZONE } from '../src/utils/studioBooking.js';

export function bookingConfig() {
  const env = process.env;
  const openHour = env.STUDIO_BOOKING_OPEN_HOUR ? Number(env.STUDIO_BOOKING_OPEN_HOUR) : null;
  const closeHour = env.STUDIO_BOOKING_CLOSE_HOUR ? Number(env.STUDIO_BOOKING_CLOSE_HOUR) : null;
  const days = (env.STUDIO_BOOKING_DAYS || '')
    .split(',')
    .filter((v) => v.trim() !== '')
    .map(Number);
  const scheduleReady =
    Number.isInteger(openHour) &&
    Number.isInteger(closeHour) &&
    openHour >= 0 &&
    closeHour <= 24 &&
    closeHour > openHour &&
    days.length > 0 &&
    days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const emailFrom =
    env.STUDIO_BOOKING_FROM || env.SERVICE_INQUIRY_FROM || env.ORDER_NOTIFICATION_FROM;
  const emailTo = parseRecipients(
    env.STUDIO_BOOKING_EMAIL || env.SERVICE_INQUIRY_TO || env.ORDER_NOTIFICATION_EMAIL
  );
  const smsTo = (env.STUDIO_BOOKING_SMS_TO || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const missing = [];
  if (!scheduleReady) missing.push('Confirmed studio hours and days');
  if (!env.RESEND_API_KEY || !emailFrom || !emailTo.length)
    missing.push('Resend API key, verified sender and booking notification email');
  if (
    !env.TWILIO_ACCOUNT_SID ||
    !env.TWILIO_AUTH_TOKEN ||
    !/^\+[1-9]\d{7,14}$/.test(env.TWILIO_FROM_NUMBER || '') ||
    !smsTo.length ||
    !smsTo.every((v) => /^\+[1-9]\d{7,14}$/.test(v))
  )
    missing.push('Twilio credentials, SMS sender and booking alert phone');
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)
    missing.push('Stripe checkout and webhook credentials');
  if (
    !env.STAFF_SESSION_SECRET ||
    !env.STAFF_USERNAME ||
    !env.STAFF_PASSWORD_HASH ||
    !env.STAFF_PASSWORD_SALT
  )
    missing.push('Staff authentication');
  if (env.STUDIO_BOOKING_ENABLED !== 'true') missing.push('STUDIO_BOOKING_ENABLED launch switch');
  const publicConfig = {
    enabled: missing.length === 0,
    timeZone: STUDIO_TIME_ZONE,
    openHour: scheduleReady ? openHour : null,
    closeHour: scheduleReady ? closeHour : null,
    days: scheduleReady ? [...new Set(days)] : [],
    durations:
      scheduleReady && env.STUDIO_BOOKING_EXTRA_HOURS === 'true'
        ? Array.from({ length: Math.min(12, closeHour - openHour) }, (_, i) => i + 1)
        : [1, 2, 3, 4],
    advanceDays: 90,
  };
  return { publicConfig, missing, emailFrom, emailTo, smsTo, origin: 'https://sattarimusic.com' };
}
