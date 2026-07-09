import React from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { categories, products, formatPriceRange } from '../data/catalog';
import OptimizedProductImage from './OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';
import '../styles-products-premium.css';

const shopMoreDescriptions = {
  cymbals: 'Browse our handcrafted cymbals, hi-hats, and splashes for every drummer.',
  sticks: 'Explore classic hickory, maple, and specialty sticks for every playing style.',
  essentials: 'Find practice pads, felts, keys, and must-have accessories for your kit.',
  violins:
    'Browse handcrafted acoustic, electric, and silent violins, fitted and tuned in California.',
  'guitar-bass': 'Electric and acoustic guitars, bass, and guitar accessories from Sattari.',
};

const productSellingPoints = {
  cymbals: 'Hand-forged response with expressive attack and warm sustain.',
  sticks: 'Balanced feel, durable wood selection, and reliable rebound.',
  essentials: 'Built for daily practice, setup protection, and grab-and-go sessions.',
  violins: 'Hand-carved tonewoods, workshop-fitted and tuned for expressive, reliable play.',
  'guitar-bass': 'Set up and ready to play, shipped from California.',
};

const trustPoints = [
  { label: 'Instruments & accessories', to: '/shop/instruments-los-angeles' },
  { label: 'Secure Stripe checkout', to: '/cart' },
  { label: 'Repairs, rentals & classes', to: '/services' },
];

const categorySpotlights = {
  cymbals: 'Expressive attack, warm sustain, and handcrafted nuance.',
  sticks: 'Balanced rebound and dependable feel for repeat sessions.',
  essentials: 'Purpose-built accessories for practice, setup, and carry.',
  violins: 'Acoustic warmth, electric versatility, and silent practice — all handcrafted.',
  'guitar-bass': 'Electric and acoustic tone, set up and ready to play.',
};

// Some products carry their image only on a size variant (e.g. the practice
// pad). Fall back to the first size image so every card shows a photo.
const resolveProductImage = (product) =>
  product.image || product.sizes?.find((size) => size.image)?.image || '';

const buildProductPath = (product) =>
  `/product/${product.slug || product.name.replace(/\s+/g, '-').toLowerCase()}`;

const categoryTitle = (key) => categories.find((c) => c.key === key)?.title || 'Shop';

function ProductCard({ product, kicker, sellingPoint, recentlyAddedSlug, onQuickAdd }) {
  const path = buildProductPath(product);
  const image = resolveProductImage(product);
  const priceLabel = formatPriceRange(product);

  return (
    <article className="product-card-enhanced">
      <div className="product-image-container">
        <Link to={path} className="product-media-link" aria-label={`View ${product.name}`}>
          {image ? (
            <OptimizedProductImage
              src={image}
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
            to={path}
            className="product-copy-link"
            aria-label={`View details for ${product.name}`}
          >
            <p className="product-kicker">{kicker}</p>
            <p className="product-name-enhanced">{product.name}</p>
            <p className="product-card-copy">{sellingPoint}</p>
            <p className="product-price-enhanced">
              <span className="product-price-accent">{priceLabel}</span>
            </p>
          </Link>
          <div className="product-actions">
            <Link to={path} className="btn-details">
              More Details
            </Link>
            <button
              className={`btn-add-cart${recentlyAddedSlug === product.slug ? ' is-added' : ''}`}
              onClick={() => onQuickAdd(product)}
              aria-label={`Add ${product.name} to cart`}
            >
              {recentlyAddedSlug === product.slug ? 'Added ✓' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ShopPage() {
  const { addToCart } = useCart();
  const [recentlyAddedSlug, setRecentlyAddedSlug] = React.useState(null);

  const handleQuickAdd = (product) => {
    addToCart({ slug: product.slug, quantity: 1 });
    setRecentlyAddedSlug(product.slug);
    window.setTimeout(() => setRecentlyAddedSlug(null), 1800);
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Sattari Music Shop',
    url: 'https://sattarimusic.com/shop',
    description:
      'Instruments, music accessories, handcrafted cymbals, drumsticks, practice pads, and musician essentials from Sattari Music.',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: products.slice(0, 10).map((product, index) => ({
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
        title="Shop Instruments & Music Accessories"
        description="Browse instruments, accessories, premium Sattari cymbals, sticks, drum essentials, and musician gear with secure checkout and California-based support."
        url="https://sattarimusic.com/shop"
      />
      <StructuredData data={itemListSchema} />
      <div className="container section-header narrow">
        <p className="eyebrow">Shop Sattari Music</p>
        <h1>Build your setup with instruments, accessories, and handcrafted Sattari gear</h1>
        <p>
          Shop the current catalog online, or ask about instruments, accessories, repairs, rentals,
          rehearsal space, studio time, teachers, and classes locally.
        </p>
        <div className="shop-trust-bar" aria-label="Storefront trust highlights">
          {trustPoints.map((point) => (
            <Link className="trust-chip trust-chip-link" to={point.to} key={point.label}>
              {point.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="container card-grid three-col shop-category-grid">
        {categories.map((category) => (
          <Link
            to={`/shop/${category.key}`}
            className="info-card shop-category-card interactive-card-link"
            key={category.key}
            aria-label={`Explore ${category.title}`}
          >
            <p className="card-kicker">{category.title} spotlight</p>
            <h3>{category.title}</h3>
            <p>{category.description}</p>
            <p className="shop-category-spotlight">{categorySpotlights[category.key]}</p>
            <span className="btn-secondary-detail shop-category-link">
              Explore {category.title}
            </span>
          </Link>
        ))}
      </div>

      <section className="container shop-collection-block" aria-label="All products">
        <div className="shop-collection-header">
          <div>
            <p className="card-kicker">Everything in the shop</p>
            <h2>Shop all</h2>
          </div>
          <p>Browse the full Sattari catalog in one place.</p>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              kicker={categoryTitle(product.category)}
              sellingPoint={productSellingPoints[product.category]}
              recentlyAddedSlug={recentlyAddedSlug}
              onQuickAdd={handleQuickAdd}
            />
          ))}
        </div>
      </section>

      {categories.map((category) => {
        const filtered = products.filter((p) => p.category === category.key).slice(0, 2);
        return (
          <section className="container shop-collection-block" key={category.key}>
            <div className="shop-collection-header">
              <div>
                <p className="card-kicker">Featured collection</p>
                <h2>{category.title}</h2>
              </div>
              <p>{shopMoreDescriptions[category.key]}</p>
            </div>
            <div className="product-grid">
              {filtered.map((product) => (
                <ProductCard
                  key={product.slug}
                  product={product}
                  kicker={category.title}
                  sellingPoint={productSellingPoints[product.category]}
                  recentlyAddedSlug={recentlyAddedSlug}
                  onQuickAdd={handleQuickAdd}
                />
              ))}
              <Link
                to={`/shop/${category.key}`}
                className="shop-more-card interactive-card-link"
                key={`${category.key}-more`}
                aria-label={`Browse all ${category.title}`}
              >
                <p className="shop-more-title">Shop More {category.title}</p>
                <p className="shop-more-desc">{shopMoreDescriptions[category.key]}</p>
                <span className="btn-secondary-detail">Browse All</span>
              </Link>
            </div>
          </section>
        );
      })}
    </section>
  );
}
