import { validMetric } from '../../src/utils/siteMetrics.js';
import { incrementMetric } from '../../server/siteMetricsStore.js';

export const config = {
  path: ['/api/site-event', '/.netlify/functions/site-event'],
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};

export default async function handler(request) {
  const reply = (status) =>
    new Response(null, {
      status,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  if (request.method !== 'POST') return reply(405);
  const { headers } = request;
  // CONTEXT is a build-time variable, not a guaranteed Lambda runtime value.
  if (new URL(request.url).hostname !== 'sattarimusic.com') return reply(204);
  if (
    headers.get('origin') !== 'https://sattarimusic.com' ||
    headers.get('content-type')?.split(';')[0] !== 'application/json'
  )
    return reply(403);
  if (Number(headers.get('content-length')) > 512) return reply(400);
  let metric;
  try {
    const body = await request.text();
    if (!body || new TextEncoder().encode(body).length > 512) return reply(400);
    metric = JSON.parse(body);
  } catch {
    return reply(400);
  }
  if (!validMetric(metric)) return reply(400);
  try {
    await incrementMetric(undefined, metric);
    return reply(204);
  } catch {
    return reply(503);
  }
}
