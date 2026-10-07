/* global clients */
// Service worker for the installable studio apps: StemDeck (/studio) and the
// Sattari tools (/studio/split, keybpm, vox, canvas, pocket).
//
// Built by scripts/build-studio-sw.mjs, which swaps PRECACHE/BUILD below for
// the real file list of this build and writes dist/studio-sw.js. Registered
// with scope "/studio", so it never controls the shop, the marketing pages or
// the /downloads catalogue. Within that scope it only answers:
//   - navigations to the six studio pages: network first (3 s), then the
//     page precached with this build — so they open offline;
//   - same-origin /assets/, /fonts/, /images/ files of this build: from the
//     precache, falling back to the network;
//   - Split's runtime (onnxruntime wasm + its worker) only from the
//     "sattari-split-offline" cache that the page fills when someone presses
//     "Make Split available offline" (the 172 MB model itself lives in the
//     page's own model cache, sattari-demucs-v1);
//   - the thecreatingco.com suite menu script, stale-while-revalidate, so the
//     shared menu still draws offline.
// Everything else — user audio, /api, other origins (Hugging Face, Stripe,
// Locker), every other page — is not intercepted and never cached.
//
// The same script is also registered with scope "/assets/". Dedicated
// workers (Split, Key & BPM, Vox analysis) are matched to a registration by
// their own URL (/assets/*.worker-*.js), not by the page that starts them, so
// without it their scripts and the onnxruntime files they load would never
// reach this worker offline. That registration controls no pages: it only
// answers from the caches the /studio registration fills, and installs and
// activates straight away (hashed files never change under the same URL).
// Updates wait: skipWaiting() runs only when the page posts SKIP_WAITING after
// the user clicks "Reload" in the update prompt.
// Kill switch: scripts/kill-switch-studio-sw.js (see docs/STUDIO_PWA.md).

const BUILD = '__BUILD__';
const PRECACHE = /* __PRECACHE__ */ [];
// onnxruntime files Split's worker loads (~28 MB); cached only on request.
const SPLIT_RUNTIME = /* __SPLIT_RUNTIME__ */ [];

const SHELL_CACHE = `sattari-studio-shell-${BUILD}`;
const SUITE_CACHE = 'sattari-studio-suite-v1';
const SPLIT_CACHE = 'sattari-split-offline-v1';
const APP_PAGE = /^\/studio(?:\/(?:split|keybpm|vox|canvas|pocket))?\/?$/;
const SUITE_PREFIX = 'https://thecreatingco.com/suite/v1/';

const pagePath = (pathname) => pathname.replace(/\/+$/, '') || '/';
const ASSETS_SCOPE = new URL(self.registration.scope).pathname === '/assets/';

// Hashed build files (/assets/name-HASH.ext) never change under the same URL,
// so an update copies them from the previous shell instead of downloading again.
const HASHED = /^\/assets\//;

self.addEventListener('install', (event) => {
  if (ASSETS_SCOPE) {
    self.skipWaiting();
    return;
  }
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const previous = (await caches.keys()).filter(
        (name) => name.startsWith('sattari-studio-shell-') && name !== SHELL_CACHE
      );
      await Promise.all(
        PRECACHE.map(async (url) => {
          if (HASHED.test(url)) {
            for (const name of previous) {
              const hit = await (await caches.open(name)).match(url);
              if (hit) return cache.put(url, hit);
            }
          }
          // cache: 'reload' skips the HTTP cache so the precache matches this deploy.
          const response = await fetch(new Request(url, { cache: 'reload' }));
          if (!response.ok) throw new Error(`Precache failed: ${url} (${response.status})`);
          return cache.put(url, response);
        })
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (ASSETS_SCOPE) return clients.claim();
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('sattari-studio-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name))
      );
      // Someone who saved Split for offline keeps it across updates.
      await splitRuntime('refresh').catch(() => {});
      await clients.claim();
    })()
  );
});

// Opt-in offline Split: cache (or drop) this build's onnxruntime files. Keeps
// only the current build's files, so an update does not strand old 28 MB copies.
async function splitRuntime(action) {
  if (action === 'remove') {
    await caches.delete(SPLIT_CACHE);
    return { saved: false };
  }
  const exists = await caches.has(SPLIT_CACHE);
  const cache = await caches.open(SPLIT_CACHE);
  if (action === 'save' || (action === 'refresh' && exists)) {
    for (const request of await cache.keys())
      if (!SPLIT_RUNTIME.includes(new URL(request.url).pathname)) await cache.delete(request);
    for (const url of SPLIT_RUNTIME) if (!(await cache.match(url))) await cache.add(url);
  }
  const present = await Promise.all(SPLIT_RUNTIME.map((url) => cache.match(url)));
  if (!exists && action === 'status') await caches.delete(SPLIT_CACHE);
  return { saved: present.every(Boolean) };
}

self.addEventListener('message', (event) => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'SPLIT_OFFLINE') {
    const port = event.ports[0];
    event.waitUntil(
      splitRuntime(event.data.action)
        .then((result) => port?.postMessage(result))
        .catch((error) => port?.postMessage({ saved: false, error: error.message }))
    );
  }
});

async function fromShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  // ignoreVary: the precache fetch and a module-script request differ in
  // headers (Origin), which must not turn a precached file into a miss.
  return cache.match(request, { ignoreSearch: true, ignoreVary: true });
}

// Network first. If the network has not answered in 3 s, or fails, the page
// precached with this worker's build answers instead (always consistent with
// the precached bundles, unlike a stale copy of a newer deploy).
async function navigate(request, path) {
  const network = fetch(request);
  network.catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(resolve, 3000, 'timeout'));
  try {
    const first = await Promise.race([network, timeout]);
    if (first !== 'timeout') return first;
    return (await fromShell(path)) || (await network);
  } catch (error) {
    const cached = await fromShell(path);
    if (cached) return cached;
    throw error;
  }
}

// Hashed build files are immutable, so a copy in any of the studio caches
// (this build's shell, an older shell not yet cleaned up, offline Split) is right.
async function asset(request) {
  const cached = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
  return cached || fetch(request);
}

async function suiteScript(request) {
  const cache = await caches.open(SUITE_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      // The page loads it in CORS mode; only a complete, readable copy is kept.
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (request.url.startsWith(SUITE_PREFIX) && url.pathname.endsWith('.js'))
      event.respondWith(suiteScript(request));
    return;
  }

  if (request.mode === 'navigate') {
    if (ASSETS_SCOPE) return;
    const path = pagePath(url.pathname);
    if (APP_PAGE.test(path)) event.respondWith(navigate(request, path));
    return;
  }

  if (/^\/(assets|fonts|images)\//.test(url.pathname) || url.pathname.endsWith('.webmanifest'))
    event.respondWith(asset(request));
});
