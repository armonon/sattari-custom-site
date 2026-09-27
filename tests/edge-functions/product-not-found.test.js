// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  config,
  createProductNotFoundHandler,
  isUnlistedProductPath,
  listedProductSlugs,
  productSlugFromPath,
} from '../../netlify/edge-functions/product-not-found.js';

const STAFF_CATALOG = {
  overrides: {},
  added: [{ name: 'Frame Drum', slug: 'frame-drum', price: 120 }],
  hidden: ['violin-strings'],
};

function inventoryResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function appShell() {
  return new Response('<!doctype html><div id="root"></div>', {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public' },
  });
}

function setup(fetchImpl, { time = 0 } = {}) {
  let clock = time;
  const handler = createProductNotFoundHandler({ fetchImpl, now: () => clock });
  const visit = async (path, { method = 'GET', page = appShell() } = {}) =>
    handler(new Request(`https://sattarimusic.com${path}`, { method }), {
      next: async () => page,
    });
  return { visit, advance: (ms) => (clock += ms) };
}

describe('slug checks', () => {
  const listed = listedProductSlugs({ stock: {}, catalog: STAFF_CATALOG });

  it('reads the slug the /product/:slug route sees', () => {
    expect(productSlugFromPath('/product/cymbal-felts')).toBe('cymbal-felts');
    expect(productSlugFromPath('/product/cymbal-felts/')).toBe('cymbal-felts');
    expect(productSlugFromPath('/product/cymbal-felts.html')).toBe('cymbal-felts');
    expect(productSlugFromPath('/product/a%20b')).toBe('a b');
    expect(productSlugFromPath('/product/')).toBeNull();
    expect(productSlugFromPath('/product/cymbal-felts/extra')).toBeNull();
    expect(productSlugFromPath('/product/%E0%A4%A')).toBeNull();
  });

  it('lists base, staff-added and not hidden products', () => {
    expect(listed.has('cymbal-felts')).toBe(true);
    expect(listed.has('frame-drum')).toBe(true);
    expect(listed.has('violin-strings')).toBe(false);
  });

  it('flags only paths that are not listed products', () => {
    expect(isUnlistedProductPath('/product/cymbal-felts', listed)).toBe(false);
    expect(isUnlistedProductPath('/product/frame-drum', listed)).toBe(false);
    expect(isUnlistedProductPath('/product/violin-strings', listed)).toBe(true);
    expect(isUnlistedProductPath('/product/made-up-slug', listed)).toBe(true);
    expect(isUnlistedProductPath('/product/Cymbal-Felts', listed)).toBe(true);
    expect(isUnlistedProductPath('/product/cymbal-felts/extra', listed)).toBe(true);
  });

  it('never flags anything without a trustworthy catalog', () => {
    expect(listedProductSlugs(null)).toBeNull();
    expect(listedProductSlugs({ stock: {} })).toBeNull();
    expect(listedProductSlugs({ stock: {}, catalog: STAFF_CATALOG, degraded: true })).toBeNull();
    expect(isUnlistedProductPath('/product/made-up-slug', null)).toBe(false);
  });

  it('only runs on product URLs', () => {
    expect(config.path).toBe('/product/*');
  });
});

describe('edge handler', () => {
  it('turns an unknown product slug into a 404 and keeps the page and headers', async () => {
    const { visit } = setup(
      vi.fn(async () => inventoryResponse({ stock: {}, catalog: STAFF_CATALOG }))
    );

    const response = await visit('/product/made-up-slug');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await response.text()).toContain('<div id="root">');
  });

  it('passes listed products through untouched, including staff-added ones', async () => {
    const { visit } = setup(
      vi.fn(async () => inventoryResponse({ stock: {}, catalog: STAFF_CATALOG }))
    );
    const prerendered = appShell();

    expect(await visit('/product/cymbal-felts', { page: prerendered })).toBe(prerendered);
    expect((await visit('/product/frame-drum')).status).toBe(200);
  });

  it('404s a product staff have hidden since the build', async () => {
    const { visit } = setup(
      vi.fn(async () => inventoryResponse({ stock: {}, catalog: STAFF_CATALOG }))
    );

    expect((await visit('/product/violin-strings')).status).toBe(404);
  });

  it.each([
    ['the lookup throws', () => Promise.reject(new TypeError('network down'))],
    ['the inventory API errors', async () => inventoryResponse({ error: 'down' }, 500)],
    [
      'the inventory API is degraded',
      async () => inventoryResponse({ stock: {}, catalog: {}, degraded: true }),
    ],
    ['the payload is not JSON', async () => new Response('<html>', { status: 200 })],
  ])('passes everything through when %s', async (_label, fetchImpl) => {
    const { visit } = setup(vi.fn(fetchImpl));
    const page = appShell();

    expect(await visit('/product/made-up-slug', { page })).toBe(page);
  });

  it('leaves redirects and error responses alone', async () => {
    const { visit } = setup(
      vi.fn(async () => inventoryResponse({ stock: {}, catalog: STAFF_CATALOG }))
    );
    const redirect = new Response(null, { status: 301, headers: { Location: '/shop' } });

    expect(await visit('/product/made-up-slug', { page: redirect })).toBe(redirect);
  });

  it('looks the catalog up once per cache window', async () => {
    const fetchImpl = vi.fn(async () => inventoryResponse({ stock: {}, catalog: STAFF_CATALOG }));
    const { visit, advance } = setup(fetchImpl);

    await Promise.all([visit('/product/cymbal-felts'), visit('/product/made-up-slug')]);
    await visit('/product/frame-drum');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toBe('https://sattarimusic.com/api/inventory');

    advance(61_000);
    await visit('/product/cymbal-felts');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries a failed lookup after a short pause instead of on every request', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValue(inventoryResponse({ stock: {}, catalog: STAFF_CATALOG }));
    const { visit, advance } = setup(fetchImpl);

    expect((await visit('/product/made-up-slug')).status).toBe(200);
    expect((await visit('/product/made-up-slug')).status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    advance(11_000);
    expect((await visit('/product/made-up-slug')).status).toBe(404);
  });
});
