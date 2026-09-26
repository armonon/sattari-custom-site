// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const memory = vi.hoisted(() => new Map());
const target = vi.hoisted(() => ({
  get: vi.fn(async (key) => memory.get(key)?.data || null),
  getWithMetadata: vi.fn(async (key) => structuredClone(memory.get(key) || null)),
  setJSON: vi.fn(async (key, data, options) => {
    const old = memory.get(key);
    if ((options.onlyIfNew && old) || (options.onlyIfMatch && old?.etag !== options.onlyIfMatch))
      return { modified: false };
    memory.set(key, { data, etag: String(Number(old?.etag || 0) + 1) });
    return { modified: true };
  }),
}));
vi.mock('@netlify/blobs', () => ({ connectLambda: vi.fn(), getStore: () => target }));
vi.mock('../../server/staffAuth.js', () => ({ requireStaff: vi.fn(() => null) }));
import handler, { config } from '../../netlify/functions/site-event';
import { handler as staffHandler } from '../../netlify/functions/staff-insights';
import { incrementMetric, metricDay, readMetrics } from '../../server/siteMetricsStore';
import { requireStaff } from '../../server/staffAuth';
const metric = { event: 'page_view', page: 'guides', source: 'chatgpt' };
const request = (body = metric, options = {}, host = 'sattarimusic.com') =>
  new Request(`https://${host}/api/site-event`, {
    method: 'POST',
    headers: { origin: 'https://sattarimusic.com', 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...options,
  });
beforeEach(() => {
  memory.clear();
  vi.clearAllMocks();
  requireStaff.mockReturnValue(null);
});
afterEach(() => vi.unstubAllEnvs());
it('stores counts, not event records, IPs or headers', async () => {
  expect((await handler(request())).status).toBe(204);
  expect((await handler(request())).status).toBe(204);
  const data = [...memory.values()][0].data;
  expect(data).toEqual({
    date: metricDay().date,
    total: 2,
    counts: { 'chatgpt|guides|page_view': 2 },
  });
});
it('validates method, origin, payload size and allowlist before writing', async () => {
  expect((await handler(request(metric, { method: 'GET', body: undefined }))).status).toBe(405);
  expect((await handler(request(metric, { headers: {} }))).status).toBe(403);
  expect((await handler(request({ ...metric, email: 'person@example.com' }))).status).toBe(400);
  expect((await handler(request(metric, { body: 'x'.repeat(513) }))).status).toBe(400);
  expect((await handler(request(metric, { body: '{' }))).status).toBe(400);
  expect(target.setJSON).not.toHaveBeenCalled();
});
it('never collects draft traffic', async () => {
  const preview = request(metric, {}, 'draft--sattari.netlify.app');
  expect((await handler(preview)).status).toBe(204);
  expect(target.setJSON).not.toHaveBeenCalled();
});
it('rate-limits both the public route and direct function URL', () => {
  expect(config.path).toEqual(['/api/site-event', '/.netlify/functions/site-event']);
  expect(config.rateLimit).toEqual({
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  });
});
it('returns a retryable response when storage fails', async () => {
  target.getWithMetadata.mockRejectedValueOnce(new Error('Storage unavailable'));
  expect((await handler(request())).status).toBe(503);
});
it('aggregates concurrent writes without a lost increment', async () => {
  await Promise.all([
    incrementMetric({}, metric),
    incrementMetric({}, metric),
    incrementMetric({}, metric),
  ]);
  expect([...memory.values()][0].data.total).toBe(3);
});
it('reuses bounded day slots and excludes expired dates', async () => {
  const old = Date.UTC(2026, 0, 1);
  await incrementMetric({}, metric, old);
  expect(await readMetrics({}, old + 90 * 86400000)).toEqual([]);
  await incrementMetric({}, metric, old + 90 * 86400000);
  expect(memory.size).toBe(1);
  expect((await readMetrics({}, old + 90 * 86400000))[0].total).toBe(1);
});
it('requires staff auth for reports', async () => {
  expect((await staffHandler({ httpMethod: 'GET' })).statusCode).toBe(401);
  expect(target.get).not.toHaveBeenCalled();
  requireStaff.mockReturnValue({ staff: 'Owner' });
  expect((await staffHandler({ httpMethod: 'POST' })).statusCode).toBe(405);
  expect(JSON.parse((await staffHandler({ httpMethod: 'GET' })).body)).toEqual({ days: [] });
});
