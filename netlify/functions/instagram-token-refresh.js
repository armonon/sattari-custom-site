import { renewInstagramToken } from '../../server/instagramToken.js';

// Mondays and Thursdays at 10:00 UTC. An Instagram long-lived token lasts 60
// days and each renewal restarts the 60 days, so a run can fail for weeks
// before the feed is affected. Scheduled functions run on the published
// production deploy only and cannot be called over HTTP.
export const config = { schedule: '0 10 * * 1,4' };

export default async function instagramTokenRefresh() {
  let result;
  try {
    result = await renewInstagramToken();
  } catch (error) {
    result = { ok: false, reason: 'failed', name: error?.name };
  }
  const line = JSON.stringify({ type: 'instagram-token-refresh', ...result });
  if (result.ok) console.log(line);
  else console.error(line);
  return new Response(null, { status: 204 });
}
