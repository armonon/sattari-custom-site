import { connectLambda, getStore } from '@netlify/blobs';

const DAY = 86400000;
export function metricDay(now = Date.now()) {
  const day = Math.floor(now / DAY);
  return { key: `day-${day % 90}`, date: new Date(day * DAY).toISOString().slice(0, 10) };
}
function store(event) {
  // V2 functions receive the Blobs context automatically; legacy staff uses Lambda.
  if (event) connectLambda(event);
  return getStore({ name: 'site-metrics', consistency: 'strong' });
}
export async function incrementMetric(event, metric, now = Date.now(), target = store(event)) {
  const { key, date } = metricDay(now);
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await target.getWithMetadata(key, { type: 'json' });
    const data = existing?.data?.date === date ? existing.data : { date, total: 0, counts: {} };
    if (data.total >= 100000) return;
    const cell = `${metric.source}|${metric.page}|${metric.event}`;
    const next = {
      date,
      total: data.total + 1,
      counts: { ...data.counts, [cell]: (data.counts[cell] || 0) + 1 },
    };
    const result = await target.setJSON(
      key,
      next,
      existing?.etag ? { onlyIfMatch: existing.etag } : { onlyIfNew: true }
    );
    if (result?.modified) return;
  }
  throw new Error('Metrics write contention');
}
export async function readMetrics(event, now = Date.now(), target = store(event)) {
  const rows = [];
  // Read only the reporting window, not a potentially unbounded blob listing.
  for (let start = 0; start < 90; start += 10) {
    const batch = await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        const { key, date } = metricDay(now - (start + i) * DAY);
        const data = await target.get(key, { type: 'json' });
        return data?.date === date ? data : null;
      })
    );
    rows.push(...batch.filter(Boolean));
  }
  return rows;
}
