import { requireStaff } from '../../server/staffAuth.js';
import { readMetrics } from '../../server/siteMetricsStore.js';

export async function handler(event) {
  const reply = (statusCode, value) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
    body: JSON.stringify(value),
  });
  if (!(await requireStaff(event))) return reply(401, { error: 'Sign in to continue.' });
  if (event.httpMethod !== 'GET') return reply(405, { error: 'Method not allowed.' });
  try {
    return reply(200, { days: await readMetrics(event) });
  } catch (error) {
    console.error(JSON.stringify({ type: 'staff-insights-error', message: error?.message }));
    return reply(503, { error: 'Reports are temporarily unavailable.' });
  }
}
