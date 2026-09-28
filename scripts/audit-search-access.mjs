import assert from 'node:assert/strict';
import process from 'node:process';
import { writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const origin = new URL(process.env.SEARCH_AUDIT_URL || 'https://sattarimusic.com').origin;
const paths = ['/robots.txt', '/sitemap.xml', '/', '/stem-separator', '/tools/stem-separator'];
const agents = ['Sattari-Search-Audit/1.0', 'Googlebot', 'bingbot', 'OAI-SearchBot/1.4'];
const results = [];
for (const agent of agents) {
  for (const path of paths) {
    const response = await fetch(`${origin}${path}`, {
      headers: { 'user-agent': agent },
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
    const headers = response.headers;
    assert.equal(response.status, 200, `${agent} ${path}: expected 200`);
    assert.doesNotMatch(headers.get('x-robots-tag') || '', /noindex|nosnippet|max-snippet:\s*0\b/i);
    const text = await response.text();
    const result = {
      agent,
      path,
      status: response.status,
      xRobotsTag: headers.get('x-robots-tag'),
    };
    if (path === '/robots.txt') {
      assert.match(text, /^User-agent:/im);
      assert.match(text, /Sitemap:\s*https:\/\/sattarimusic\.com\/sitemap\.xml/i);
    } else if (path === '/sitemap.xml') {
      const dom = new JSDOM(text, { contentType: 'application/xml' });
      result.publicPages = dom.window.document.querySelectorAll('urlset url').length;
      assert.ok(result.publicPages > 0, 'Sitemap must contain public URLs');
      dom.window.close();
    } else {
      assert.match(headers.get('content-type') || '', /text\/html/);
      const dom = new JSDOM(text);
      const doc = dom.window.document;
      result.title = doc.title;
      result.heading = doc.querySelector('h1')?.textContent;
      result.canonical = doc.querySelector('link[rel="canonical"]')?.href;
      assert.ok(result.heading && doc.querySelector('#root')?.textContent.length > 100);
      assert.equal(result.canonical, `https://sattarimusic.com${path}`);
      for (const node of doc.querySelectorAll('meta[name]')) {
        if (['robots', 'googlebot', 'bingbot', 'oai-searchbot'].includes(node.name.toLowerCase())) {
          assert.doesNotMatch(node.content, /noindex|nosnippet|max-snippet:\s*0\b/i);
        }
      }
      const baseline = results.find((item) => item.path === path);
      if (baseline) {
        assert.equal(result.title, baseline.title, `${path}: crawler-specific title`);
        assert.equal(result.heading, baseline.heading, `${path}: crawler-specific heading`);
      }
      dom.window.close();
    }
    results.push(result);
  }
}
const report = {
  checkedAt: new Date().toISOString(),
  origin,
  scope:
    'Read-only user-agent probes from this machine. Not proof of real crawler-IP access, indexing, ranking or AI citations.',
  results,
};
if (process.env.SEARCH_AUDIT_REPORT) {
  await writeFile(process.env.SEARCH_AUDIT_REPORT, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
