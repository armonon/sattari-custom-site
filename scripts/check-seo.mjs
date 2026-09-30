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
  const entities = [];
  for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(node.textContent);
    assert.equal(data['@context'], 'https://schema.org');
    entities.push(...(data['@graph'] || [data]));
    if (data['@type'] === 'MusicStore')
      assert.equal(data.address.addressLocality, 'Woodland Hills');
  }
  const businesses = entities.filter((item) => item['@id'] === `${origin}/#business`);
  const organizations = entities.filter((item) => item['@id'] === `${origin}/#organization`);
  const websites = entities.filter((item) => item['@id'] === `${origin}/#website`);
  assert.equal(organizations.length, 1, `${path}: expected one shared company identity`);
  assert.equal(businesses.length, 1, `${path}: expected one shared business identity`);
  assert.equal(websites.length, 1, `${path}: expected one shared website identity`);
  assert.equal(organizations[0]['@type'], 'Organization');
  assert.equal(businesses[0].parentOrganization['@id'], organizations[0]['@id']);
  assert.equal(websites[0].publisher['@id'], organizations[0]['@id']);
  assert.equal(websites[0].name, businesses[0].name);
  assert.equal(websites[0].name, organizations[0].name);
  if (path.startsWith('/product/')) {
    const product = entities.find((item) => item['@type'] === 'Product');
    assert.ok(product, `${path}: missing product structured data`);
    assert.equal(product.url, url);
    const images = [...doc.querySelectorAll('.product-gallery-thumb img')].map(
      (image) => image.src
    );
    for (const image of images)
      assert.ok(product.image.includes(image), `${path}: missing gallery image in schema`);
    assert.equal(
      new Set(product.image).size,
      product.image.length,
      `${path}: duplicate product images`
    );
    assert.ok(
      doc.querySelector('.product-shipping-note')?.textContent.includes('United States and Canada')
    );
    assert.ok(!doc.querySelector('.product-detail-shell').textContent.includes('California made'));
  }
  if (path === '/') {
    assert.match(doc.querySelector('.home-hero-copy').textContent, /musicians worldwide/i);
    for (const destination of ['/shop', '/learn', '/studio', '/downloads', '/services']) {
      assert.ok(doc.querySelector(`a[href="${destination}"]`), `Home must link to ${destination}`);
    }
  }
  if (['/learn', '/studio', '/stem-separator'].includes(path)) {
    const page = entities.find((item) => item['@id'] === `${url}#webpage`);
    assert.equal(page?.publisher?.['@id'], organizations[0]['@id']);
    assert.equal(
      page?.primaryImageOfPage?.url,
      doc.querySelector('meta[property="og:image"]').content
    );
  }
  if (path === '/downloads') {
    assert.match(doc.title, /Music Software for Mac/);
    const page = entities.find((item) => item['@id'] === `${url}#webpage`);
    assert.equal(page?.description, description);
    assert.equal(page?.publisher?.['@id'], organizations[0]['@id']);
    const downloads = [...doc.querySelectorAll('.suite-build-actions a[download]')];
    assert.ok(downloads.length >= 3, 'Software page must link to actual downloadable builds');
    for (const download of downloads) {
      await access(`dist${decodeURI(new URL(download.href).pathname)}`);
    }
  }
  if (path.startsWith('/guides/')) {
    const article = entities.find((item) => item['@type'] === 'Article');
    assert.equal(article?.mainEntityOfPage, url, `${path}: article canonical`);
    assert.equal(article?.isPartOf?.['@id'], websites[0]['@id']);
    assert.ok(doc.querySelector('.resource-byline')?.textContent.includes(article.author.name));
    const sections = [...doc.querySelectorAll('.resource-contents a')];
    assert.ok(sections.length >= 3, `${path}: missing section navigation`);
    for (const link of sections) {
      assert.equal(
        doc.getElementById(link.hash.slice(1))?.querySelector('h2')?.textContent,
        link.textContent
      );
    }
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
