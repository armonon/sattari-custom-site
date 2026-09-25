/* @vitest-environment jsdom */
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it } from 'vitest';
import { SEO, StructuredData } from './seo';
import {
  BUSINESS,
  CATEGORY_SEO,
  PAGE_SEO,
  absoluteUrl,
  businessSchema,
  canonicalUrl,
  musicToolSchema,
} from '../data/siteSeo';

function headFor(element) {
  const context = {};
  const canUseDOM = HelmetProvider.canUseDOM;
  HelmetProvider.canUseDOM = false;
  try {
    renderToString(<HelmetProvider context={context}>{element}</HelmetProvider>);
  } finally {
    HelmetProvider.canUseDOM = canUseDOM;
  }
  return context.helmet;
}

describe('search metadata', () => {
  it('emits one focused title, canonical and description with no generic drum suffix', () => {
    const head = headFor(<SEO {...PAGE_SEO.separator} />);
    expect(head.title.toString()).toContain(
      'Stem Separator &amp; Vocal Remover Online | Sattari Music'
    );
    expect(head.title.toString()).not.toContain('Premium Drum');
    expect(head.link.toString()).toContain('href="https://sattarimusic.com/stem-separator"');
    expect(head.meta.toString().match(/name="description"/g)).toHaveLength(1);
    expect(head.meta.toString()).toContain('max-image-preview:large');
  });

  it('gives every core page and category a distinct title and description', () => {
    const pages = [...Object.values(PAGE_SEO), ...Object.values(CATEGORY_SEO)];
    expect(new Set(pages.map((page) => page.title)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);
    for (const page of pages) {
      expect(page.description.length).toBeLessThanOrEqual(170);
      expect(page.title.length).toBeLessThanOrEqual(65);
    }
    expect(CATEGORY_SEO.violins.title).not.toMatch(/drum/i);
    expect(CATEGORY_SEO['guitar-bass'].title).not.toMatch(/drum/i);
  });

  it('removes tracking parameters and fragments from canonicals', () => {
    expect(canonicalUrl('/shop/violins/?utm_source=test#details')).toBe(
      'https://sattarimusic.com/shop/violins'
    );
    expect(canonicalUrl('/')).toBe('https://sattarimusic.com/');
  });

  it('encodes image paths without double-encoding and preserves external images', () => {
    expect(absoluteUrl('/sattari site/logo.png')).toBe(
      'https://sattarimusic.com/sattari%20site/logo.png'
    );
    expect(absoluteUrl('/sattari%20site/logo.png')).toBe(
      'https://sattarimusic.com/sattari%20site/logo.png'
    );
    expect(absoluteUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
  });

  it('marks private pages noindex and updates product availability tags', () => {
    const head = headFor(
      <SEO
        title="Cart"
        description="Your cart"
        url="/cart"
        noindex
        type="product"
        price={42}
        availability="out of stock"
      />
    );
    expect(head.meta.toString()).toContain('content="noindex, follow"');
    expect(head.meta.toString()).toContain(
      'property="product:availability" content="out of stock"'
    );
  });

  it('uses one actual store location and identifies surrounding cities as service areas', () => {
    expect(businessSchema['@type']).toBe('MusicStore');
    expect(businessSchema.address.addressLocality).toBe('Woodland Hills');
    expect(BUSINESS.areas).toEqual(expect.arrayContaining(['Encino', 'Calabasas', 'Los Angeles']));
    expect(businessSchema).not.toHaveProperty('aggregateRating');
    expect(businessSchema).not.toHaveProperty('openingHours');
    expect(musicToolSchema('separator', []).publisher['@id']).toBe(businessSchema['@id']);
  });

  it('escapes script-closing content in structured data without corrupting its value', () => {
    const data = { '@type': 'Product', name: '</script><script>alert(1)</script>' };
    const head = headFor(<StructuredData data={data} />).script.toString();
    expect(head).not.toContain('<script>alert');
    expect(head).toContain('\\u003c/script>');
    const json = head.slice(head.indexOf('>') + 1, head.lastIndexOf('</script>'));
    expect(JSON.parse(json)).toEqual(data);
  });
});
