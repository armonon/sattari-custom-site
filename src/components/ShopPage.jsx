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
import './ShopCatalog.css';

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

function ProductCard({ product, recentlyAddedSlug, onQuickAdd, soldOut }) {
  const path = buildProductPath(product);
  const image = resolveProductImage(product);
  const priceLabel = formatPriceRange(product);
  const needsOptions = Boolean(product.colors?.length);
  const added = recentlyAddedSlug === product.slug;

  return (
    <article className={`shopx-card${soldOut ? ' is-sold-out' : ''}`}>
      <Link to={path} className="shopx-photo" aria-label={`View ${product.name}`}>
        {image ? (
          <OptimizedProductImage
            src={image}
            alt={product.name}
            loading="lazy"
            sizes="(max-width: 520px) 50vw, (max-width: 980px) 33vw, 300px"
          />
        ) : (
          <span className="shopx-placeholder">
            <Music2 size={38} strokeWidth={1} aria-hidden="true" />
            <span>Image coming soon</span>
          </span>
        )}
        {soldOut && <span className="shop-featured-stock shopx-stock">Out of stock</span>}
      </Link>
      <div className="shopx-info">
        <h4>
          <Link to={path} aria-label={`View details for ${product.name}`}>
            {product.name}
          </Link>
        </h4>
        <p className="shopx-price">{priceLabel}</p>
      </div>
      {needsOptions && !soldOut ? (
        <Link to={path} className="shopx-buy" aria-label={`Choose a color for ${product.name}`}>
          <SlidersHorizontal size={16} aria-hidden="true" /> Choose color
        </Link>
      ) : (
        <button
          type="button"
          className={`shopx-buy${added ? ' is-added' : ''}`}
          onClick={() => onQuickAdd(product)}
          disabled={soldOut}
          aria-label={soldOut ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
        >
          {added ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <ShoppingBag size={16} aria-hidden="true" />
          )}{' '}
          {soldOut ? 'Out of stock' : added ? 'Added' : 'Add to cart'}
        </button>
      )}
      <span className="shopx-announcement" role="status">
        {added ? `${product.name} added to cart.` : ''}
      </span>
    </article>
  );
}

export default function ShopPage() {
  const { addToCart } = useCart();
  const { isSoldOut, products } = useInventory();
  const [recentlyAddedSlug, setRecentlyAddedSlug] = React.useState(null);
  // Every product, grouped by category in a fixed order.
  const groups = featuredCategoryOrder
    .map((key) => ({
      category: categories.find((item) => item.key === key),
      items: products.filter((product) => product.category === key),
    }))
    .filter((group) => group.category && group.items.length);
  const listedProducts = groups.flatMap((group) => group.items);

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
      itemListElement: listedProducts.map((product, index) => ({
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

      <div id="shop-catalog" className="container shopx">
        <header className="shopx-heading">
          <div>
            <p className="shopx-kicker">The catalog</p>
            <h2>
              Ready to play<span aria-hidden="true">.</span>
            </h2>
          </div>
          <Link to="/shop/all" className="shopx-all">
            View all {products.length} products
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </header>

        <nav className="shopx-chips" aria-label="Shop product categories">
          {groups.map(({ category, items }) => {
            const Icon = categoryIcons[category.key];
            return (
              <a href={`#shop-${category.key}`} key={category.key}>
                <Icon size={17} aria-hidden="true" />
                {category.title}
                <small>{items.length}</small>
              </a>
            );
          })}
          <Link to="/shop/all" aria-label="Shop all products">
            <LayoutGrid size={17} aria-hidden="true" />
            Shop all
            <small>{products.length}</small>
          </Link>
        </nav>

        {groups.map(({ category, items }) => (
          <section
            key={category.key}
            id={`shop-${category.key}`}
            className="shopx-group"
            aria-labelledby={`shop-${category.key}-title`}
          >
            <header>
              <h3 id={`shop-${category.key}-title`}>
                {category.title}
                <small>
                  {items.length} {items.length === 1 ? 'product' : 'products'}
                </small>
              </h3>
              <Link to={`/shop/${category.key}`} aria-label={`Explore ${category.title}`}>
                View category <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </header>
            <div className="shopx-grid">
              {items.map((product) => (
                <ProductCard
                  key={product.slug}
                  product={product}
                  recentlyAddedSlug={recentlyAddedSlug}
                  onQuickAdd={handleQuickAdd}
                  soldOut={isSoldOut(product)}
                />
              ))}
            </div>
          </section>
        ))}

        <ShopRepairFinder />
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
    </section>
  );
}
