import React from 'react';
import {
  ArrowUpRight,
  Disc3,
  Drumstick,
  Guitar,
  LayoutGrid,
  Music2,
  PackageOpen,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useInventory } from '../context/InventoryContext';
import { Link } from 'react-router-dom';
import { categories, formatPriceRange } from '../data/catalog';
import OptimizedProductImage from './OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';
import '../styles-products-premium.css';

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

const categoryIcons = {
  cymbals: Disc3,
  sticks: Drumstick,
  essentials: PackageOpen,
  violins: Music2,
  'guitar-bass': Guitar,
};

// Some products carry their image only on a size variant (e.g. the practice
// pad). Fall back to the first size image so every card shows a photo.
const resolveProductImage = (product) =>
  product.image || product.sizes?.find((size) => size.image)?.image || '';

const buildProductPath = (product) =>
  `/product/${product.slug || product.name.replace(/\s+/g, '-').toLowerCase()}`;

function ProductCard({ product, kicker, sellingPoint, recentlyAddedSlug, onQuickAdd, soldOut }) {
  const path = buildProductPath(product);
  const image = resolveProductImage(product);
  const priceLabel = formatPriceRange(product);

  return (
    <article className={`product-card-enhanced${soldOut ? ' is-sold-out' : ''}`}>
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
          {soldOut ? <span className="product-stock-badge">Out of stock</span> : null}
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
              disabled={soldOut}
              aria-label={
                soldOut ? `${product.name} is out of stock` : `Add ${product.name} to cart`
              }
            >
              {soldOut
                ? 'Out of Stock'
                : recentlyAddedSlug === product.slug
                  ? 'Added ✓'
                  : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ShopPage() {
  const { addToCart } = useCart();
  const { isSoldOut, products } = useInventory();
  const [recentlyAddedSlug, setRecentlyAddedSlug] = React.useState(null);
  const featuredProducts = categories.flatMap((category) =>
    products.filter((product) => product.category === category.key).slice(0, 2)
  );

  const handleQuickAdd = (product) => {
    if (isSoldOut(product)) return;
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
      <div className="container section-header narrow shop-page-intro">
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

      <div className="container shop-category-panel">
        <div className="shop-category-panel-heading">
          <div>
            <p className="card-kicker">Browse the catalog</p>
            <h2>Shop by category</h2>
          </div>
          <Link to="/shop/all">
            View all {products.length} products
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>

        <nav className="shop-category-list" aria-label="Shop product categories">
          {categories.map((category) => {
            const Icon = categoryIcons[category.key];
            const productCount = products.filter(
              (product) => product.category === category.key
            ).length;

            return (
              <Link
                to={`/shop/${category.key}`}
                className="shop-category-row"
                key={category.key}
                aria-label={`Explore ${category.title}`}
              >
                <span className="shop-category-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="shop-category-primary">
                  <strong>{category.title}</strong>
                  <small>
                    {productCount} {productCount === 1 ? 'product' : 'products'}
                  </small>
                </span>
                <span className="shop-category-action">
                  <ArrowUpRight size={17} aria-hidden="true" />
                </span>
              </Link>
            );
          })}

          <Link
            to="/shop/all"
            className="shop-category-row shop-all-row"
            aria-label="Shop all products"
          >
            <span className="shop-category-icon" aria-hidden="true">
              <LayoutGrid size={20} />
            </span>
            <span className="shop-category-primary">
              <strong>Shop all</strong>
              <small>{products.length} products</small>
            </span>
            <span className="shop-category-action">
              <ArrowUpRight size={17} aria-hidden="true" />
            </span>
          </Link>
        </nav>
      </div>

      <section className="container shop-featured-catalog">
        <div className="shop-catalog-header">
          <div>
            <p className="card-kicker">Featured catalog</p>
            <h2>Ready to play</h2>
          </div>
          <Link to="/shop/all" className="shop-catalog-all-link">
            View all {products.length} products
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="product-grid shop-featured-grid">
          {featuredProducts.map((product) => {
            const category = categories.find((item) => item.key === product.category);

            return (
              <ProductCard
                key={product.slug}
                product={product}
                kicker={category?.title || 'Sattari'}
                sellingPoint={productSellingPoints[product.category]}
                recentlyAddedSlug={recentlyAddedSlug}
                onQuickAdd={handleQuickAdd}
                soldOut={isSoldOut(product)}
              />
            );
          })}
        </div>
      </section>
    </section>
  );
}
