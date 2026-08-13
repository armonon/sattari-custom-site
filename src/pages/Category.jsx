// src/pages/Category.jsx
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { categories, formatPriceRange, categoryTitle, getMinPrice } from '../data/catalog';
import OptimizedProductImage from '../components/OptimizedProductImage';
import { useInventory } from '../context/InventoryContext';
import { SEO, StructuredData } from '../utils/seo';
import '../styles-products-premium.css';

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name: A–Z' },
];

function sortProducts(list, sort) {
  const sorted = [...list];
  if (sort === 'price-asc') sorted.sort((a, b) => getMinPrice(a) - getMinPrice(b));
  else if (sort === 'price-desc') sorted.sort((a, b) => getMinPrice(b) - getMinPrice(a));
  else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}

const categoryHighlights = {
  cymbals: ['Handcrafted tone', 'Stage-ready projection', 'Distinctive response'],
  sticks: ['Premium wood', 'Balanced rebound', 'Daily-play durability'],
  essentials: ['Practice-ready', 'Compact carry', 'Built for consistency'],
  violins: ['Hand-carved tonewoods', 'Workshop-fitted & tuned', 'Acoustic, electric & silent'],
  'guitar-bass': ['Set up and ready', 'Ships from California', 'Electric & acoustic'],
  all: ['Instruments & accessories', 'Secure checkout', 'Ships from California'],
};

// Synthetic category for the /shop/all page (lists every product).
const ALL_CATEGORY = {
  key: 'all',
  title: 'Shop all',
  description: 'Browse the full Sattari catalog in one place.',
};

// Fall back to a size-variant image when the product has no top-level image,
// so every card shows a photo instead of an empty placeholder.
const resolveProductImage = (product) =>
  product.image || product.sizes?.find((size) => size.image)?.image || '';

export default function Category() {
  const { categoryKey } = useParams();
  const { isSoldOut, products } = useInventory();
  const isAll = categoryKey === 'all';
  const category = isAll ? ALL_CATEGORY : categories.find((c) => c.key === categoryKey);
  const filtered = isAll ? products : products.filter((p) => p.category === categoryKey);

  // On the "all" view, chips filter by category; sort applies everywhere.
  const [activeCat, setActiveCat] = useState('all');
  const [sort, setSort] = useState('featured');

  const visible = useMemo(() => {
    const scoped =
      isAll && activeCat !== 'all' ? filtered.filter((p) => p.category === activeCat) : filtered;
    return sortProducts(scoped, sort);
  }, [filtered, isAll, activeCat, sort]);

  const buildProductPath = (product) =>
    `/product/${product.slug ? product.slug : product.name.replace(/\s+/g, '-').toLowerCase()}`;

  if (!category) {
    return (
      <div className="container">
        <h2>Category not found</h2>
      </div>
    );
  }

  const categorySchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.title} | Sattari Music`,
    url: `https://sattarimusic.com/shop/${category.key}`,
    description: category.description,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: filtered.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://sattarimusic.com${buildProductPath(product)}`,
        name: product.name,
      })),
    },
  };

  return (
    <section className="section page-header-offset">
      <SEO
        title={isAll ? 'Shop All Products' : `${category.title} Drum Gear`}
        description={category.description}
        url={`https://sattarimusic.com/shop/${category.key}`}
      />
      <StructuredData data={categorySchema} />
      <div className="container section-header narrow">
        <p className="eyebrow">Category spotlight</p>
        <h1>{category.title}</h1>
        <p>{category.description}</p>
        <div className="shop-trust-bar" aria-label={`${category.title} highlights`}>
          {categoryHighlights[category.key].map((point) => (
            <span className="trust-chip" key={point}>
              {point}
            </span>
          ))}
        </div>
      </div>
      <div className="container shop-toolbar">
        {isAll && (
          <div className="shop-filter-chips" role="group" aria-label="Filter by category">
            <button
              type="button"
              className={`shop-filter-chip${activeCat === 'all' ? ' is-active' : ''}`}
              onClick={() => setActiveCat('all')}
              aria-pressed={activeCat === 'all'}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                type="button"
                key={c.key}
                className={`shop-filter-chip${activeCat === c.key ? ' is-active' : ''}`}
                onClick={() => setActiveCat(c.key)}
                aria-pressed={activeCat === c.key}
              >
                {c.title}
              </button>
            ))}
          </div>
        )}
        <div className="shop-toolbar-right">
          <span className="shop-result-count">
            {visible.length} {visible.length === 1 ? 'product' : 'products'}
          </span>
          <label className="shop-sort">
            <span className="shop-sort-label">Sort</span>
            <select
              className="control-input shop-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="container shop-empty-state">
          <p>No products match this filter yet.</p>
          <button type="button" className="btn-details" onClick={() => setActiveCat('all')}>
            Clear filter
          </button>
        </div>
      ) : null}

      <div className="container product-grid">
        {visible.map((product) => {
          // Special UI for Sattari Hand Crafted Cymbals
          if (product.name === 'Sattari Hand Crafted Cymbals' && categoryKey === 'cymbals') {
            return (
              <article
                className={`product-card-enhanced${isSoldOut(product) ? ' is-sold-out' : ''}`}
                key={product.name}
              >
                <div className="product-image-container">
                  <Link
                    to={buildProductPath(product)}
                    className="product-media-link"
                    aria-label={`View ${product.name}`}
                  >
                    <div className="product-image-placeholder" />
                    {isSoldOut(product) ? (
                      <span className="product-stock-badge">Out of stock</span>
                    ) : null}
                  </Link>
                  <div className="product-info-overlay">
                    <Link
                      to={buildProductPath(product)}
                      className="product-copy-link"
                      aria-label={`View details for ${product.name}`}
                    >
                      <p className="product-kicker">{categoryTitle(product.category)}</p>
                      <p className="product-name-enhanced">{product.name}</p>
                      <p className="product-price-enhanced">
                        <span className="product-price-accent">{formatPriceRange(product)}</span>
                      </p>
                    </Link>
                    <div className="product-actions">
                      <Link to={buildProductPath(product)} className="btn-details">
                        More Details
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          }
          // Default product card
          return (
            <article
              className={`product-card-enhanced${isSoldOut(product) ? ' is-sold-out' : ''}`}
              key={product.name}
            >
              <div className="product-image-container">
                <Link
                  to={buildProductPath(product)}
                  className="product-media-link"
                  aria-label={`View ${product.name}`}
                >
                  {isSoldOut(product) ? (
                    <span className="product-stock-badge">Out of stock</span>
                  ) : null}
                  {resolveProductImage(product) ? (
                    <OptimizedProductImage
                      src={resolveProductImage(product)}
                      alt={product.name}
                      className="product-image"
                      loading="lazy"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <div className="product-image-placeholder" />
                  )}
                </Link>
                <div className="product-info-overlay">
                  <Link
                    to={buildProductPath(product)}
                    className="product-copy-link"
                    aria-label={`View details for ${product.name}`}
                  >
                    <p className="product-kicker">{categoryTitle(product.category)}</p>
                    <p className="product-name-enhanced">{product.name}</p>
                    <p className="product-price-enhanced">
                      <span className="product-price-accent">{formatPriceRange(product)}</span>
                    </p>
                  </Link>
                  <div className="product-actions">
                    <Link to={buildProductPath(product)} className="btn-details">
                      More Details
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="container shop-back-link-row">
        <Link to="/shop" className="btn-details">
          Back to Shop
        </Link>
      </div>
    </section>
  );
}
