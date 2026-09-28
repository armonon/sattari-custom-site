import {
  checkPassword,
  checkUsername,
  createDeviceToken,
  createSession,
  currentSessionEpoch,
  getClientIp,
  isConfigured,
  SESSION_TTL_HOURS,
  verifyDeviceToken,
} from '../../server/staffAuth.js';
import {
  pruneLoginRecords,
  recordLoginSuccess,
  reserveLoginAttempt,
} from '../../server/loginThrottle.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';
import { hashIp } from '../../server/ipHash.js';

// No edge rate limit: the plan's two rules are spent elsewhere (see
// function-routes.test.js). The blob-backed throttle is what bounds password
// guesses. A custom path replaces the default URL, so both are listed.
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

// Logs carry a keyed hash of the address, never the address, and never what
// was typed as a username: a mistyped password often lands in that field.
function logLogin(type, ip, details) {
  console.log(JSON.stringify({ type, ipHash: hashIp(ip).slice(0, 16), ...details }));
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

  // Needed before the attempt is counted: a device token only counts under
  // the epoch it was issued in. If it cannot be read, device tokens are
  // ignored and the attempt is counted the ordinary way.
  let epoch = null;
  try {
    epoch = await currentSessionEpoch(event);
  } catch (error) {
    console.error(JSON.stringify({ type: 'staff-session-read-error', message: error?.message }));
  }

  // A browser that signed in before is counted on its own record rather than
  // against the site-wide ceiling. An invalid, expired or revoked token is
  // ignored.
  const device = epoch === null ? null : verifyDeviceToken(body?.device, { epoch });

  let reservation;
  try {
    reservation = await reserveLoginAttempt(event, ip, Date.now(), { device });
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
    logLogin('staff-login-failed', ip, { usernameMatched: usernameOk, device: Boolean(device) });
    return json(401, { error: 'That username or password is not right.' });
  }

  // A session is only issued under a known epoch; one minted under a guessed
  // epoch would be rejected by every staff function anyway.
  if (epoch === null) return json(503, { error: UNAVAILABLE });

  try {
    await recordLoginSuccess(event, ip, Date.now(), { device });
  } catch (error) {
    console.error(JSON.stringify({ type: 'throttle-clear-error', message: error?.message }));
  }
  context?.waitUntil?.(
    pruneLoginRecords(event).catch((error) =>
      console.error(JSON.stringify({ type: 'throttle-prune-error', message: error?.message }))
    )
  );

  logLogin('staff-login', ip, { device: Boolean(device) });

  return json(200, {
    token: createSession(staff, { epoch }),
    staff: staff.slice(0, 40),
    expiresInHours: SESSION_TTL_HOURS,
    // Renewed on every sign-in, keeping the same device id.
    deviceToken: createDeviceToken(device || undefined, { epoch }),
  });
}
