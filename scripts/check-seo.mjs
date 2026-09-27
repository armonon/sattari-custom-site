import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const origin = 'https://sattarimusic.com';
const sitemap = new JSDOM(await readFile('dist/sitemap.xml', 'utf8'), {
  contentType: 'application/xml',
});
const urls = [...sitemap.window.document.querySelectorAll('loc')].map((node) => node.textContent);
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URL');
const titles = new Set();
const descriptions = new Set();
const localTargets = [
  '/woodland-hills-drum-shop',
  '/encino-violin-shop',
  '/services/violin-repair-los-angeles',
  '/services/guitar-setup-los-angeles',
];
const linkedLocalTargets = new Set();
for (const path of localTargets) {
  assert.ok(urls.includes(origin + path), `${path}: new local page missing from sitemap`);
}
for (const url of urls) {
  const path = new URL(url).pathname;
  assert.equal(new URL(url).origin, origin);
  const file = path === '/' ? 'dist/index.html' : `dist${path}.html`;
  const dom = new JSDOM(await readFile(file, 'utf8'), { url });
  const doc = dom.window.document;
  for (const link of doc.querySelectorAll('a[href]')) {
    const target = new URL(link.href, url);
    if (
      target.origin === origin &&
      localTargets.includes(target.pathname) &&
      target.pathname !== path
    ) {
      linkedLocalTargets.add(target.pathname);
    }
  }
  if (localTargets.includes(path)) {
    assert.ok(doc.querySelector('address').textContent.includes('Woodland Hills'));
    assert.ok(
      doc.querySelectorAll('.local-advice h2').length >= 3,
      `${path}: missing specific guidance`
    );
    assert.ok(doc.querySelectorAll('details.faq-item').length >= 3, `${path}: missing FAQs`);
    for (const image of doc.querySelectorAll('.local-product img')) {
      await access(`dist${decodeURI(new URL(image.src).pathname)}`);
    }
  }
  const styles = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((node) => node.href);
  assert.equal(new Set(styles).size, styles.length, `${path}: duplicate stylesheet`);
  if (styles.length > 1)
    assert.match(styles[0], /\/assets\/index-/, `${path}: shell stylesheet must load first`);
  assert.equal(doc.querySelectorAll('title').length, 1, `${path}: title count`);
  assert.equal(
    doc.querySelectorAll('meta[name="description"]').length,
    1,
    `${path}: description count`
  );
  assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, 1, `${path}: canonical count`);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, url, `${path}: canonical mismatch`);
  assert.equal(doc.querySelector('meta[property="og:url"]').content, url);
  assert.equal(doc.querySelectorAll('h1').length, 1, `${path}: H1 count`);
  assert.ok(doc.querySelector('#root').textContent.length > 100, `${path}: empty initial content`);
  assert.ok(
    !doc.querySelector('meta[name="robots"]').content.includes('noindex'),
    `${path}: unexpectedly noindex`
  );
  assert.ok(!titles.has(doc.title), `${path}: duplicate title`);
  titles.add(doc.title);
  const description = doc.querySelector('meta[name="description"]').content;
  assert.ok(
    description.length > 40 && description.length <= 180,
    `${path}: description length ${description.length}`
  );
  assert.ok(!descriptions.has(description), `${path}: duplicate description`);
  descriptions.add(description);
  for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(node.textContent);
    assert.equal(data['@context'], 'https://schema.org');
    if (data['@type'] === 'MusicStore')
      assert.equal(data.address.addressLocality, 'Woodland Hills');
  }
  if (
    path.startsWith('/guides') ||
    path.startsWith('/tools/') ||
    ['/visit', '/privacy'].includes(path)
  ) {
    for (const image of doc.querySelectorAll('.resource-page img'))
      await access(`dist${decodeURI(new URL(image.src).pathname)}`);
    for (const audio of doc.querySelectorAll('.resource-page audio'))
      await access(`dist${decodeURI(new URL(audio.src).pathname)}`);
    for (const link of doc.querySelectorAll('.resource-page a[href]')) {
      const target = new URL(link.href);
      if (target.origin === origin && !target.pathname.startsWith('/audio/')) {
        assert.ok(
          urls.includes(origin + target.pathname),
          `${path}: unknown resource link ${target.pathname}`
        );
      }
    }
  }
  assert.ok(
    doc.querySelector('form[name="service-inquiry"][data-netlify]'),
    `${path}: Netlify form missing`
  );
  dom.window.close();
}
assert.equal(
  linkedLocalTargets.size,
  localTargets.length,
  'New local pages must have incoming internal links'
);
for (const path of [
  '/cart',
  '/checkout/success',
  '/checkout/cancel',
  '/instagram/callback',
  '/404',
]) {
  assert.ok(!urls.includes(origin + path), `${path}: private URL in sitemap`);
  const dom = new JSDOM(await readFile(`dist${path}.html`, 'utf8'));
  assert.match(dom.window.document.querySelector('meta[name="robots"]').content, /noindex/);
  dom.window.close();
}
// Pages that defer to another URL stay public but out of the sitemap.
for (const [path, canonical] of [['/shop/violins-los-angeles', '/shop/violins']]) {
  assert.ok(!urls.includes(origin + path), `${path}: canonicalized page in sitemap`);
  assert.ok(urls.includes(origin + canonical), `${path}: canonical ${canonical} not in sitemap`);
  const dom = new JSDOM(await readFile(`dist${path}.html`, 'utf8'), { url: origin + path });
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, 1, `${path}: canonical count`);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, origin + canonical);
  assert.ok(
    !doc.querySelector('meta[name="robots"]').content.includes('noindex'),
    `${path}: a canonicalized page must not also be noindex`
  );
  dom.window.close();
}
const shell = await readFile('dist/app.html', 'utf8');
assert.ok(
  !shell.includes('rel="canonical"'),
  'Dynamic product fallback must not canonicalize to the home page'
);
assert.ok(!urls.includes(`${origin}/services/music-classes-los-angeles`));
assert.ok(!urls.includes(`${origin}/services/drum-repair-los-angeles`));
sitemap.window.close();
console.log(
  `PASS: ${urls.length} public pages, unique metadata, canonical URLs, structured data, rendered content and private-page noindex.`
);
