import { requireStaff } from '../../server/staffAuth.js';
import { INQUIRY_ID_PATTERN, listInquiries, updateInquiry } from '../../server/inquiryStore.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';

// A custom path replaces the default URL, so both are listed.
export const config = {
  path: ['/api/staff/inquiries', '/.netlify/functions/staff-inquiries'],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
    body: JSON.stringify(body),
  };
}

function markHandled(staff) {
  return (inquiry) => ({ ...inquiry, handledAt: new Date().toISOString(), handledBy: staff });
}

function reopen(inquiry) {
  const { handledAt, handledBy, ...rest } = inquiry;
  return rest;
}

export default async function staffInquiries(request, context) {
  return webResponse(await handle(await lambdaEvent(request, context)));
}

// Lists service inquiries newest first, a page at a time, optionally only the
// ones that were never emailed and are not handled yet, and lets staff mark
// them handled.
async function handle(event) {
  const session = await requireStaff(event);
  if (!session) return json(401, { error: 'Sign in to continue.' });

  if (event.httpMethod === 'GET') {
    const query = event.queryStringParameters || {};
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 50));
    const before = INQUIRY_ID_PATTERN.test(query.before || '') ? query.before : null;
    const filter = query.filter === 'unsent' ? 'unsent' : 'all';
    try {
      const page = await listInquiries(event, { limit, before, filter });
      return json(200, { staff: session.staff, filter, ...page });
    } catch (error) {
      console.error(
        JSON.stringify({ type: 'staff-inquiries-read-failed', message: error?.message })
      );
      return json(503, { error: 'Inquiries could not be loaded right now. Try Reload.' });
    }
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }
  const id = String(body?.id || '');
  if (!INQUIRY_ID_PATTERN.test(id) || !['handled', 'reopen'].includes(body?.action)) {
    return json(400, { error: 'Invalid inquiry action.' });
  }

  try {
    const inquiry = await updateInquiry(
      event,
      id,
      body.action === 'handled' ? markHandled(session.staff) : reopen
    );
    if (!inquiry) return json(404, { error: 'That inquiry no longer exists.' });
    console.log(
      JSON.stringify({
        type: 'staff-inquiry-update',
        staff: session.staff,
        id,
        action: body.action,
      })
    );
    return json(200, { staff: session.staff, inquiry });
  } catch (error) {
    if (error?.expose) return json(error.statusCode, { error: error.message });
    console.error(JSON.stringify({ type: 'staff-inquiry-update-failed', message: error?.message }));
    return json(503, { error: 'Could not save that change. Reload and try again.' });
  }
}
