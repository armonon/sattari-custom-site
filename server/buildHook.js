import process from 'node:process';
import { openStore, pauseBeforeRetry, writeIfUnchanged } from './blobs.js';
import { errorMessage, logError, logEvent } from './log.js';

// Product pages (title, description, JSON-LD price and availability) and the
// sitemap are rendered at build time from /api/inventory. Staff edits and
// sales change what those pages should say, but nothing rebuilt the site, so
// search results kept old prices, stock and products until an unrelated
// deploy.
//
// With BUILD_HOOK_URL set, a change that affects those pages records a
// rebuild request here. The scheduled checkout-maintenance run calls the hook
// once requests have been quiet for a while, and no more than once an hour, so
// a burst of edits costs one build. Without the variable every call is a no-op.
//
// BUILD_HOOK_URL is either GitHub's workflow-dispatch endpoint for the Build &
// Deploy workflow (with BUILD_HOOK_TOKEN), which rebuilds through the release
// gate and deploys only a qualified build, the default deploy path; or a
// Netlify build hook, for sites that deploy from Netlify builds instead
// (netlify.toml skips those otherwise). See docs/DEPLOYMENT.md.

const STORE = 'site-build';
const KEY = 'rebuild';

export const REBUILD_TIMING = {
  // Wait until edits have stopped for this long...
  quietMs: 5 * 60 * 1000,
  // ...but never hold a request back longer than this while edits continue.
  maxWaitMs: 60 * 60 * 1000,
  // Each production build costs deploy credits.
  minIntervalMs: 60 * 60 * 1000,
};

const isGithubDispatch = (url) =>
  url.hostname === 'api.github.com' && url.pathname.endsWith('/dispatches');

// The request for each kind of hook. GitHub needs a token and the branch.
function hookRequest(url, reasons) {
  if (!isGithubDispatch(url)) {
    url.searchParams.set('trigger_title', `Shop data changed: ${reasons.join(', ')}`.slice(0, 200));
    return { method: 'POST' };
  }
  const token = process.env.BUILD_HOOK_TOKEN;
  if (!token) throw new Error('BUILD_HOOK_TOKEN is required for a GitHub workflow dispatch.');
  return {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: process.env.BUILD_HOOK_REF || 'main' }),
  };
}

function hookUrl() {
  const raw = process.env.BUILD_HOOK_URL || '';
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

async function update(event, mutate) {
  const store = openStore(event, STORE);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await store.getWithMetadata(KEY, { type: 'json' });
    const next = mutate(current?.data || {});
    if (!next) return { doc: current?.data || {}, changed: false };
    if (await writeIfUnchanged(store, KEY, next, current)) return { doc: next, changed: true };
    await pauseBeforeRetry(attempt);
  }
  throw new Error('The rebuild request stayed contended.');
}

// Records that the published pages are out of date. Never throws: a rebuild
// request must not fail the save or the sale that made it.
export async function requestSiteRebuild(event, reason, now = Date.now()) {
  if (!hookUrl()) return false;
  try {
    await update(event, (doc) => ({
      ...doc,
      pending: true,
      firstRequestedAt: doc.pending ? doc.firstRequestedAt : now,
      lastRequestedAt: now,
      reasons: [...new Set([...(doc.pending ? doc.reasons || [] : []), reason])].slice(-10),
    }));
    return true;
  } catch (error) {
    logError('site-rebuild-request-error', { reason, message: errorMessage(error) });
    return false;
  }
}

// How long the hook call may take. It runs at the start of the scheduled
// maintenance run and counts against that run's time.
export const HOOK_TIMEOUT_MS = 5000;

// Calls the build hook when a request is due. Claims the request before the
// call, so overlapping runs cannot start two builds; a failed call puts it
// back, to be retried after the minimum interval. Past `deadline` it leaves
// the request for the next run.
export async function flushSiteRebuild(
  event,
  { now = Date.now(), fetchImpl = globalThis.fetch, deadline = Infinity } = {}
) {
  if (Date.now() > deadline) return { triggered: false };
  const url = hookUrl();
  if (!url) {
    if (process.env.BUILD_HOOK_URL) {
      logError('site-rebuild-bad-url', { message: 'BUILD_HOOK_URL is not an https URL.' });
    }
    return { triggered: false };
  }

  let requested = null;
  const { changed } = await update(event, (doc) => {
    if (!doc.pending) return null;
    const quiet = now - doc.lastRequestedAt >= REBUILD_TIMING.quietMs;
    const overdue = now - doc.firstRequestedAt >= REBUILD_TIMING.maxWaitMs;
    const spaced = !(now - (doc.triggeredAt || 0) < REBUILD_TIMING.minIntervalMs);
    if (!(quiet || overdue) || !spaced) return null;
    requested = doc;
    return { ...doc, pending: false, triggeredAt: now, reasons: [] };
  });
  if (!changed) return { triggered: false };

  const reasons = requested.reasons || [];
  try {
    const response = await fetchImpl(url, {
      ...hookRequest(url, reasons),
      signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`The build hook answered ${response.status}.`);
    logEvent({ type: 'site-rebuild-triggered', reasons });
    return { triggered: true, reasons };
  } catch (error) {
    // The URL is a credential of sorts, so only the failure is logged.
    logError('site-rebuild-hook-error', { reasons, message: errorMessage(error) });
    await update(event, (doc) => ({
      ...doc,
      pending: true,
      firstRequestedAt: doc.pending ? doc.firstRequestedAt : requested.firstRequestedAt,
      lastRequestedAt: Math.max(doc.lastRequestedAt || 0, requested.lastRequestedAt || 0),
      reasons: [...new Set([...reasons, ...(doc.pending ? doc.reasons || [] : [])])].slice(-10),
    })).catch(() => {});
    return { triggered: false, failed: true };
  }
}
