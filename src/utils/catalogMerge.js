// Employee-editable catalog, layered on top of src/data/catalog.js.
//
// catalog.js stays the base. The blob holds only what employees changed:
// per-slug overrides, products they added, and a hidden flag standing in for
// deletion. Two reasons for layering instead of moving the catalog wholesale
// into storage:
//
//   1. The storefront can render the base catalog immediately and apply
//      overrides when they arrive, so a slow or failed blob read degrades to
//      exactly today's behaviour rather than an empty shop.
//   2. Nothing an employee does can destroy the original product data.
//
// The same merge runs in the browser and in create-checkout-session, so the
// price a customer sees is the price the server charges.

import { categories } from '../data/catalog.js';

export const CATALOG_STORE = 'catalog';
export const CATALOG_BLOB_KEY = 'overrides';

// Categories are a closed set. A product filed under a made-up category would
// never appear on any category page and would miss the per-category copy the
// product page expects, so an unknown value falls back instead of being stored.
const CATEGORY_KEYS = new Set(categories.map((category) => category.key));
const DEFAULT_CATEGORY = 'essentials';

function cleanCategory(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return CATEGORY_KEYS.has(key) ? key : null;
}

export const EMPTY_CATALOG_DOC = { overrides: {}, added: [], hidden: [] };

const MAX_NAME = 120;
const MAX_DESCRIPTION = 4000;
const MAX_PRICE = 1_000_000;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function cleanPrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > MAX_PRICE) return null;
  // Money is carried as a float in this catalog, so round to cents rather than
  // letting 19.999 through into a Stripe unit_amount.
  return Math.round(numeric * 100) / 100;
}

// Sizes must keep the { size, price } shape resolveSelectedOption expects.
// A malformed entry here would break checkout for that product, so anything
// that does not parse is dropped rather than passed along.
function cleanSizes(value) {
  if (!Array.isArray(value)) return null;

  const sizes = [];
  for (const option of value) {
    const size = cleanText(option?.size, 40);
    const price = cleanPrice(option?.price);
    if (size && price !== null) sizes.push({ size, price });
  }
  return sizes.length ? sizes : null;
}

function cleanColors(value) {
  if (!Array.isArray(value)) return null;

  const colors = [];
  for (const option of value) {
    const name = cleanText(option?.name, 40);
    if (!name) continue;
    const hex = cleanText(option?.hex, 9);
    colors.push(hex ? { name, hex } : { name });
  }
  return colors.length ? colors : null;
}

function cleanImages(value) {
  if (!Array.isArray(value)) return null;
  const images = value.map((entry) => cleanText(entry, 500)).filter(Boolean);
  return images.length ? images : null;
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// A partial patch for an existing product. Only keys actually present are
// returned, so an override never blanks a field the employee did not touch.
export function sanitizeOverride(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const patch = {};
  const name = cleanText(raw.name, MAX_NAME);
  if (name) patch.name = name;

  const description = cleanText(raw.description, MAX_DESCRIPTION);
  if (description) patch.description = description;

  const category = cleanCategory(raw.category);
  if (category) patch.category = category;

  if ('price' in raw) {
    const price = cleanPrice(raw.price);
    if (price !== null) patch.price = price;
  }

  const image = cleanText(raw.image, 500);
  if (image) patch.image = image;

  const gallery = cleanImages(raw.gallery);
  if (gallery) patch.gallery = gallery;

  const sizes = cleanSizes(raw.sizes);
  if (sizes) patch.sizes = sizes;

  const colors = cleanColors(raw.colors);
  if (colors) patch.colors = colors;

  return Object.keys(patch).length ? patch : null;
}

// A brand-new product. Stricter than an override: a name, a slug, and a
// price (or at least one priced size) are all required, because a product
// missing any of them cannot be bought.
export function sanitizeNewProduct(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const name = cleanText(raw.name, MAX_NAME);
  if (!name) return null;

  const slug = slugify(raw.slug || name);
  if (!slug) return null;

  const sizes = cleanSizes(raw.sizes);
  const price = cleanPrice(raw.price);
  if (sizes === null && price === null) return null;

  const product = {
    id: slug,
    slug,
    name,
    category: cleanCategory(raw.category) || DEFAULT_CATEGORY,
    description: cleanText(raw.description, MAX_DESCRIPTION) || '',
    price: price === null ? sizes[0].price : price,
    image: cleanText(raw.image, 500) || '',
    specs: [],
  };

  if (sizes) product.sizes = sizes;
  const colors = cleanColors(raw.colors);
  if (colors) product.colors = colors;
  const gallery = cleanImages(raw.gallery);
  if (gallery) product.gallery = gallery;

  return product;
}

export function sanitizeCatalogDoc(raw) {
  const doc = { overrides: {}, added: [], hidden: [] };
  if (!raw || typeof raw !== 'object') return doc;

  if (raw.overrides && typeof raw.overrides === 'object' && !Array.isArray(raw.overrides)) {
    for (const [slug, patch] of Object.entries(raw.overrides)) {
      const clean = sanitizeOverride(patch);
      if (clean) doc.overrides[slug] = clean;
    }
  }

  if (Array.isArray(raw.added)) {
    const seen = new Set();
    for (const entry of raw.added) {
      const product = sanitizeNewProduct(entry);
      if (product && !seen.has(product.slug)) {
        seen.add(product.slug);
        doc.added.push(product);
      }
    }
  }

  if (Array.isArray(raw.hidden)) {
    doc.hidden = [...new Set(raw.hidden.map((slug) => cleanText(slug, 80)).filter(Boolean))];
  }

  return doc;
}

// Base catalog + employee edits = what the shop actually sells.
//
// Hidden products are filtered out entirely, which is what makes "remove" safe:
// the underlying entry is untouched and can be brought back by unhiding.
export function mergeCatalog(baseProducts = [], rawDoc = EMPTY_CATALOG_DOC) {
  const doc = sanitizeCatalogDoc(rawDoc);
  const hidden = new Set(doc.hidden);

  const merged = [];

  for (const product of baseProducts) {
    if (hidden.has(product.slug)) continue;
    const patch = doc.overrides[product.slug];
    merged.push(patch ? { ...product, ...patch } : product);
  }

  for (const product of doc.added) {
    if (hidden.has(product.slug)) continue;
    // An added product with the same slug as a base product would create two
    // entries competing for one URL; the base one already won above.
    if (merged.some((entry) => entry.slug === product.slug)) continue;

    const patch = doc.overrides[product.slug];
    merged.push(patch ? { ...product, ...patch } : product);
  }

  return merged;
}
