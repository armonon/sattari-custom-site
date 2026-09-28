import { requireStaff } from '../../server/staffAuth.js';
import { readMetrics } from '../../server/siteMetricsStore.js';
import { lambdaEvent, webResponse } from '../../server/functionAdapter.js';

// A custom path replaces the default URL, so both are listed.
export const config = {
  path: ['/api/staff/insights', '/.netlify/functions/staff-insights'],
};

function reply(statusCode, value) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
    body: JSON.stringify(value),
  };
}

export default async function staffInsights(request, context) {
  return webResponse(await handle(await lambdaEvent(request, context)));
}

async function handle(event) {
  if (!(await requireStaff(event))) return reply(401, { error: 'Sign in to continue.' });
  if (event.httpMethod !== 'GET') return reply(405, { error: 'Method not allowed.' });
  try {
    return reply(200, { days: await readMetrics(event) });
  } catch (error) {
    console.error(JSON.stringify({ type: 'staff-insights-error', message: error?.message }));
    return reply(503, { error: 'Reports are temporarily unavailable.' });
  }
}
