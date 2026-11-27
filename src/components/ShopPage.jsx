import React from 'react';
import GuitarShowroom from './GuitarShowroom';
import ShopRepairFinder from './ShopRepairFinder';
import { ArrowUpRight, Check, ShoppingBag } from 'lucide-react';
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
  const active = visibleProducts[activeIndex];
  const [wallOpen, setWallOpen] = React.useState(false);
  const wallRef = React.useRef(null);
  const wallTrigger = React.useRef(null);
  React.useEffect(() => {
    if (wallOpen) wallRef.current?.focus({ preventScroll: false });
  }, [wallOpen]);

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
      <section
        id="featured-catalog"
        className="groove-hero"
        aria-labelledby="featured-catalog-title"
      >
        {active && (
          <div
            className="groove-feature"
            data-cymbal={resolveProductImage(active) === '/sattari site/crash.png'}
          >
            <div key={active.slug} className="groove-art">
              <OptimizedProductImage
                src={resolveProductImage(active)}
                alt={active.name}
                loading="eager"
                fetchpriority="high"
              />
            </div>
            <div className="groove-caption" aria-live="polite">
              <h2>
                <Link to={buildProductPath(active)}>{active.name}</Link>
              </h2>
              <strong>{formatPriceRange(active)}</strong>
              {isSoldOut(active) ? (
                <button disabled aria-label={`${active.name} is out of stock`}>
                  Out of stock
                </button>
              ) : active.colors?.length || active.sizes?.length || active.purchaseInquiry ? (
                <Link
                  className="groove-buy"
                  to={buildProductPath(active)}
                  aria-label={
                    active.colors?.length
                      ? `Choose a color for ${active.name}`
                      : `View options for ${active.name}`
                  }
                >
                  View options <ArrowUpRight size={17} />
                </Link>
              ) : (
                <button
                  className="groove-buy"
                  aria-label={`Add ${active.name} to cart`}
                  onClick={() => handleQuickAdd(active)}
                >
                  {recentlyAddedSlug === active.slug ? (
                    <>
                      <Check size={17} /> Added
                    </>
                  ) : (
                    <>
                      Add to cart <ShoppingBag size={17} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        <div className="groove-index" id="shop-catalog">
          <h1 id="featured-catalog-title">Featured products</h1>
          <div className="groove-rows">
            {visibleProducts.map((item, i) => (
              <button
                key={item.slug}
                type="button"
                className="groove-row"
                aria-label={`Feature ${item.name}`}
                aria-pressed={i === activeIndex}
                onClick={() => setFocusSlug(item.slug)}
              >
                <span aria-hidden="true" className="groove-pointer">
                  ▸
                </span>
                <OptimizedProductImage src={resolveProductImage(item)} alt="" />
                <span>{item.name}</span>
                <strong>{formatPriceRange(item)}</strong>
              </button>
            ))}
          </div>
          <div className="groove-links">
            {featuredProducts.length > 4 && (
              <button
                type="button"
                onClick={() => {
                  setExpanded(!expanded);
                  setFocusSlug(null);
                }}
                aria-expanded={expanded}
              >
                {expanded ? 'Show fewer products' : 'Show more products'}
              </button>
            )}
            <button
              type="button"
              ref={wallTrigger}
              onClick={() => setWallOpen(true)}
              aria-expanded={wallOpen}
            >
              Explore the 3D guitar wall <ArrowUpRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {wallOpen && (
        <section className="groove-wall" ref={wallRef} tabIndex={-1} aria-label="3D guitar wall">
          <button
            className="groove-return"
            onClick={() => {
              setWallOpen(false);
              wallTrigger.current?.focus();
            }}
          >
            Back to featured products
          </button>
          <GuitarShowroom />
        </section>
      )}

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
