import { realpathSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import process from 'node:process';
import { createServer } from 'vite';
import { EMPTY_CATALOG_DOC } from '../src/utils/catalogMerge.js';

process.env.NODE_ENV = 'production';

const INVENTORY_URL =
  process.env.PRERENDER_INVENTORY_URL || 'https://sattarimusic.com/api/inventory';
const INVENTORY_TIMEOUT_MS = 15000;

const root = process.cwd();
let template = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const savedTemplate = resolve(root, 'dist/.vite/prerender-template.html');
if (!template.includes('<!--app-head-->')) template = await readFile(savedTemplate, 'utf8');
const manifest = JSON.parse(await readFile(resolve(root, 'dist/.vite/manifest.json'), 'utf8'));
if (!template.includes('<!--app-head-->') || !template.includes('<!--app-html-->')) {
  throw new Error('Prerender placeholders are missing from index.html.');
}
await writeFile(savedTemplate, template);

// Use the live catalog so employee-added/hidden products and current stock
// match the shop at build time. If it cannot be reached (a preview or CI
// without network, or the live site being down during an emergency deploy),
// build from the built-in catalog rather than not building at all.
async function loadInventory() {
  try {
    const response = await fetch(INVENTORY_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(INVENTORY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const inventory = await response.json();
    if (!inventory || typeof inventory.stock !== 'object' || !inventory.catalog) {
      throw new Error('unexpected response shape');
    }
    if (inventory.degraded) throw new Error('the live catalog read was degraded');
    console.log(`Prerendering with the live catalog from ${INVENTORY_URL}.`);
    return inventory;
  } catch (error) {
    console.warn(
      [
        '',
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
        `WARNING: live inventory unavailable (${INVENTORY_URL}): ${error?.message || error}`,
        'Prerendering from the BUILT-IN catalog instead. Until the next build with',
        'live inventory: products staff added have no prerendered page (they still',
        'load through /product/*), products staff hid are prerendered, prices are',
        'the built-in ones, and every product is published as in stock.',
        '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
        '',
      ].join('\n')
    );
    return { stock: {}, catalog: EMPTY_CATALOG_DOC };
  }
}

const inventory = await loadInventory();

function realPath(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

// A route module is normally keyed by its source path. Vite records the real
// path, so when src/ is reached through a symlink (a build from another root)
// the key is a long relative path instead; compare resolved paths. When a
// lazily loaded helper also imports from the route (the Studio page), Rollup
// keys it by chunk name instead ("_SattariStudioPage-<hash>.js"), and the
// route would lose its stylesheet and preload.
function manifestChunk(entry) {
  if (manifest[entry]) return manifest[entry];
  const target = realPath(resolve(root, entry));
  const bySource = Object.values(manifest).find(
    (chunk) => chunk.src && realPath(resolve(root, chunk.src)) === target
  );
  if (bySource) return bySource;
  const name = entry
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '');
  const matches = Object.values(manifest).filter(
    (chunk) => chunk.isDynamicEntry && !chunk.src && chunk.name === name
  );
  return matches.length === 1 ? matches[0] : null;
}

// The route chunk and the chunks it imports, minus the app entry itself.
function routeModules(entry, seen = new Set()) {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const chunk = manifestChunk(entry);
  if (!chunk || chunk.isEntry) return [];
  return [
    ...new Set([chunk.file, ...(chunk.imports || []).flatMap((key) => routeModules(key, seen))]),
  ];
}

function routeCss(entry, seen = new Set()) {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const chunk = manifestChunk(entry);
  if (!chunk) return [];
  return [
    ...new Set([
      ...(chunk.imports || []).flatMap((key) => routeCss(key, seen)),
      ...(chunk.css || []),
    ]),
  ];
}

const server = await createServer({
  mode: 'production',
  cacheDir: 'node_modules/.vite-prerender',
  optimizeDeps: { noDiscovery: true, include: [] },
  ssr: { noExternal: ['react-helmet-async'] },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
});
try {
  await writeFile(
    resolve(root, 'dist/app.html'),
    template
      .replace('<!--app-head-->', '<title data-rh="true">Sattari Music</title>')
      .replace('<!--app-html-->', '')
  );
  const { getPrerenderRoutes, renderPage } = await server.ssrLoadModule('/src/entry-prerender.jsx');
  const routes = getPrerenderRoutes(inventory);
  // The inventory each page was rendered with. The browser starts from it
  // (main.tsx), so hydration sees the same prices and stock as the HTML
  // instead of the built-in catalog. Escaped so it cannot close the script.
  const inventorySnapshot = `<script type="application/json" id="inventory-snapshot">${JSON.stringify(
    { stock: inventory.stock, catalog: inventory.catalog }
  ).replace(/</g, '\\u003c')}</script>`;
  if (new Set(routes.map(({ path }) => path)).size !== routes.length)
    throw new Error('Duplicate prerender route.');
  for (const route of routes) {
    if (!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(route.path))
      throw new Error(`Invalid prerender path: ${route.path}`);
    const { html, head } = await renderPage(route.path, inventory);
    const globalCss = new Set(manifest['index.html']?.css || []);
    const css = routeCss(route.entry)
      .filter((file) => !globalCss.has(file))
      .map((file) => `<link rel="stylesheet" href="/${file}">`)
      .join('\n');
    // The browser hydrates once this code is in (main.tsx), so fetch all of it
    // alongside the app bundle rather than one import at a time.
    const preload = routeModules(route.entry)
      .filter((file) => !template.includes(`/${file}"`))
      .map((file) => `<link rel="modulepreload" href="/${file}">`)
      .join('\n');
    // Route styles must follow the shell styles, just as they do after a
    // normal lazy navigation. The root records which path this HTML is for:
    // Netlify also serves 404.html for every unknown URL, and main.tsx only
    // hydrates HTML rendered for the URL in the address bar.
    const page = template
      .replace('<!--app-head-->', () => `${head}\n${preload}`)
      .replace('</head>', () => `${css}\n</head>`)
      .replace(
        '<div id="root"><!--app-html-->',
        () => `<div id="root" data-prerendered-path="${route.path}">${html}`
      )
      .replace('</body>', () => `${inventorySnapshot}\n</body>`);
    if (!page.includes(`data-prerendered-path="${route.path}"`))
      throw new Error('index.html must contain <div id="root"><!--app-html--></div>.');
    const output = resolve(
      root,
      'dist',
      route.path === '/' ? 'index.html' : `${route.path.slice(1)}.html`
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, page);
    console.log(`Prerendered ${route.path}`);
  }
  const urls = routes
    .filter((route) => route.indexable)
    .map(({ path }) => `  <url><loc>https://sattarimusic.com${path}</loc></url>`);
  await writeFile(
    resolve(root, 'dist/sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
  );
  console.log(`Generated sitemap with ${urls.length} canonical URLs.`);
} finally {
  await server.close();
}
