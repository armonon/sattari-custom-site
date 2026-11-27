import React from 'react';
import GuitarShowroom from './GuitarShowroom';
import ShopRepairFinder from './ShopRepairFinder';
import {
  ArrowUpRight,
  Check,
  Disc3,
  Drumstick,
  Guitar,
  LayoutGrid,
  Music2,
  PackageOpen,
  ShoppingBag,
  SlidersHorizontal,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useInventory } from '../context/InventoryContext';
import { Link } from 'react-router-dom';
import { categories, formatPriceRange } from '../data/catalog';
import { guitarStringPricing } from '../data/guitarStringPricing';
import OptimizedProductImage from './OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';
import { PAGE_SEO, breadcrumbSchema } from '../data/siteSeo';
import '../styles-products-premium.css';
import './StringsDiscovery.css';

const categoryIcons = {
  cymbals: Disc3,
  sticks: Drumstick,
  essentials: PackageOpen,
  violins: Music2,
  'guitar-bass': Guitar,
};

const featuredCategoryOrder = ['cymbals', 'violins', 'guitar-bass', 'sticks', 'essentials'];

// Some products carry their image only on a size variant (e.g. the practice
// pad). Fall back to the first size image so every card shows a photo.
const resolveProductImage = (product) =>
  product.image || product.sizes?.find((size) => size.image)?.image || '';

const buildProductPath = (product) =>
  `/product/${product.slug || product.name.replace(/\s+/g, '-').toLowerCase()}`;

function ProductCard({ product, kicker, recentlyAddedSlug, onQuickAdd, soldOut }) {
  const path = buildProductPath(product);
  const image = resolveProductImage(product);
  const priceLabel = formatPriceRange(product);
  const needsOptions = Boolean(product.colors?.length);
  const added = recentlyAddedSlug === product.slug;
  const actionLabel = soldOut ? 'Out of stock' : added ? 'Added to cart' : 'Add to cart';

  return (
    <article className={`shop-featured-product${soldOut ? ' is-sold-out' : ''}`}>
      <Link to={path} className="shop-featured-photo" aria-label={`View ${product.name}`}>
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
        <span className="shop-featured-open" aria-hidden="true">
          <ArrowUpRight size={18} />
        </span>
        {soldOut && <span className="shop-featured-stock">Out of stock</span>}
      </Link>
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
  const featuredGroups = featuredCategoryOrder.map((category) =>
    products.filter((product) => product.category === category).slice(0, 2)
  );
  const featuredProducts = [0, 1].flatMap((position) =>
    featuredGroups.map((group) => group[position]).filter(Boolean)
  );

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

      <div id="shop-catalog" className="container shop-category-panel">
        <ShopRepairFinder />
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

      <section
        id="instruments-for-sale"
        className="container strings-discovery"
        aria-labelledby="shop-instruments-title"
      >
        <h2 id="shop-instruments-title">Guitars and violins for sale in Woodland Hills</h2>
        <p>
          Start with the sound you want. Each instrument comparison shows the listed price and links
          to its product page. To try a specific model locally, ask about its availability when
          arranging your appointment.
        </p>
        <nav aria-label="Compare instruments for sale">
          <Link to="/shop/guitar-bass#steel-string-acoustic-guitars">
            Steel-string acoustic guitars
          </Link>
          <Link to="/shop/guitar-bass#classical-guitars">Classical guitars</Link>
          <Link to="/shop/guitar-bass#electric-guitars">Electric guitars</Link>
          <Link to="/shop/guitar-bass#bass-guitars">Five-string basses</Link>
          <Link to="/shop/violins#acoustic-violins">Acoustic violins</Link>
          <Link to="/shop/violins#electric-violins">Electric violins</Link>
          <Link to="/visit">Plan a Woodland Hills visit</Link>
        </nav>
      </section>

      <section className="container strings-discovery" aria-labelledby="shop-strings-title">
        <h2 id="shop-strings-title">Strings for guitars and violins</h2>
        <p>
          Standard guitar string sets cost {`$${guitarStringPricing.standardSet}`}. We carry Ernie
          Ball and other premium strings. Call the Woodland Hills shop for your preferred set and
          gauge or to arrange installation. You can also buy violin strings online.
        </p>
        <nav aria-label="Shop strings and string replacement">
          <Link to="/guitar-strings-woodland-hills">Electric &amp; acoustic guitar strings</Link>
          <Link to="/violin-strings-woodland-hills">Violin strings for sale</Link>
          <Link to="/services/guitar-restringing-woodland-hills">Guitar restringing</Link>
          <Link to="/services/violin-restringing-woodland-hills">Violin restringing</Link>
        </nav>
      </section>

      <section
        id="featured-catalog"
        className="shop-featured-catalog"
        aria-labelledby="featured-catalog-title"
      >
        <div className="container">
          <div className="shop-catalog-header">
            <div>
              <p className="card-kicker">Featured catalog</p>
              <h2 id="featured-catalog-title">
                Ready to play<span aria-hidden="true">.</span>
              </h2>
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
                  recentlyAddedSlug={recentlyAddedSlug}
                  onQuickAdd={handleQuickAdd}
                  soldOut={isSoldOut(product)}
                />
              );
            })}
          </div>
        </div>
      </section>
    </section>
  );
}
