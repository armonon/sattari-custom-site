import { requireStaff, revokeAllSessions, revokeSession } from '../../server/staffAuth.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';

// A custom path replaces the default URL, so both are listed.
export const config = {
  path: ['/api/staff/logout', '/.netlify/functions/staff-logout'],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

// Signing out in the page only forgets the token in that tab; a copied token
// would keep working until it expired. This ends it on the server: this
// sign-in by default, or every sign-in when `everywhere` is true.
export default async function staffLogout(request, context) {
  return webResponse(await handle(await lambdaEvent(request, context)));
}

async function handle(event) {
  const session = await requireStaff(event);
  if (!session) {
    return json(401, { error: 'Sign in to continue.' });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }
  const everywhere = body?.everywhere === true;

  try {
    if (everywhere) await revokeAllSessions(event);
    else await revokeSession(event, session);
  } catch (error) {
    console.error(JSON.stringify({ type: 'staff-logout-failed', message: error?.message }));
    return json(503, { error: 'Could not finish signing out on the server. Try again.' });
  }

  console.log(JSON.stringify({ type: 'staff-logout', staff: session.staff, everywhere }));
  return json(200, { ok: true, everywhere });
}
