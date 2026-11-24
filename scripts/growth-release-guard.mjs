/** Durable public-route and source-exposure release contract; never deploys. */
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const scriptDir = dirname(fileURLToPath(import.meta.url));
export async function verifyGrowthRelease(dist, { contract, approvedRemovals = [] } = {}) {
  contract ??= JSON.parse(await readFile(resolve(scriptDir, 'growth-route-contract.json'), 'utf8'));
  const xml = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  if (new Set(urls).size !== urls.length) throw Error('Duplicate sitemap URLs');
  const paths = new Set(
    urls.map((url) => {
      const parsed = new URL(url);
      if (parsed.origin !== contract.origin || parsed.search || parsed.hash)
        throw Error('Noncanonical sitemap origin/query/fragment');
      return parsed.pathname;
    })
  );
  const approved = new Set(
    approvedRemovals.map((row) => {
      if (!row.path || !row.reason?.trim())
        throw Error('Each approved removal needs path and reason');
      return row.path;
    })
  );
  const expected = [...contract.required_canonical_paths, ...contract.required_new_paths];
  for (const path of expected)
    if (!paths.has(path) && !approved.has(path))
      throw Error('Unapproved public URL removal: ' + path);
  for (const path of contract.excluded_paths)
    if (paths.has(path)) throw Error('Utility/retired route in sitemap: ' + path);
  const titles = new Set();
  for (const path of paths) {
    const html = await readFile(
      resolve(dist, path === '/' ? 'index.html' : path.slice(1) + '.html'),
      'utf8'
    );
    const canonical = [
      ...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"[^>]*>/g),
    ].map((m) => m[1]);
    if (canonical.length !== 1 || canonical[0] !== contract.origin + path)
      throw Error('Canonical mismatch: ' + path);
    if (/<meta\b[^>]*name="(?:robots|googlebot)"[^>]*content="[^"]*noindex/i.test(html))
      throw Error('Sitemap URL is noindex: ' + path);
    if ([...html.matchAll(/<h1\b/g)].length !== 1) throw Error('Expected one H1: ' + path);
    const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim();
    if (!title || titles.has(title)) throw Error('Missing/duplicate title: ' + path);
    titles.add(title);
  }
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name),
        rel = relative(dist, path).replaceAll('\\', '/');
      if (entry.isSymbolicLink()) throw Error('Public output contains symlink: ' + rel);
      // Vite build bookkeeping is private and must be stripped by assembly, not uploaded.
      if (rel === '.vite') continue;
      if (
        /(^|\/)(\.git|\.env(?:\..*)?|node_modules|src|server|tests|evidence|qualification)(\/|$)|\.map$|(^|\/)release-manifest\.json$/i.test(
          rel
        )
      )
        throw Error('Private source/metadata in public output: ' + rel);
      if (entry.isDirectory()) await walk(path);
    }
  }
  await walk(dist);
  return {
    passed: true,
    canonical_urls: paths.size,
    baseline_required: contract.required_canonical_paths.length,
    new_required: contract.required_new_paths.length,
    approved_removals: [...approved],
    private_build_bookkeeping_excluded: ['.vite'],
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(
    JSON.stringify(await verifyGrowthRelease(resolve(process.argv[2] || 'dist')), null, 2)
  );
}
