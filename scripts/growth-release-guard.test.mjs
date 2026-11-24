import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventoryPayload, verifySnapshots } from './growth-inventory-build.mjs';
import { verifyGrowthRelease } from './growth-release-guard.mjs';
const snapshot = {
  stock: { violin: { quantity: 2 } },
  catalog: { products: [], hidden: ['retired-product'] },
};
const contract = {
  origin: 'https://sattarimusic.com',
  required_canonical_paths: ['/'],
  required_new_paths: ['/strings'],
  excluded_paths: ['/cart'],
};
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'sattari-growth-guard-'));
  for (const [file, path, title] of [
    ['index.html', '/', 'Home'],
    ['strings.html', '/strings', 'Strings'],
  ])
    await writeFile(
      join(root, file),
      `<title>${title}</title><link rel="canonical" href="https://sattarimusic.com${path}"><div data-prerendered-path="${path}"><h1>${title}</h1></div><script type="application/json" id="inventory-snapshot">${JSON.stringify(snapshot)}</script>`
    );
  await writeFile(
    join(root, 'sitemap.xml'),
    '<urlset><url><loc>https://sattarimusic.com/</loc></url><url><loc>https://sattarimusic.com/strings</loc></url></urlset>'
  );
  return root;
}
test('refuses degraded or malformed inventory before building', () => {
  for (const input of [{ degraded: true, ...snapshot }, { stock: [], catalog: {} }, { stock: {} }])
    assert.throws(() => inventoryPayload(input));
  assert.deepEqual(inventoryPayload(snapshot), snapshot);
});
test('accepts real snapshots and rejects silent built-in catalog fallback', async () => {
  const root = await fixture();
  try {
    assert.equal((await verifySnapshots(root, snapshot)).checked, 2);
    await writeFile(
      join(root, 'strings.html'),
      '<div data-prerendered-path="/strings"></div><script id="inventory-snapshot">{"stock":{},"catalog":{}}</script>'
    );
    await assert.rejects(() => verifySnapshots(root, snapshot), /snapshot differs/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('protects route retention, indexability and private source exposure', async () => {
  const root = await fixture();
  try {
    assert.equal((await verifyGrowthRelease(root, { contract })).canonical_urls, 2);
    await writeFile(
      join(root, 'sitemap.xml'),
      '<urlset><url><loc>https://sattarimusic.com/</loc></url></urlset>'
    );
    await assert.rejects(
      () => verifyGrowthRelease(root, { contract }),
      /Unapproved public URL removal/
    );
    await writeFile(
      join(root, 'sitemap.xml'),
      '<urlset><url><loc>https://sattarimusic.com/</loc></url><url><loc>https://sattarimusic.com/strings</loc></url></urlset>'
    );
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src', 'private.js'), 'private source');
    await assert.rejects(() => verifyGrowthRelease(root, { contract }), /Private source/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
