import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  formatPrice,
  formatPriceRange,
  resolveSelectedOption,
  categoryTitle,
} from '../data/catalog';
import { useCart } from '../context/CartContext';
import { useInventory } from '../context/InventoryContext';
import OptimizedProductImage from '../components/OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';
import { BUSINESS, absoluteUrl, breadcrumbSchema, businessSchema } from '../data/siteSeo';
import NotFoundPage from '../components/NotFoundPage';
import QuantityInput from '../components/QuantityInput';
import { MAX_LINE_QUANTITY } from '../utils/cartCatalog';
import '../styles-products-premium.css';

const detailHighlights = {
  cymbals: ['Handcrafted character', 'Musical attack and sustain', 'Ready for studio or stage'],
  sticks: ['Consistent balance', 'Built for repeat sessions', 'Reliable feel across dynamics'],
  essentials: ['Portable and practical', 'Easy everyday setup', 'Made to keep you playing'],
  violins: ['Hand-carved tonewoods', 'Workshop-fitted and tuned', 'California made'],
  'guitar-bass': ['Set up and ready to play', 'Ships from California', 'Electric or acoustic'],
};

// Each product gets its own selections: a size, color or photo index carried
// over from the previous product is meaningless on this one (a color it does
// not offer, or a photo past the end of its gallery).
export default function ProductDetail() {
  const { slug } = useParams();
  return <ProductDetailView key={slug} slug={slug} />;
}

function ProductDetailView({ slug }) {
  const { isVariantSoldOut, quantityFor, products, status, refresh } = useInventory();
  const product = products.find((p) =>
    p.slug ? p.slug === slug : p.name.replace(/\s+/g, '-').toLowerCase() === slug
  );
  // null until the shopper picks one; the defaults below follow the catalog,
  // which can change when live inventory arrives.
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState('');
  const [limitMessage, setLimitMessage] = useState('');
  const [retrying, setRetrying] = useState(false);
  const { addToCart, cartItems } = useCart();

  // Related items: same category first, then fill from the rest of the catalog.
  const related = useMemo(() => {
    if (!product) return [];
    const sameCategory = products.filter(
      (p) => p.category === product.category && p.slug !== product.slug
    );
    const others = products.filter(
      (p) => p.category !== product.category && p.slug !== product.slug
    );
    return [...sameCategory, ...others].slice(0, 4);
  }, [product, products]);

  if (!product) {
    // A product an employee added lives in the catalog layer, which arrives a
    // moment after the page does (prerendered pages carry the catalog from the
    // build, which predates it). Only the live catalog can say a product does
    // not exist: the not-found page is noindex, and showing it while the
    // catalog loads, or after the request failed, would have search engines
    // drop a product that exists.
    if (status === 'ready') return <NotFoundPage />;
    return (
      <section
        className="section page-header-offset product-detail-pending"
        aria-busy={status === 'loading'}
      >
        <div className="container section-header narrow">
          {status === 'loading' ? (
            <p role="status">Loading product…</p>
          ) : (
            <>
              <p role="alert">We couldn&apos;t load this product right now.</p>
              <div className="hero-actions">
                <button
                  type="button"
                  className="button button-solid"
                  disabled={retrying}
                  aria-busy={retrying}
                  onClick={() => {
                    setRetrying(true);
                    refresh().finally(() => setRetrying(false));
                  }}
                >
                  {retrying ? 'Trying again…' : 'Try again'}
                </button>
                <Link to="/shop" className="button button-outline">
                  Browse the shop
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  const { size, unitPrice } = resolveSelectedOption(product, selectedSize);
  const colorOptions = product.colors?.length ? product.colors : null;
  // The shopper's color while the product still offers it; otherwise the first
  // one in stock (or the first, when every color is sold out).
  const color = colorOptions
    ? (
        colorOptions.find((option) => option.name === selectedColor) ??
        colorOptions.find((option) => !isVariantSoldOut(product.slug, size, option.name)) ??
        colorOptions[0]
      ).name
    : null;
  // Stock is per variant, so this reflects the size and color currently
  // selected — switching to an available size re-enables the button.
  const variantSoldOut = isVariantSoldOut(product.slug, size, color);
  const variantRemaining = quantityFor(product.slug, size, color);
  const showRemaining = Number.isFinite(variantRemaining) && variantRemaining > 0;
  const availability = variantSoldOut
    ? 'https://schema.org/OutOfStock'
    : 'https://schema.org/InStock';
  const detailImage = product.sizes?.find((option) => option.size === size)?.image || product.image;
  const galleryImages = product.gallery?.length ? product.gallery : [];
  // Staff can shorten a gallery while the page is open.
  const photoIndex = Math.min(activeImage, Math.max(0, galleryImages.length - 1));
  const mainImage = galleryImages.length ? galleryImages[photoIndex] : detailImage;
  const productUrl = `https://sattarimusic.com/product/${product.slug}`;
  const searchDescription = `${product.name}. ${product.description}`;
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.slug,
    url: productUrl,
    description: product.description,
    image: detailImage ? [absoluteUrl(detailImage)] : undefined,
    brand: {
      '@type': 'Brand',
      name: 'Sattari Music',
    },
    category: product.category,
    offers: product.sizes?.length
      ? product.sizes.map((option) => ({
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: option.price,
          // Per size, so Google does not keep advertising a sold-out variant.
          availability: isVariantSoldOut(product.slug, option.size, color)
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
          url: productUrl,
          sku: `${product.slug}-${option.size.replace(/[^a-zA-Z0-9]/g, '')}`,
          seller: { '@id': businessSchema['@id'] },
        }))
      : {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: unitPrice,
          availability,
          url: productUrl,
          sku: product.slug,
          seller: { '@id': businessSchema['@id'] },
        },
  };

  // An online order takes at most MAX_LINE_QUANTITY of one item (checkout
  // refuses more), counting what is already in the cart.
  const inCart =
    cartItems.find(
      (line) => line.slug === product.slug && line.size === size && line.color === color
    )?.quantity ?? 0;
  const room = Math.max(0, MAX_LINE_QUANTITY - inCart);

  function handleAddToCart() {
    // Checkout refuses a colored product without one of its colors.
    if (variantSoldOut || (colorOptions && !color)) return;
    const adding = Math.min(quantity, room);
    const limit = `${MAX_LINE_QUANTITY} is the most one online order can include; call ${BUSINESS.phoneDisplay} for more.`;
    if (!adding) {
      setLimitMessage(`Your cart already has ${inCart}. ${limit}`);
      return;
    }
    addToCart({ slug: product.slug, size, color, quantity: adding });
    setLimitMessage(adding < quantity ? `Added ${adding}. ${limit}` : '');
    setAddedMessage('Added to cart.');
    window.setTimeout(() => setAddedMessage(''), 2200);
  }

  return (
    <section className="section page-header-offset">
      <SEO
        title={product.name}
        description={
          searchDescription.length > 160
            ? `${searchDescription.slice(0, 157).replace(/\s+\S*$/, '')}...`
            : searchDescription
        }
        image={detailImage || product.image}
        url={productUrl}
        type="product"
        price={unitPrice}
        availability={variantSoldOut ? 'out of stock' : 'in stock'}
        retailerId={product.slug}
      />
      <StructuredData data={productSchema} />
      <StructuredData
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Shop', path: '/shop' },
          { name: categoryTitle(product.category), path: `/shop/${product.category}` },
          { name: product.name, path: `/product/${product.slug}` },
        ])}
      />
      <div className="container product-detail-shell">
        <div className="product-detail-media-column">
          <div className="product-detail-image">
            {mainImage ? (
              <OptimizedProductImage
                src={mainImage}
                alt={product.name}
                loading="eager"
                fetchpriority="high"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            ) : (
              <div className="product-image-placeholder" />
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="product-gallery-thumbs" aria-label="Product gallery">
              {galleryImages.map((img, index) => (
                <button
                  type="button"
                  key={img}
                  className={`product-gallery-thumb${index === photoIndex ? ' is-active' : ''}`}
                  onClick={() => setActiveImage(index)}
                  aria-label={`View image ${index + 1} of ${galleryImages.length}`}
                  aria-current={index === photoIndex}
                >
                  <img src={img} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
          <div className="product-benefit-grid" aria-label="Product benefits">
            {/* Employees can set a category, so this lookup can miss. Falling
                back keeps an added product's page from crashing outright. */}
            {(detailHighlights[product.category] || detailHighlights.essentials).map((point) => (
              <div className="product-benefit" key={point}>
                {point}
              </div>
            ))}
          </div>
        </div>
        <div className="product-detail-content-card product-detail-content-column">
          <div className="product-hero-meta">
            <Link
              to={`/shop/${product.category}`}
              className="product-hero-badge product-hero-badge-link"
            >
              {product.category}
            </Link>
            <Link to="/cart" className="product-hero-badge product-hero-badge-link">
              Secure checkout
            </Link>
            <Link to="/services" className="product-hero-badge product-hero-badge-link">
              California based
            </Link>
          </div>
          <h1>{product.name}</h1>
          <p className="product-card-copy product-card-copy-detail">
            Dial in a premium setup with handcrafted Sattari gear designed to feel dependable from
            the first hit.
          </p>
          {product.sizes ? (
            <>
              <div className="control-group">
                <label htmlFor="product-size" className="control-label">
                  Choose Size
                </label>
                <select
                  id="product-size"
                  className="control-input"
                  value={size}
                  onChange={(e) => setSelectedSize(e.target.value)}
                >
                  {product.sizes.map((opt) => (
                    <option key={opt.size} value={opt.size}>
                      {opt.size} — ${opt.price}
                    </option>
                  ))}
                </select>
              </div>
              <p className="product-price-enhanced">
                <span className="product-price-accent">{formatPrice(unitPrice)}</span>
              </p>
            </>
          ) : (
            <p className="product-price-enhanced">
              <span className="product-price-accent">{formatPrice(product.price)}</span>
            </p>
          )}
          {colorOptions && (
            <div className="control-group">
              <p className="control-label">Color: {color}</p>
              <div className="color-swatches" role="group" aria-label="Choose color">
                {colorOptions.map((option) => {
                  const soldOut = isVariantSoldOut(product.slug, size, option.name);
                  const label = soldOut ? `${option.name} (out of stock)` : option.name;
                  return (
                    <button
                      type="button"
                      key={option.name}
                      className={`color-swatch${color === option.name ? ' is-active' : ''}${
                        soldOut ? ' is-sold-out' : ''
                      }`}
                      style={{ '--swatch': option.hex }}
                      onClick={() => setSelectedColor(option.name)}
                      aria-pressed={color === option.name}
                      aria-label={label}
                      title={label}
                    />
                  );
                })}
              </div>
            </div>
          )}
          <div className="control-group">
            <label htmlFor="qty" className="control-label">
              Qty
            </label>
            <div className="product-quantity-stepper">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <QuantityInput
                id="qty"
                value={quantity}
                onCommit={setQuantity}
                className="qty-input-product"
                aria-describedby="qty-limit"
              />
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.min(MAX_LINE_QUANTITY, current + 1))}
                aria-label="Increase quantity"
                disabled={quantity >= MAX_LINE_QUANTITY}
              >
                +
              </button>
            </div>
            <p id="qty-limit" className="product-quantity-limit">
              Up to {MAX_LINE_QUANTITY} per online order.
            </p>
          </div>
          <div className="product-detail-actions">
            <button
              className="btn-add-cart"
              onClick={handleAddToCart}
              disabled={variantSoldOut}
              aria-label={variantSoldOut ? `${product.name} is out of stock` : undefined}
            >
              {variantSoldOut ? 'Out of Stock' : addedMessage ? 'Added ✓' : 'Add to Cart'}
            </button>
            <Link to="/cart" className="btn-details">
              Go to Cart
            </Link>
          </div>
          {variantSoldOut ? (
            <p className="product-stock-note is-sold-out" aria-live="polite">
              {product.sizes?.length || product.colors?.length
                ? 'This option is out of stock. Try another size or color, or call us.'
                : 'Out of stock right now. Call us and we can let you know when it is back.'}
            </p>
          ) : showRemaining && variantRemaining <= 3 ? (
            <p className="product-stock-note is-low" aria-live="polite">
              Only {variantRemaining} left.
            </p>
          ) : null}
          {addedMessage ? (
            <p className="success-message" aria-live="polite">
              {addedMessage}
            </p>
          ) : null}
          {limitMessage ? (
            <p className="product-stock-note is-low" aria-live="polite">
              {limitMessage}
            </p>
          ) : null}
          <p className="product-shipping-note">
            Secure Stripe checkout, quick confirmation, and easy follow-up if you need help choosing
            sizes.
          </p>
          {product.name === 'Sattari Hand Crafted Cymbals' ? (
            <div className="product-description-section">
              <p className="product-description-lead">{product.description}</p>
              <ul className="product-specs-list">
                {product.specs && product.specs.map((spec, i) => <li key={i}>{spec}</li>)}
              </ul>
            </div>
          ) : (
            <details className="product-description-section" open>
              <summary className="product-description-title">Product Details</summary>
              <div className="product-description-content">
                <p>{product.description}</p>
                <ul className="product-specs-list">
                  {product.specs && product.specs.map((spec, i) => <li key={i}>{spec}</li>)}
                </ul>
              </div>
            </details>
          )}
        </div>
      </div>
      {related.length > 0 ? (
        <div className="container related-products">
          <div className="related-products-header">
            <p className="card-kicker">More from Sattari</p>
            <h2>You might also like</h2>
          </div>
          <div className="product-grid related-grid">
            {related.map((item) => {
              const image = item.image || item.sizes?.find((s) => s.image)?.image || '';
              return (
                <Link
                  to={`/product/${item.slug}`}
                  className="related-card interactive-card-link"
                  key={item.slug}
                >
                  <div className="related-card-media">
                    {image ? (
                      <OptimizedProductImage
                        src={image}
                        alt={item.name}
                        className="product-image"
                        loading="lazy"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="product-image-placeholder" />
                    )}
                  </div>
                  <div className="related-card-body">
                    <p className="related-card-kicker">{categoryTitle(item.category)}</p>
                    <p className="related-card-name">{item.name}</p>
                    <p className="product-price-accent">{formatPriceRange(item)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="container shop-back-link-row">
        <Link to="/shop" className="btn-details">
          Back to Shop
        </Link>
      </div>
    </section>
  );
}
