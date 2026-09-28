// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (file) => readFileSync(resolve(root, file), 'utf8');

// The [[headers]] rules of netlify.toml as { path: { header: value } }.
function headerRules() {
  const rules = {};
  for (const block of read('netlify.toml').split(/^(?=\[\[)/m)) {
    if (!block.startsWith('[[headers]]')) continue;
    const path = block.match(/for = "([^"]+)"/)?.[1];
    const values = {};
    for (const [, name, value] of block.matchAll(/^\s+([A-Za-z-]+) = "(.*)"$/gm))
      if (name !== 'for') values[name] = value;
    rules[path] = values;
  }
  return rules;
}

// Hashes of the inline scripts a browser would execute (not JSON data blocks).
function inlineScriptHashes(file) {
  const hashes = [];
  for (const [, attributes = '', body] of read(file).matchAll(
    /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g
  )) {
    if (/\bsrc=/.test(attributes)) continue;
    const type = attributes.match(/type="([^"]+)"/)?.[1];
    if (type && !/javascript|module/.test(type)) continue;
    hashes.push(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
  return hashes;
}

const directive = (policy, name) =>
  policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

describe('security headers', () => {
  const rules = headerRules();

  it('allows the inline scripts of every page it covers, and nothing else inline', () => {
    const policy = rules['/*']['Content-Security-Policy-Report-Only'];
    const scripts = directive(policy, 'script-src');
    // "/*" covers the staff page too, and every enforced policy applies to a
    // page: without its hash, enforcing this one would break the staff page.
    const hashes = [
      ...inlineScriptHashes('index.html'),
      ...inlineScriptHashes('public/staff-cc6436694e.html'),
    ];
    expect(hashes).toHaveLength(2);
    for (const hash of hashes) expect(scripts).toContain(hash);
    expect(scripts.match(/'sha256-/g)).toHaveLength(hashes.length);
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(directive(policy, 'object-src')).toBe("object-src 'none'");
  });

  it('enforces only framing site-wide, plus the basic hardening headers', () => {
    const site = rules['/*'];
    expect(site['Content-Security-Policy']).toBe("frame-ancestors 'self'");
    expect(site['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(site['X-Content-Type-Options']).toBe('nosniff');
    // The Studio needs audio input and MIDI on its own origin.
    expect(site['Permissions-Policy']).toContain('microphone=(self)');
    expect(site['Permissions-Policy']).toContain('midi=(self)');
  });

  it("enforces a strict policy on the staff page that allows its own script and can't be framed", () => {
    const hashes = inlineScriptHashes('public/staff-cc6436694e.html');
    expect(hashes).toHaveLength(1);
    for (const path of ['/staff-cc6436694e.html', '/staff-cc6436694e']) {
      const policy = rules[path]['Content-Security-Policy'];
      expect(directive(policy, 'script-src')).toBe(`script-src ${hashes[0]}`);
      expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'");
      expect(directive(policy, 'connect-src')).toBe("connect-src 'self'");
      expect(rules[path]['X-Robots-Tag']).toBe('noindex, nofollow');
    }
    expect(rules['/staff-cc6436694e']).toEqual(rules['/staff-cc6436694e.html']);
  });
});
