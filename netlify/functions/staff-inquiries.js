import { requireStaff } from '../../server/staffAuth.js';
import { INQUIRY_ID_PATTERN, listInquiries, updateInquiry } from '../../server/inquiryStore.js';

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

// Lists service inquiries newest first, including the ones whose email never
// went out, and lets staff mark them handled.
export async function handler(event) {
  const session = await requireStaff(event);
  if (!session) return json(401, { error: 'Sign in to continue.' });

  if (event.httpMethod === 'GET') {
    const limit = Math.max(1, Math.min(200, Number(event.queryStringParameters?.limit) || 100));
    try {
      const { inquiries, total } = await listInquiries(event, { limit });
      return json(200, { staff: session.staff, inquiries, total });
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
