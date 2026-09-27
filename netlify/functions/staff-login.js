import {
  checkPassword,
  checkUsername,
  createSession,
  currentSessionEpoch,
  getClientIp,
  isConfigured,
  SESSION_TTL_HOURS,
} from '../../server/staffAuth.js';
import {
  pruneLoginRecords,
  recordLoginSuccess,
  reserveLoginAttempt,
} from '../../server/loginThrottle.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';

// The edge limit is a cheap outer bound on request volume per address; the
// blob-backed throttle below is what bounds password guesses.
export const config = {
  path: ['/api/staff/login', '/.netlify/functions/staff-login'],
};

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
    body: JSON.stringify(body),
  };
}

const UNAVAILABLE = 'Sign-in is temporarily unavailable. Try again shortly.';

export default async function staffLogin(request, context) {
  return webResponse(await login(await lambdaEvent(request, context), context));
}

async function login(event, context) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!isConfigured()) {
    console.error(JSON.stringify({ type: 'staff-login-not-configured' }));
    return json(503, { error: UNAVAILABLE });
  }

  const ip = getClientIp(event);

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const staff = String(body?.staff || '').trim();
  if (!staff) {
    return json(400, { error: 'Enter the username.' });
  }

  let reservation;
  try {
    reservation = await reserveLoginAttempt(event, ip);
  } catch (error) {
    // Fail CLOSED. If an attempt cannot be counted, guessing is unbounded, and
    // refusing a sign-in costs far less than that.
    console.error(JSON.stringify({ type: 'throttle-unavailable', message: error?.message }));
    return json(503, { error: UNAVAILABLE });
  }
  if (!reservation.allowed) {
    const seconds = Math.max(1, Math.ceil(reservation.retryAfterMs / 1000));
    return json(
      429,
      { error: `Too many attempts. Try again in ${seconds} seconds.` },
      { 'Retry-After': String(seconds) }
    );
  }

  // Username and password are checked together and reported together. Saying
  // which one was wrong would tell an attacker when they had found a valid
  // username, turning two unknowns back into one.
  const usernameOk = checkUsername(staff);
  const passwordOk = checkPassword(body.password);

  if (!usernameOk || !passwordOk) {
    console.log(JSON.stringify({ type: 'staff-login-failed', staff: staff.slice(0, 40), ip }));
    return json(401, { error: 'That username or password is not right.' });
  }

  let epoch;
  try {
    epoch = await currentSessionEpoch(event);
  } catch (error) {
    console.error(JSON.stringify({ type: 'staff-session-read-error', message: error?.message }));
    return json(503, { error: UNAVAILABLE });
  }

  try {
    await recordLoginSuccess(event, ip);
  } catch (error) {
    console.error(JSON.stringify({ type: 'throttle-clear-error', message: error?.message }));
  }
  context?.waitUntil?.(
    pruneLoginRecords(event).catch((error) =>
      console.error(JSON.stringify({ type: 'throttle-prune-error', message: error?.message }))
    )
  );

  console.log(JSON.stringify({ type: 'staff-login', staff: staff.slice(0, 40), ip }));

  return json(200, {
    token: createSession(staff, { epoch }),
    staff: staff.slice(0, 40),
    expiresInHours: SESSION_TTL_HOURS,
  });
}
