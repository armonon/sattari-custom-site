import { products as baseProducts } from '../../src/data/catalog.js';
import {
  mergeCatalog,
  sanitizeNewProduct,
  sanitizeOverride,
  slugify,
} from '../../src/utils/catalogMerge.js';
import { readCatalogDoc, updateCatalogDoc } from '../../server/catalogStore.js';
import { requireStaff } from '../../server/staffAuth.js';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}

const baseSlugs = new Set(baseProducts.map((product) => product.slug));

// What the staff page renders: every product, including hidden ones, flagged
// so an employee can bring something back rather than only seeing what is live.
function buildListingRows(doc) {
  const hidden = new Set(doc.hidden);
  const rows = [];

  for (const product of baseProducts) {
    const merged = { ...product, ...(doc.overrides[product.slug] || {}) };
    rows.push({
      slug: product.slug,
      name: merged.name,
      category: merged.category,
      description: merged.description,
      price: merged.price,
      image: merged.image,
      sizes: merged.sizes || null,
      colors: merged.colors || null,
      hidden: hidden.has(product.slug),
      origin: 'catalog',
      edited: Boolean(doc.overrides[product.slug]),
    });
  }

  for (const product of doc.added) {
    if (baseSlugs.has(product.slug)) continue;
    const merged = { ...product, ...(doc.overrides[product.slug] || {}) };
    rows.push({
      slug: product.slug,
      name: merged.name,
      category: merged.category,
      description: merged.description,
      price: merged.price,
      image: merged.image,
      sizes: merged.sizes || null,
      colors: merged.colors || null,
      hidden: hidden.has(product.slug),
      origin: 'added',
      edited: Boolean(doc.overrides[product.slug]),
    });
  }

  return rows;
}

export async function handler(event) {
  const session = requireStaff(event);
  if (!session) {
    return json(401, { error: 'Sign in to continue.' });
  }

  if (event.httpMethod === 'GET') {
    const doc = await readCatalogDoc(event);
    return json(200, {
      staff: session.staff,
      listings: buildListingRows(doc),
      live: mergeCatalog(baseProducts, doc).length,
    });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid request.' });
  }

  const action = String(body.action || '');

  try {
    if (action === 'edit') {
      const slug = String(body.slug || '');
      const patch = sanitizeOverride(body.changes);
      if (!patch) return json(400, { error: 'Nothing valid to change.' });

      const known = new Set([...baseSlugs]);
      const existing = await readCatalogDoc(event);
      existing.added.forEach((product) => known.add(product.slug));
      if (!known.has(slug)) return json(404, { error: 'That product does not exist.' });

      const { doc } = await updateCatalogDoc(event, (current) => ({
        ...current,
        overrides: {
          ...current.overrides,
          // Merge onto any existing override so editing one field does not
          // discard an earlier edit to another.
          [slug]: { ...(current.overrides[slug] || {}), ...patch },
        },
      }));

      console.log(JSON.stringify({ type: 'staff-catalog-edit', staff: session.staff, slug }));
      return json(200, { staff: session.staff, listings: buildListingRows(doc) });
    }

    if (action === 'add') {
      const product = sanitizeNewProduct(body.product);
      if (!product) {
        return json(400, { error: 'A new product needs a name and a price.' });
      }

      const current = await readCatalogDoc(event);
      if (baseSlugs.has(product.slug) || current.added.some((p) => p.slug === product.slug)) {
        return json(409, {
          error: `The web address "${product.slug}" is already used by another product. Change the name slightly.`,
        });
      }

      const { doc } = await updateCatalogDoc(event, (existing) => ({
        ...existing,
        added: [...existing.added, product],
        // A newly added product may share a slug with something hidden long
        // ago; make sure it is visible.
        hidden: existing.hidden.filter((slug) => slug !== product.slug),
      }));

      console.log(
        JSON.stringify({ type: 'staff-catalog-add', staff: session.staff, slug: product.slug })
      );
      return json(200, { staff: session.staff, listings: buildListingRows(doc), slug: product.slug });
    }

    if (action === 'hide' || action === 'show') {
      const slug = slugify(body.slug) === body.slug ? String(body.slug) : String(body.slug || '');
      if (!slug) return json(400, { error: 'Which product?' });

      const { doc } = await updateCatalogDoc(event, (current) => {
        const hidden = new Set(current.hidden);
        // Hiding is a flag, never a delete. The product data survives so an
        // accidental removal is one click away from being undone.
        if (action === 'hide') hidden.add(slug);
        else hidden.delete(slug);
        return { ...current, hidden: [...hidden] };
      });

      console.log(
        JSON.stringify({ type: `staff-catalog-${action}`, staff: session.staff, slug })
      );
      return json(200, { staff: session.staff, listings: buildListingRows(doc) });
    }

    return json(400, { error: 'Unknown action.' });
  } catch (error) {
    return json(409, { error: error?.message || 'Could not save. Try again.' });
  }
}
