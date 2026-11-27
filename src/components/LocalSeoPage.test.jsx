/* @vitest-environment jsdom */
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { StaticRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPriceRange, products } from '../data/catalog';
import { BUSINESS, CATEGORY_LOCAL_HELP, CATEGORY_SEO, PAGE_SEO } from '../data/siteSeo';
import { useInventory } from '../context/InventoryContext';
import LocalSeoPage, { localSeoPages } from './LocalSeoPage';
import RepairPage from './RepairPage';

vi.mock('../context/InventoryContext', () => ({ useInventory: vi.fn() }));
vi.mock('./ServiceInquiryForm', () => ({
  default: ({ initialService, source }) => (
    <form data-service={initialService} aria-label={source} />
  ),
}));

function renderPage(element) {
  const context = {};
  const canUseDOM = HelmetProvider.canUseDOM;
  HelmetProvider.canUseDOM = false;
  try {
    const body = renderToString(
      <HelmetProvider context={context}>
        <StaticRouter location="/">{element}</StaticRouter>
      </HelmetProvider>
    );
    const { helmet } = context;
    const doc = new DOMParser().parseFromString(
      `<!doctype html><html><head>${helmet.title}${helmet.meta}${helmet.link}${helmet.script}</head><body>${body}</body></html>`,
      'text/html'
    );
    const schema = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((node) =>
      JSON.parse(node.textContent)
    );
    return { doc, schema };
  } finally {
    HelmetProvider.canUseDOM = canUseDOM;
  }
}

beforeEach(() => {
  useInventory.mockReturnValue({ products, isSoldOut: () => false });
});

describe('local search pages', () => {
  it('has distinct metadata and valid product selections for every local page', () => {
    const pages = Object.values(localSeoPages);
    const titles = [...Object.values(PAGE_SEO), ...Object.values(CATEGORY_SEO)].map(
      (page) => page.title
    );
    expect(new Set(pages.map((page) => page.url)).size).toBe(pages.length);
    expect(new Set(pages.map((page) => page.description)).size).toBe(pages.length);
    for (const page of pages) {
      expect(page.seoTitle.length).toBeLessThanOrEqual(65);
      expect(page.description.length).toBeLessThanOrEqual(170);
      expect(titles).not.toContain(page.seoTitle);
      titles.push(page.seoTitle);
      for (const id of page.productIds || []) {
        expect(products.some((product) => product.slug === id)).toBe(true);
      }
    }
  });

  it.each(Object.entries(localSeoPages))(
    'renders %s with matching visible content and structured data',
    (key, page) => {
      const { doc, schema } = renderPage(<LocalSeoPage pageKey={key} />);
      expect(doc.querySelectorAll('h1')).toHaveLength(1);
      expect(doc.querySelector('h1').textContent).toBe(page.title);
      expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
      expect(doc.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(
        page.canonicalUrl || page.url
      );
      expect(doc.querySelector('meta[name="description"]').content).toBe(page.description);
      expect(doc.querySelector('address').textContent).toBe(BUSINESS.addressLine);
      expect(doc.body.textContent).toContain('By appointment only. Call to arrange your visit.');
      expect(doc.querySelector('form').dataset.service).toBe(page.formService);
      expect(
        schema.some((item) => ['Store', 'MusicStore', 'LocalBusiness'].includes(item['@type']))
      ).toBe(false);
      const faqSchema = schema.find((item) => item['@type'] === 'FAQPage');
      expect(faqSchema.mainEntity).toHaveLength(page.faqs.length);
      const visibleFaqs = [...doc.querySelectorAll('details')];
      page.faqs.forEach((faq, index) => {
        expect(visibleFaqs[index].querySelector('summary').textContent).toBe(faq.q);
        expect(visibleFaqs[index].querySelector('p').textContent).toBe(faq.a);
        expect(faqSchema.mainEntity[index].acceptedAnswer.text).toBe(faq.a);
      });
      expect(doc.querySelectorAll('.local-seo-link-grid a')).toHaveLength(4);
      for (const detail of page.details || []) expect(doc.body.textContent).toContain(detail.copy);
    }
  );

  it('uses current inventory, omits hidden products and displays sold-out state', () => {
    const availableCatalog = products.filter((product) => product.slug !== 'pirouz-series-cymbals');
    useInventory.mockReturnValue({ products: availableCatalog, isSoldOut: () => true });
    const { doc } = renderPage(<LocalSeoPage pageKey="woodland-drums" />);
    expect(doc.querySelector('a[href="/product/pirouz-series-cymbals"]')).toBeNull();
    expect(doc.querySelectorAll('.local-product')).toHaveLength(3);
    expect(doc.querySelectorAll('.local-product-stock')).toHaveLength(3);
  });

  it.each(['instruments', 'guitars', 'violins', 'drums'])(
    'shows current product prices, images and availability on the %s sales page',
    (key) => {
      const ids = localSeoPages[key].productIds;
      const hidden = ids[0];
      const soldOut = ids[1];
      const current = products
        .filter((product) => product.slug !== hidden)
        .map((product) =>
          product.slug === soldOut ? { ...product, price: 42, sizes: [] } : product
        );
      useInventory.mockReturnValue({ products: current, isSoldOut: (p) => p.slug === soldOut });
      const { doc } = renderPage(<LocalSeoPage pageKey={key} />);
      const cards = [...doc.querySelectorAll('.local-product')];
      expect(cards).toHaveLength(ids.length - 1);
      for (const card of cards) {
        const slug = card.getAttribute('href').replace('/product/', '');
        expect(ids).toContain(slug);
        expect(slug).not.toBe(hidden);
        const product = current.find((item) => item.slug === slug);
        expect(card.querySelector('img')).not.toBeNull();
        expect(card.querySelector('h3').textContent).toBe(product.name);
        expect(card.querySelector('p').textContent).toBe(formatPriceRange(product));
      }
      expect(doc.querySelector(`a[href="/product/${soldOut}"]`).textContent).toContain(
        'Out of stock'
      );
    }
  );

  it('keeps all new pages discoverable from product categories or repair services', () => {
    const links = Object.values(CATEGORY_LOCAL_HELP).flatMap((help) =>
      help.links.map((link) => link.to)
    );
    for (const key of [
      'woodland-drums',
      'encino-violins',
      'violin-repair',
      'guitar-setup',
      'guitar-strings',
      'violin-strings',
      'guitar-restringing',
      'violin-restringing',
      'string-replacement',
    ]) {
      expect(links).toContain(new URL(localSeoPages[key].url).pathname);
    }
  });

  it('shows approved standard guitar prices and connects string buying and fitting', () => {
    const guitar = renderPage(<LocalSeoPage pageKey="guitar-strings" />);
    expect(guitar.doc.querySelectorAll('.local-product')).toHaveLength(0);
    expect(guitar.schema.some((item) => ['Product', 'Offer'].includes(item['@type']))).toBe(false);
    expect(
      guitar.doc.querySelector('a[href="/services/guitar-restringing-woodland-hills"]')
    ).not.toBeNull();

    const violin = renderPage(<LocalSeoPage pageKey="violin-strings" />);
    expect(violin.doc.querySelectorAll('.local-product')).toHaveLength(1);
    expect(violin.doc.querySelector('.local-product').getAttribute('href')).toBe(
      '/product/violin-strings'
    );
    expect(
      violin.doc.querySelector('a[href="/services/violin-repair-los-angeles"]')
    ).not.toBeNull();

    const restringing = renderPage(<LocalSeoPage pageKey="guitar-restringing" />);
    const service = restringing.schema.find((item) => item['@type'] === 'Service');
    expect(service.provider['@id']).toBe('https://sattarimusic.com/#business');
    expect(service.offers).toMatchObject({
      '@type': 'Offer',
      name: 'Standard guitar string set and restringing labor',
      price: 55,
      priceCurrency: 'USD',
    });
    for (const page of [guitar, restringing]) {
      const priceAnswer = page.schema
        .find((item) => item['@type'] === 'FAQPage')
        .mainEntity.find(({ acceptedAnswer }) =>
          ['$20', '$35', '$55'].every((price) => acceptedAnswer.text.includes(price))
        );
      expect(priceAnswer).toBeDefined();
      expect(page.doc.body.textContent).toContain(priceAnswer.acceptedAnswer.text);
      expect(page.doc.body.textContent).toContain('Ernie Ball');
      expect(page.doc.body.textContent).toMatch(/premium/i);
      expect(page.doc.querySelector('meta[name="description"]').content).toContain('$20');
    }
    expect(violin.doc.body.textContent).not.toContain('$55');
    expect(
      restringing.doc.querySelector('a[href="/services/guitar-setup-los-angeles"]')
    ).not.toBeNull();
  });

  it('replaces the violin purchase CTA with an inquiry when inventory hides the product', () => {
    useInventory.mockReturnValue({
      products: products.filter((product) => product.slug !== 'violin-strings'),
      isSoldOut: () => false,
    });
    const { doc, schema } = renderPage(<LocalSeoPage pageKey="violin-strings" />);
    expect(doc.querySelector('a[href="/product/violin-strings"]')).toBeNull();
    expect(doc.querySelectorAll('.local-product')).toHaveLength(0);
    const primaryCta = doc.querySelector('.repair-hero-copy .button-solid');
    expect(primaryCta.textContent).toBe('Ask about availability');
    expect(primaryCta.getAttribute('href')).toBe('#local-inquiry');
    expect(doc.body.textContent).not.toContain('available through the current online catalog');
    const faqs = schema.find((item) => item['@type'] === 'FAQPage').mainEntity;
    for (const faq of faqs) expect(doc.body.textContent).toContain(faq.acceptedAnswer.text);
  });

  it('gives Los Angeles instrument repair visible FAQs matching its schema', () => {
    const { doc, schema } = renderPage(<RepairPage />);
    const faqs = schema.find((item) => item['@type'] === 'FAQPage').mainEntity;
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(doc.title).toContain(PAGE_SEO.repair.title);
    expect(doc.querySelectorAll('details')).toHaveLength(faqs.length);
    for (const faq of faqs) {
      expect(doc.body.textContent).toContain(faq.name);
      expect(doc.body.textContent).toContain(faq.acceptedAnswer.text);
    }
    expect(schema.find((item) => item['@type'] === 'Service').provider['@id']).toBe(
      'https://sattarimusic.com/#business'
    );
  });
});

it('keeps a sold-out violin string listing browsable and sends purchase inquiries to the shop', () => {
  useInventory.mockReturnValue({
    products,
    isSoldOut: (product) => product.slug === 'violin-strings',
  });
  const { doc } = renderPage(<LocalSeoPage pageKey="violin-strings" />);
  expect(doc.querySelector('.repair-hero-copy .button-solid').getAttribute('href')).toBe(
    '#local-inquiry'
  );
  expect(doc.querySelector('.local-product').getAttribute('href')).toBe('/product/violin-strings');
  expect(doc.querySelector('.local-product-stock').textContent).toBe('Out of stock');
});
