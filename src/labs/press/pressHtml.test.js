import { describe, expect, it } from 'vitest';
import {
  buildPressHtml,
  embedFor,
  escapeHtml,
  exampleDraft,
  mailto,
  normalizeDraft,
  safeUrl,
  telLink,
} from './pressHtml';

function parse(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('safeUrl', () => {
  it('accepts http(s), adds https to bare domains and rejects everything else', () => {
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeUrl('instagram.com/artist')).toBe('https://instagram.com/artist');
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('JAVASCRIPT:alert(1)')).toBe('');
    expect(safeUrl('data:text/html,<script>')).toBe('');
    expect(safeUrl('ftp://example.com')).toBe('');
    expect(safeUrl('localhost')).toBe('');
    expect(safeUrl('')).toBe('');
  });

  it('builds mailto and tel links only from plausible values', () => {
    expect(mailto('booking@artist.com')).toBe('mailto:booking@artist.com');
    expect(mailto('nope"><script>@x.y')).toBe('');
    expect(telLink('+1 (424) 465-3020')).toBe('tel:+14244653020');
    expect(telLink('123')).toBe('');
  });
});

describe('embedFor', () => {
  it.each([
    [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ],
    ['https://youtu.be/dQw4w9WgXcQ?t=3', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    [
      'https://youtube.com/shorts/abc_DEF-123',
      'https://www.youtube-nocookie.com/embed/abc_DEF-123',
    ],
    [
      'https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=x',
      'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC',
    ],
    [
      'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3',
      'https://open.spotify.com/embed/album/1DFixLWuPkv3KT3TnV35m3',
    ],
    [
      'https://soundcloud.com/artist/track-name',
      'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-name&visual=false&show_comments=false',
    ],
    [
      'https://music.apple.com/us/album/name/123456?i=987',
      'https://embed.music.apple.com/us/album/name/123456?i=987',
    ],
    ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871'],
  ])('embeds %s', (url, src) => {
    expect(embedFor(url)?.src).toBe(src);
  });

  it('leaves unknown hosts and malformed IDs as links', () => {
    expect(embedFor('https://artist.bandcamp.com/track/song')).toBeNull();
    expect(embedFor('https://www.youtube.com/watch?v=a"onload="x')).toBeNull();
    expect(embedFor('https://open.spotify.com/user/someone')).toBeNull();
    expect(embedFor('javascript:alert(1)')).toBeNull();
  });
});

describe('buildPressHtml', () => {
  const hostile = '<img src=x onerror=alert(1)>"\'&';

  it('escapes every field and never emits script or event handlers', () => {
    const html = buildPressHtml({
      ...exampleDraft(),
      name: hostile,
      tagline: hostile,
      location: hostile,
      bio: `${hostile}\n\nSecond`,
      links: [
        { label: hostile, url: 'https://example.com/?q="><script>alert(1)</script>' },
        { label: 'bad', url: 'javascript:alert(1)' },
      ],
      tracks: [{ title: hostile, url: 'https://youtu.be/dQw4w9WgXcQ' }],
      quotes: [{ text: hostile, source: hostile }],
      contact: { booking: 'a@b.co', management: hostile, press: '', phone: '' },
      accent: 'red;}</style><script>',
      photo: 'data:image/png;base64,AAAA"onerror="x',
    });
    const doc = parse(html);
    expect(doc.querySelectorAll('script')).toHaveLength(0);
    const handlers = [...doc.querySelectorAll('*')].flatMap((node) =>
      [...node.attributes].filter((attr) => attr.name.startsWith('on'))
    );
    expect(handlers).toEqual([]);
    expect(doc.querySelector('h1').textContent).toBe(hostile);
    expect(doc.querySelector('header img')).toBeNull();
    expect([...doc.querySelectorAll('a')].some((a) => a.href.startsWith('javascript'))).toBe(false);
    expect(html).toContain('--accent:#d6b36d');
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content).toContain(
      "default-src 'none'"
    );
  });

  it('builds the press kit sections with embeds, print fallbacks and contact links', () => {
    const doc = parse(
      buildPressHtml({
        ...exampleDraft(),
        name: 'Nova Lane',
        photo: 'data:image/jpeg;base64,/9j/AAAA',
        links: [{ label: 'Instagram', url: 'instagram.com/novalane' }],
        tracks: [
          { title: 'Single', url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC' },
          { title: 'Live', url: 'https://artist.bandcamp.com/track/live' },
        ],
        contact: { booking: 'book@nova.fm', management: '', press: '', phone: '+1 424 465 3020' },
      })
    );
    expect(doc.title).toBe('Nova Lane · Press Kit');
    expect(doc.querySelector('header img').getAttribute('src')).toMatch(/^data:image\/jpeg/);
    expect(doc.querySelector('.links a').getAttribute('href')).toBe(
      'https://instagram.com/novalane'
    );
    expect(doc.querySelector('iframe').getAttribute('src')).toBe(
      'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'
    );
    expect(doc.querySelector('.print-only a').textContent).toBe('Single');
    expect(doc.querySelectorAll('.track-link')).toHaveLength(2);
    expect(doc.querySelector('.contact a[href="mailto:book@nova.fm"]')).not.toBeNull();
    expect(doc.querySelector('.contact a[href="tel:+14244653020"]')).not.toBeNull();
    expect(doc.querySelector('style').textContent).toContain('@media print');
  });

  it('keeps the link-in-bio layout short: first bio paragraph, no press quotes', () => {
    const doc = parse(
      buildPressHtml({ ...exampleDraft(), layout: 'bio', bio: 'First.\n\nSecond.' })
    );
    expect(doc.querySelector('.bio').textContent).toContain('First.');
    expect(doc.querySelector('.bio').textContent).not.toContain('Second.');
    expect(doc.querySelector('blockquote')).toBeNull();
  });

  it('escapes text helpers', () => {
    expect(escapeHtml('<a href="x">\'&')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});

describe('normalizeDraft', () => {
  it('caps list sizes and drops unknown values', () => {
    const draft = normalizeDraft({
      links: Array.from({ length: 50 }, () => ({ label: 'x', url: 'https://x.co' })),
      theme: 'neon',
      layout: 'poster',
      accent: 'not-a-colour',
    });
    expect(draft.links).toHaveLength(16);
    expect(draft.theme).toBe('dark');
    expect(draft.layout).toBe('epk');
    expect(draft.accent).toBe('#d6b36d');
    expect(normalizeDraft('garbage')).toEqual(exampleDraft());
  });
});
