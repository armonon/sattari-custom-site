import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createServer } from 'vite';

process.env.NODE_ENV = 'production';

const root = process.cwd();
let template = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const savedTemplate = resolve(root, 'dist/.vite/prerender-template.html');
if (!template.includes('<!--app-head-->')) template = await readFile(savedTemplate, 'utf8');
const manifest = JSON.parse(await readFile(resolve(root, 'dist/.vite/manifest.json'), 'utf8'));
if (!template.includes('<!--app-head-->') || !template.includes('<!--app-html-->')) {
  throw new Error('Prerender placeholders are missing from index.html.');
}
await writeFile(savedTemplate, template);

// Use the public catalog so employee-added/hidden products and current stock
// match the shop at build time. Fail closed instead of publishing stale offers.
const response = await fetch('https://sattarimusic.com/api/inventory', { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`SEO catalog snapshot failed: ${response.status}`);
const inventory = await response.json();
if (!inventory || typeof inventory.stock !== 'object' || !inventory.catalog) {
  throw new Error('SEO catalog snapshot has an unexpected shape.');
}

function routeCss(entry, seen = new Set()) {
  if (seen.has(entry)) return [];
  seen.add(entry);
  const chunk = manifest[entry];
  if (!chunk) return [];
  return [...new Set([...(chunk.imports || []).flatMap((key) => routeCss(key, seen)), ...(chunk.css || [])])];
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
  await writeFile(resolve(root, 'dist/app.html'), template.replace('<!--app-head-->', '<title data-rh="true">Sattari Music</title>').replace('<!--app-html-->', ''));
  const { getPrerenderRoutes, renderPage } = await server.ssrLoadModule('/src/entry-prerender.jsx');
  const routes = getPrerenderRoutes(inventory);
  if (new Set(routes.map(({ path }) => path)).size !== routes.length) throw new Error('Duplicate prerender route.');
  for (const route of routes) {
    if (!/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/.test(route.path)) throw new Error(`Invalid prerender path: ${route.path}`);
    const { html, head } = await renderPage(route.path, inventory);
    const globalCss = new Set(manifest['index.html']?.css || []);
    const css = routeCss(route.entry).filter((file) => !globalCss.has(file))
      .map((file) => `<link rel="stylesheet" href="/${file}">`).join('\n');
    const chunk = manifest[route.entry];
    const preload = chunk ? `<link rel="modulepreload" href="/${chunk.file}">` : '';
    // Route styles must follow the shell styles, just as they do after a
    // normal lazy navigation. Preload the route to avoid a slow second fetch.
    const page = template.replace('<!--app-head-->', () => `${head}\n${preload}`)
      .replace('</head>', () => `${css}\n</head>`).replace('<!--app-html-->', () => html);
    const output = resolve(root, 'dist', route.path === '/' ? 'index.html' : `${route.path.slice(1)}.html`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, page);
    console.log(`Prerendered ${route.path}`);
  }
  const urls = routes.filter((route) => route.indexable).map(({ path }) =>
    `  <url><loc>https://sattarimusic.com${path}</loc></url>`
  );
  await writeFile(resolve(root, 'dist/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  console.log(`Generated sitemap with ${urls.length} canonical URLs.`);
} finally {
  await server.close();
}
