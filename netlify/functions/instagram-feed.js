import process from 'node:process';

// Every visitor sees the same nine posts, so the Instagram API is asked at most
// once per FRESH_MS per warm instance, the CDN's shared durable cache absorbs
// repeat views across edge nodes, and the edge rate limit covers cache-busting
// query strings. Instagram's own error text goes to the function log, never to
// visitors: it can describe the token and the account.
export const config = {
  path: '/.netlify/functions/instagram-feed',
};

const FRESH_MS = 10 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';

let cached = null;
let lastFailureAt = 0;

function reply(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function posts(list, { stale = false } = {}) {
  return reply(
    200,
    { posts: list },
    {
      'Cache-Control': 'public, max-age=300',
      'Netlify-CDN-Cache-Control': stale
        ? 'public, durable, max-age=60'
        : 'public, durable, max-age=900, stale-while-revalidate=3600',
    }
  );
}

function unavailable() {
  return reply(
    503,
    { error: 'Instagram feed is unavailable right now.' },
    {
      'Cache-Control': 'no-store',
    }
  );
}

async function fetchPosts(accessToken) {
  const url = new URL('https://graph.instagram.com/me/media');
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('limit', '9');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw Object.assign(new Error('Instagram API request failed.'), {
      status: response.status,
      detail,
    });
  }

  const data = await response.json();
  return (data.data || [])
    .filter((item) => ['IMAGE', 'CAROUSEL_ALBUM', 'VIDEO'].includes(item.media_type))
    .map((item) => ({
      id: item.id,
      image: item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url,
      permalink: item.permalink,
      caption: item.caption || '',
    }))
    .filter((item) => Boolean(item.image));
}

export default async function instagramFeed(request) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
  }

  const now = Date.now();
  if (cached && now - cached.at < FRESH_MS) return posts(cached.posts);
  // After a failure, wait before asking Instagram again rather than retrying
  // on every page view.
  if (now - lastFailureAt < RETRY_AFTER_FAILURE_MS) {
    return cached ? posts(cached.posts, { stale: true }) : unavailable();
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!accessToken) {
    console.error(JSON.stringify({ type: 'instagram-feed-not-configured' }));
    lastFailureAt = now;
    return unavailable();
  }

  try {
    const list = await fetchPosts(accessToken);
    cached = { posts: list, at: now };
    lastFailureAt = 0;
    return posts(list);
  } catch (error) {
    lastFailureAt = now;
    console.error(
      JSON.stringify({
        type: 'instagram-feed-failed',
        status: error?.status,
        name: error?.name,
        detail: error?.detail,
      })
    );
    return cached ? posts(cached.posts, { stale: true }) : unavailable();
  }
}
