import {
  checkPassword,
  checkUsername,
  createSession,
  getClientIp,
  isConfigured,
  SESSION_TTL_HOURS,
} from '../../server/staffAuth.js';
import { clearFailures, getLockRemaining, recordFailure } from '../../server/loginThrottle.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!isConfigured()) {
    return json(500, {
      error:
        'Staff access is not configured. Set STAFF_USERNAME, STAFF_PASSWORD_SALT, STAFF_PASSWORD_HASH, and STAFF_SESSION_SECRET.',
    });
  }

  const ip = getClientIp(event);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const staff = String(body.staff || '').trim();
  if (!staff) {
    return json(400, { error: 'Enter the username.' });
  }

  try {
    const wait = await getLockRemaining(event, ip);
    if (wait > 0) {
      return json(429, {
        error: `Too many attempts. Try again in ${Math.ceil(wait / 1000)} seconds.`,
      });
    }
  } catch (error) {
    // Fail CLOSED here, unlike the storefront's stock read. If the throttle
    // cannot be consulted we cannot bound guessing, and refusing a login is a
    // far smaller cost than leaving the password open to unlimited attempts.
    console.error(JSON.stringify({ type: 'throttle-read-error', message: error?.message }));
    return json(503, { error: 'Sign-in is temporarily unavailable. Try again shortly.' });
  }

  // Username and password are checked together and reported together. Saying
  // which one was wrong would tell an attacker when they had found a valid
  // username, turning two unknowns back into one.
  const usernameOk = checkUsername(staff);
  const passwordOk = checkPassword(body.password);

  if (!usernameOk || !passwordOk) {
    try {
      await recordFailure(event, ip);
    } catch (error) {
      console.error(JSON.stringify({ type: 'throttle-write-error', message: error?.message }));
    }
    console.log(JSON.stringify({ type: 'staff-login-failed', staff: staff.slice(0, 40), ip }));
    return json(401, { error: 'That username or password is not right.' });
  }

  try {
    await clearFailures(event, ip);
  } catch (error) {
    console.error(JSON.stringify({ type: 'throttle-clear-error', message: error?.message }));
  }

  console.log(JSON.stringify({ type: 'staff-login', staff: staff.slice(0, 40), ip }));

  return json(200, {
    token: createSession(staff),
    staff: staff.slice(0, 40),
    expiresInHours: SESSION_TTL_HOURS,
  });
}
