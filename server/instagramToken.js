import { createHash } from 'node:crypto';
import process from 'node:process';
import { openStore } from './blobs.js';

// Keeps the Instagram feed's access token alive without anyone logging in.
//
// Two ways to connect, chosen by configuration:
//
// - Instagram Login (default): INSTAGRAM_ACCESS_TOKEN is a long-lived token
//   that lasts 60 days. A scheduled function renews it and stores the renewed
//   token here; the feed reads the stored one. Saving a new token in Netlify
//   always wins over the stored one (see `seed`).
// - Business account: when INSTAGRAM_BUSINESS_ACCOUNT_ID is set, the token is
//   used as written against the Facebook Graph API. A Meta system-user token
//   created without an expiry never needs renewing, so nothing is stored.
//
// Tokens never appear in logs or responses.
export const INSTAGRAM_TOKEN_STORE = 'instagram-token';
const KEY = 'current';
const REFRESH_URL = 'https://graph.instagram.com/refresh_access_token';

// Identifies which configured token a stored one descends from, without
// keeping the configured token itself a second time.
function seedOf(token) {
  return createHash('sha256').update(token).digest('hex');
}

function settings() {
  return {
    configured: (process.env.INSTAGRAM_ACCESS_TOKEN || '').trim(),
    accountId: (process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '').trim(),
  };
}

async function readStored(store, configured) {
  const record = await store.get(KEY, { type: 'json' });
  if (!record?.token || record.seed !== seedOf(configured)) return null;
  return record;
}

// The token the feed should use right now: { mode, token, accountId } or null
// when nothing is configured. Storage trouble falls back to the configured
// token rather than taking the feed down.
export async function currentInstagramToken() {
  const { configured, accountId } = settings();
  if (!configured) return null;
  if (accountId) return { mode: 'business', token: configured, accountId };
  try {
    const stored = await readStored(openStore(undefined, INSTAGRAM_TOKEN_STORE), configured);
    if (stored) return { mode: 'instagram', token: stored.token, expiresAt: stored.expiresAt };
  } catch (error) {
    console.error(JSON.stringify({ type: 'instagram-token-read-failed', name: error?.name }));
  }
  return { mode: 'instagram', token: configured };
}

// Asks Instagram for a fresh 60-day token and stores it. Resolves with a
// summary that is safe to log. Instagram refuses a token younger than 24 hours
// or one that has already expired; both are reported, and the token in use is
// left as it was.
export async function renewInstagramToken(now = Date.now()) {
  const { configured, accountId } = settings();
  if (!configured) return { ok: false, reason: 'not-configured' };
  if (accountId) return { ok: true, skipped: 'business-token-does-not-expire' };

  const store = openStore(undefined, INSTAGRAM_TOKEN_STORE);
  const stored = await readStored(store, configured);
  const url = new URL(REFRESH_URL);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', stored?.token || configured);

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    return {
      ok: false,
      reason: 'instagram-refused',
      status: response.status,
      code: body?.error?.code,
      // Instagram's message can describe the token, so only its class is kept.
      errorType: body?.error?.type,
      expiresAt: stored?.expiresAt,
    };
  }

  const data = await response.json();
  const seconds = Number(data?.expires_in);
  if (!data?.access_token || !Number.isFinite(seconds) || seconds <= 0) {
    return { ok: false, reason: 'unexpected-response' };
  }
  const expiresAt = new Date(now + seconds * 1000).toISOString();
  await store.setJSON(KEY, {
    token: data.access_token,
    seed: seedOf(configured),
    expiresAt,
    refreshedAt: new Date(now).toISOString(),
  });
  return { ok: true, expiresAt, days: Math.round(seconds / 86400) };
}
