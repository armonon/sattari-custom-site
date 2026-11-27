import React from 'react';
import GuitarShowroom from './GuitarShowroom';
import ShopRepairFinder from './ShopRepairFinder';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Music2,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useInventory } from '../context/InventoryContext';
import { Link } from 'react-router-dom';
import { categories, formatPriceRange } from '../data/catalog';
import OptimizedProductImage from './OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';
import { PAGE_SEO, breadcrumbSchema } from '../data/siteSeo';
import '../styles-products-premium.css';

import './ShopGallery.css';

const featuredCategoryOrder = ['cymbals', 'violins', 'guitar-bass', 'sticks', 'essentials'];

// Some products carry their image only on a size variant (e.g. the practice
// pad). Fall back to the first size image so every card shows a photo.
const resolveProductImage = (product) =>
  product.image || product.sizes?.find((size) => size.image)?.image || '';

const buildProductPath = (product) =>
  `/product/${product.slug || product.name.replace(/\s+/g, '-').toLowerCase()}`;

function ProductCard({
  product,
  kicker,
  recentlyAddedSlug,
  onQuickAdd,
  soldOut,
  filmActive,
  onSelect,
}) {
  const path = buildProductPath(product);
  const image = resolveProductImage(product);
  const priceLabel = formatPriceRange(product);
  const needsOptions = Boolean(product.colors?.length);
  const added = recentlyAddedSlug === product.slug;
  const actionLabel = soldOut ? 'Out of stock' : added ? 'Added to cart' : 'Add to cart';

  return (
    <article
      data-active={filmActive}
      data-category={product.category}
      className={`shop-featured-product${soldOut ? ' is-sold-out' : ''}`}
    >
      <button
        type="button"
        className="shop-featured-photo"
        aria-label={`Feature ${product.name}`}
        aria-pressed={filmActive}
        onClick={onSelect}
      >
        {image ? (
          <OptimizedProductImage
            src={image}
            alt={product.name}
            loading="lazy"
            sizes="(max-width: 380px) 100vw, (max-width: 700px) 50vw, (max-width: 980px) 33vw, 280px"
          />
        ) : (
          <span className="shop-featured-placeholder">
            <Music2 size={38} strokeWidth={1} aria-hidden="true" />
            <span>Image coming soon</span>
          </span>
        )}
        {soldOut && <span className="shop-featured-stock">Out of stock</span>}
      </button>
      <div className="shop-featured-info">
        <p className="shop-featured-category">{kicker}</p>
        <h3>
          <Link to={path} aria-label={`View details for ${product.name}`}>
            {product.name}
          </Link>
        </h3>
        <div className="shop-featured-purchase">
          <p className="shop-featured-price">{priceLabel}</p>
          {needsOptions && !soldOut ? (
            <Link
              to={path}
              className="shop-featured-action"
              aria-label={`Choose a color for ${product.name}`}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              <span className="shop-featured-tooltip" aria-hidden="true">
                Choose color
              </span>
            </Link>
          ) : (
            <button
              type="button"
              className={`shop-featured-action${added ? ' is-added' : ''}`}
              onClick={() => onQuickAdd(product)}
              disabled={soldOut}
              aria-label={
                soldOut ? `${product.name} is out of stock` : `Add ${product.name} to cart`
              }
            >
              {added ? (
                <Check size={19} aria-hidden="true" />
              ) : (
                <ShoppingBag size={18} aria-hidden="true" />
              )}
              <span className="shop-featured-tooltip" aria-hidden="true">
                {actionLabel}
              </span>
            </button>
          )}
        </div>
        <span className="shop-featured-announcement" role="status">
          {added ? `${product.name} added to cart.` : ''}
        </span>
      </div>
    </article>
  );
}

export default function ShopPage() {
  const { addToCart } = useCart();
  const { isSoldOut, products } = useInventory();
  const [recentlyAddedSlug, setRecentlyAddedSlug] = React.useState(null);
  const [expanded, setExpanded] = React.useState(false);
  const [focusSlug, setFocusSlug] = React.useState(null);
  const featuredGroups = featuredCategoryOrder.map((category) =>
    products.filter((product) => product.category === category).slice(0, 2)
  );
  const featuredProducts = [0, 1].flatMap((position) =>
    featuredGroups.map((group) => group[position]).filter(Boolean)
  );

  const visibleProducts = expanded ? featuredProducts : featuredProducts.slice(0, 4);
  const activeIndex = Math.max(
    0,
    visibleProducts.findIndex((item) => item.slug === focusSlug)
  );
  function step(direction) {
    const next = (activeIndex + direction + visibleProducts.length) % visibleProducts.length;
    setFocusSlug(visibleProducts[next].slug);
  }

  const handleQuickAdd = (product) => {
    // Colored products link to their page instead (see ProductCard).
    if (isSoldOut(product) || product.colors?.length) return;
    addToCart({ slug: product.slug, quantity: 1 });
    setRecentlyAddedSlug(product.slug);
    window.setTimeout(() => setRecentlyAddedSlug(null), 1800);
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Sattari Music Shop',
    url: 'https://sattarimusic.com/shop',
    description: PAGE_SEO.shop.description,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: featuredProducts.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://sattarimusic.com${buildProductPath(product)}`,
        name: product.name,
      })),
    },
  };

  return (
    <section className="section page-header-offset shop-with-showroom">
      <SEO {...PAGE_SEO.shop} />
      <StructuredData
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Shop', path: '/shop' },
        ])}
      />
      <StructuredData data={itemListSchema} />
      <GuitarShowroom />

      <section
        id="featured-catalog"
        className="shop-featured-catalog filmstrip"
        aria-labelledby="featured-catalog-title"
      >
        <div id="shop-catalog">
          <div className="shop-catalog-header">
            <h2 id="featured-catalog-title">Featured products</h2>
            {visibleProducts.length > 1 && (
              <div className="film-arrows">
                <button
                  type="button"
                  aria-label="Previous featured product"
                  onClick={() => step(-1)}
                >
                  <ArrowLeft />
                </button>
                <button type="button" aria-label="Next featured product" onClick={() => step(1)}>
                  <ArrowRight />
                </button>
              </div>
            )}
          </div>
          <div id="gallery-products" className="film-frames">
            {visibleProducts.map((product, index) => {
              const category = categories.find((item) => item.key === product.category);

              return (
                <ProductCard
                  key={product.slug}
                  product={product}
                  filmActive={index === activeIndex}
                  onSelect={() => setFocusSlug(product.slug)}
                  kicker={category?.title || 'Sattari'}
                  recentlyAddedSlug={recentlyAddedSlug}
                  onQuickAdd={handleQuickAdd}
                  soldOut={isSoldOut(product)}
                />
              );
            })}
          </div>
          {featuredProducts.length > 4 && (
            <button
              type="button"
              className="gallery-more"
              aria-expanded={expanded}
              aria-controls="gallery-products"
              onClick={() => {
                setExpanded(!expanded);
                setFocusSlug(null);
              }}
            >
              {expanded ? 'Show fewer products' : 'Show more products'}
            </button>
          )}
        </div>
      </section>

      <section className="film-services" aria-label="Strings and repair">
        <div className="film-service-links">
          <div id="shop-strings-title">
            <h2>Find your strings</h2>
            <Link to="/guitar-strings-woodland-hills">
              Guitar strings <ArrowUpRight size={16} />
            </Link>
            <Link to="/violin-strings-woodland-hills">
              Violin strings <ArrowUpRight size={16} />
            </Link>
          </div>
          <div>
            <h2>Instrument repair</h2>
            <Link to="/services/instrument-repair-los-angeles">
              Repairs and setup <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <ShopRepairFinder />
      </section>
      <nav
        id="shop-categories"
        className="gallery-category-bar"
        aria-label="Shop product categories"
      >
        <Link to="/shop/all">All products</Link>
        {categories.map((category) => (
          <Link key={category.key} to={`/shop/${category.key}`}>
            {category.title}
          </Link>
        ))}
      </nav>

      <section className="film-about" id="instruments-for-sale">
        <h2>Sattari Music, Woodland Hills</h2>
        <p>Visit our shop by appointment to try an instrument or talk through a repair with us.</p>
        <Link to="/visit">
          Plan your visit <ArrowUpRight size={16} />
        </Link>
      </section>
    </section>
  );
}
