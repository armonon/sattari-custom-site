/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it } from 'vitest';
import { SEO, StructuredData, OrganizationSchema } from './seo';
import {
  BUSINESS,
  CATEGORY_SEO,
  PAGE_SEO,
  absoluteUrl,
  businessSchema,
  canonicalUrl,
  musicToolSchema,
  websiteSchema,
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
  it('defines one shared business and website identity on every route', () => {
    const head = headFor(<OrganizationSchema />);
    const doc = new DOMParser().parseFromString(head.script.toString(), 'text/html');
    const entities = [...doc.querySelectorAll('script')].map((node) =>
      JSON.parse(node.textContent)
    );
    expect(entities).toEqual([businessSchema, websiteSchema]);
    expect(websiteSchema.publisher['@id']).toBe(businessSchema['@id']);
    expect(websiteSchema).not.toHaveProperty('potentialAction');
    for (const key of ['separator', 'learn', 'studio']) {
      expect(musicToolSchema(key, []).isPartOf['@id']).toBe(websiteSchema['@id']);
    }
  });

  it('emits one focused title, canonical and description with no generic drum suffix', () => {
    const head = headFor(<SEO {...PAGE_SEO.separator} />);
    expect(head.title.toString()).toContain(
      'Free AI Stem Separator &amp; Vocal Remover | Sattari Music'
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
    expect(businessSchema).not.toHaveProperty('openingHoursSpecification');
    expect(businessSchema.description).toContain('Appointment-only');
    expect(BUSINESS.shopHoursNote).toBe('By appointment only. Call to arrange your visit.');
    expect(BUSINESS.studioHoursNote).toBe('Every day, 6 PM to midnight (Los Angeles time).');
    expect(musicToolSchema('separator', []).publisher['@id']).toBe(businessSchema['@id']);
  });

  it('shares a 1200×630 card, with its size, when a page has no image of its own', () => {
    const meta = headFor(
      <SEO title="Visit" description="Visit the shop" url="/visit" />
    ).meta.toString();
    expect(meta).toContain(
      'property="og:image" content="https://sattarimusic.com/images/sattari-share.jpg"'
    );
    expect(meta).toContain('property="og:image:width" content="1200"');
    expect(meta).toContain('property="og:image:height" content="630"');
    expect(meta).toContain(
      'name="twitter:image" content="https://sattarimusic.com/images/sattari-share.jpg"'
    );

    // The 529×143 logo is below Facebook's and X's minimum preview sizes.
    const logo = headFor(
      <SEO title="Guide" description="A guide" image="/sattari site/sattari logo.png" />
    ).meta.toString();
    expect(logo).toContain('content="https://sattarimusic.com/images/sattari-share.jpg"');
    expect(logo).not.toContain('logo.png');
  });

  it('leaves the browser bar color to the theme instead of resetting it on every page', () => {
    const meta = headFor(<SEO {...PAGE_SEO.shop} />).meta.toString();
    expect(meta).not.toContain('theme-color');
    const template = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    // Set before the inline theme script, which updates it before first paint.
    expect(template.indexOf('<meta name="theme-color"')).toBeGreaterThan(-1);
    expect(template.indexOf('<meta name="theme-color"')).toBeLessThan(template.indexOf('<script>'));
  });

  it('gives a page image its size only when the page knows it', () => {
    const sized = headFor(<SEO {...PAGE_SEO.home} />).meta.toString();
    expect(sized).toContain(
      'property="og:image" content="https://sattarimusic.com/images/home/sattari-instruments-hero.jpg"'
    );
    expect(sized).toContain('property="og:image:width" content="1536"');
    expect(sized).toContain('property="og:image:height" content="1024"');

    const unsized = headFor(
      <SEO title="Cymbal" description="A cymbal" image="/sattari site/cymbal.png" />
    ).meta.toString();
    expect(unsized).not.toContain('og:image:width');
  });

  it('ships the share card at the size the tags declare', () => {
    const jpeg = readFileSync(resolve(process.cwd(), 'public/images/sattari-share.jpg'));
    // The frame header (SOF0/SOF2) carries height, then width.
    let offset = 2;
    while (offset < jpeg.length && ![0xc0, 0xc2].includes(jpeg[offset + 1])) {
      offset += 2 + jpeg.readUInt16BE(offset + 2);
    }
    expect({ width: jpeg.readUInt16BE(offset + 7), height: jpeg.readUInt16BE(offset + 5) }).toEqual(
      {
        width: 1200,
        height: 630,
      }
    );
  });

  it('describes the browser tools as pages about them, without app markup that needs ratings', () => {
    const schema = musicToolSchema('learn', ['Chord exploration']);
    expect(schema['@type']).toBe('WebPage');
    expect(schema).not.toHaveProperty('applicationCategory');
    expect(schema).not.toHaveProperty('offers');
    expect(schema).not.toHaveProperty('aggregateRating');
    expect(schema.about).toMatchObject({ name: 'Sattari Learn' });
    expect(schema.url).toBe('https://sattarimusic.com/learn');
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
