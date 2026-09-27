// Real 404s for product URLs that do not exist.
//
// netlify.toml rewrites every /product/* URL to the app shell with status 200,
// so products staff add after a build still load. That also turns any made-up
// slug into a 200 "soft 404". This passes each response through unchanged,
// except that a slug missing from the catalog the shop sells gets status 404.
// Whenever the catalog cannot be looked up, nothing is changed.

import { products as baseProducts } from '../../src/data/catalog.js';
import { mergeCatalog } from '../../src/utils/catalogMerge.js';

export const config = { path: '/product/*', onError: 'bypass' };

const CACHE_TTL_MS = 60_000;
const FAILURE_TTL_MS = 10_000;
const LOOKUP_TIMEOUT_MS = 1_500;

// The slug the app's /product/:slug route would see, or null when the path
// cannot match that route at all (the app renders its not-found page then).
export function productSlugFromPath(pathname) {
  const match = /^\/product\/([^/]+?)(?:\.html)?\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

// Slugs the shop sells, from an /api/inventory payload: the same merge the
// storefront and create-checkout-session apply. null means the payload cannot
// be trusted to say what exists.
export function listedProductSlugs(payload) {
  if (!payload || typeof payload !== 'object') return null;
  // A degraded read came back without the staff catalog, so staff-added
  // products would look missing.
  if (payload.degraded) return null;
  if (!payload.catalog || typeof payload.catalog !== 'object') return null;
  return new Set(mergeCatalog(baseProducts, payload.catalog).map((product) => product.slug));
}

export function isUnlistedProductPath(pathname, listedSlugs) {
  if (!listedSlugs) return false;
  const slug = productSlugFromPath(pathname);
  return slug === null || !listedSlugs.has(slug);
}

export function createProductNotFoundHandler({
  fetchImpl = (...args) => fetch(...args),
  now = () => Date.now(),
} = {}) {
  let cached = null;
  let pending = null;

  async function fetchListedSlugs(origin) {
    const response = await fetchImpl(new URL('/api/inventory', origin), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return listedProductSlugs(await response.json());
  }

  // Shared per isolate, so a burst of product views costs one lookup.
  function lookup(origin) {
    if (cached && cached.expires > now()) return Promise.resolve(cached.slugs);
    if (!pending) {
      pending = fetchListedSlugs(origin)
        .catch(() => null)
        .then((slugs) => {
          cached = { slugs, expires: now() + (slugs ? CACHE_TTL_MS : FAILURE_TTL_MS) };
          pending = null;
          return slugs;
        });
    }
    return pending;
  }

  return async function productNotFound(request, context) {
    const url = new URL(request.url);
    const [response, listedSlugs] = await Promise.all([context.next(), lookup(url.origin)]);

    if (request.method !== 'GET' && request.method !== 'HEAD') return response;
    // Only the app shell (or a prerendered page) is ever rewritten; leave
    // redirects, 304s and errors alone.
    if (response.status !== 200) return response;
    if (!isUnlistedProductPath(url.pathname, listedSlugs)) return response;

    return new Response(response.body, {
      status: 404,
      statusText: 'Not Found',
      headers: response.headers,
    });
  };
}

export default createProductNotFoundHandler();
