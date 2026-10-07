// Writes dist/studio-sw.js: src/pwa/studio-sw.js with this build's precache
// list (the six studio pages, every JS/CSS bundle except Split's large
// onnxruntime files, fonts and the two apps' icons/manifests). Runs after
// `vite build` and the prerender, as part of `npm run build`.
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const source = new URL('../src/pwa/studio-sw.js', import.meta.url);

const PAGES = { '/studio': 'studio.html' };
for (const tool of ['split', 'keybpm', 'vox', 'canvas', 'pocket'])
  PAGES[`/studio/${tool}`] = `studio/${tool}.html`;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(relative(dist, path).split(sep).join('/'));
  }
  return out;
}

const files = await walk(dist);
const wanted = files
  .filter(
    (file) =>
      (/^assets\/[^/]+\.(js|css)$/.test(file) && !/^assets\/ort-wasm/.test(file)) ||
      /^fonts\/[^/]+\.woff2$/.test(file) ||
      /^images\/(stemdeck|sattari-app)\/[^/]+\.png$/.test(file) ||
      file === 'studio.webmanifest' ||
      file === 'studio/sattari.webmanifest'
  )
  .sort();

const splitRuntime = files
  .filter((file) => /^assets\/ort-wasm-simd-threaded\.jsep-[^/]+\.(wasm|mjs)$/.test(file))
  .map((file) => `/${file}`);
if (splitRuntime.length !== 2)
  throw new Error(`Expected Split's 2 runtime files, found ${splitRuntime}`);

const template = await readFile(source, 'utf8');
const hash = createHash('sha256').update(template);
for (const [url, file] of Object.entries(PAGES)) {
  if (!files.includes(file)) throw new Error(`Missing prerendered page ${file}`);
  hash.update(url).update(await readFile(join(dist, file)));
}
for (const file of [...wanted, ...splitRuntime]) hash.update(file);
const build = hash.digest('hex').slice(0, 12);

const precache = [...Object.keys(PAGES), ...wanted.map((file) => `/${encodeURI(file)}`)];
if (
  !template.includes("'__BUILD__'") ||
  !template.includes('/* __PRECACHE__ */ []') ||
  !template.includes('/* __SPLIT_RUNTIME__ */ []')
)
  throw new Error('studio-sw.js placeholders missing');
const worker = template
  .replace("'__BUILD__'", JSON.stringify(build))
  .replace('/* __PRECACHE__ */ []', JSON.stringify(precache, null, 1))
  .replace('/* __SPLIT_RUNTIME__ */ []', JSON.stringify(splitRuntime));
await writeFile(join(dist, 'studio-sw.js'), worker);

let bytes = 0;
for (const file of [...Object.values(PAGES), ...wanted])
  bytes += (await readFile(join(dist, file))).length;
console.log(
  `studio-sw.js: build ${build}, ${precache.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB precached`
);
