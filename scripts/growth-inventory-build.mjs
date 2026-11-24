/** Production build wrapper: freeze a successful public inventory read and reject fallback HTML. */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyGrowthRelease } from './growth-release-guard.mjs';

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])])
    );
  return value;
}
export function inventoryPayload(value) {
  if (
    !value ||
    value.degraded ||
    !value.stock ||
    typeof value.stock !== 'object' ||
    Array.isArray(value.stock) ||
    !value.catalog ||
    typeof value.catalog !== 'object' ||
    Array.isArray(value.catalog)
  )
    throw Error('Inventory is missing, malformed or degraded; production build refused.');
  return { stock: value.stock, catalog: value.catalog };
}
export async function verifySnapshots(dist, expected) {
  const normalized = JSON.stringify(stable(inventoryPayload(expected)));
  let checked = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error('Publish output must not contain symlinks.');
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.html')) {
        const text = await readFile(file, 'utf8');
        if (!text.includes('data-prerendered-path=')) continue;
        const match = text.match(
          /<script\b[^>]*\bid="inventory-snapshot"[^>]*>([\s\S]*?)<\/script>/
        );
        if (!match || JSON.stringify(stable(inventoryPayload(JSON.parse(match[1])))) !== normalized)
          throw Error(`Inventory snapshot differs or is absent: ${relative(dist, file)}`);
        checked += 1;
      }
    }
  }
  await walk(dist);
  if (!checked) throw Error('No prerendered inventory snapshots found.');
  return { checked, inventory_sha256: createHash('sha256').update(normalized).digest('hex') };
}
export async function runInventoryBuild({
  cwd = process.cwd(),
  evidence,
  url = 'https://sattarimusic.com/api/inventory',
}) {
  if (!evidence) throw Error('Provide --evidence outside the public dist directory.');
  const output = resolve(cwd, evidence),
    dist = resolve(cwd, 'dist');
  if (output === dist || output.startsWith(dist + '/'))
    throw Error('Evidence cannot be written inside public dist.');
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`Inventory fetch failed: HTTP ${response.status}`);
  const snapshot = inventoryPayload(await response.json());
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'inventory-snapshot.json'), JSON.stringify(snapshot) + '\n');
  const server = createServer((request, res) => {
    if (request.method !== 'GET' || request.url !== '/inventory') {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(snapshot));
  });
  await new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', done);
  });
  try {
    const code = await new Promise((done, fail) => {
      const child = spawn('npm', ['run', 'build:assets'], {
        cwd,
        stdio: 'inherit',
        env: {
          ...process.env,
          PRERENDER_INVENTORY_URL: `http://127.0.0.1:${server.address().port}/inventory`,
        },
      });
      child.once('error', fail);
      child.once('exit', done);
    });
    if (code !== 0) throw Error(`Build failed: ${code}`);
    const checks = await verifySnapshots(dist, snapshot);
    const routes = await verifyGrowthRelease(dist);
    await writeFile(
      resolve(output, 'route-qualification.json'),
      JSON.stringify(routes, null, 2) + '\n'
    );
    const report = {
      passed: true,
      checked_at: new Date().toISOString(),
      inventory_url: url,
      ...checks,
    };
    await writeFile(
      resolve(output, 'inventory-build-qualification.json'),
      JSON.stringify(report, null, 2) + '\n'
    );
    return report;
  } finally {
    await new Promise((done) => server.close(done));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const i = process.argv.indexOf('--evidence');
  const report = await runInventoryBuild({ evidence: i < 0 ? null : process.argv[i + 1] });
  console.log(JSON.stringify(report));
}
