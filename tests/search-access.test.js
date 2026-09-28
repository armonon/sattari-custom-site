// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public crawl policy', () => {
  const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .join('\n');

  it.each(['*', 'OAI-SearchBot'])(
    'keeps %s search access without opening private APIs',
    (agent) => {
      expect(robots).toContain(
        [
          `User-agent: ${agent}`,
          'Allow: /',
          'Allow: /api/inventory',
          'Disallow: /api/',
          'Disallow: /.netlify/functions/',
        ].join('\n')
      );
    }
  );
  it('points to the canonical sitemap without advertising the staff URL', () => {
    expect(robots).toContain('Sitemap: https://sattarimusic.com/sitemap.xml');
    expect(robots).not.toMatch(/staff-|studio-booking\?/);
  });
});
