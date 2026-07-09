import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { products, formatPrice, resolveSelectedOption } from '../data/catalog';
import { useCart } from '../context/CartContext';
import OptimizedProductImage from '../components/OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';
import '../styles-products-premium.css';

const detailHighlights = {
  cymbals: ['Handcrafted character', 'Musical attack and sustain', 'Ready for studio or stage'],
  sticks: ['Consistent balance', 'Built for repeat sessions', 'Reliable feel across dynamics'],
  essentials: ['Portable and practical', 'Easy everyday setup', 'Made to keep you playing'],
  violins: ['Hand-carved tonewoods', 'Workshop-fitted and tuned', 'California made'],
};

export default function ProductDetail() {
  const { slug } = useParams();
  const product = products.find((p) =>
    p.slug ? p.slug === slug : p.name.replace(/\s+/g, '-').toLowerCase() === slug
  );
  const [selectedSize, setSelectedSize] = useState(product?.sizes ? product.sizes[0].size : null);
  const [selectedColor, setSelectedColor] = useState(
    product?.colors ? product.colors[0].name : null
  );
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState('');
  const { addToCart } = useCart();

  if (!product) {
    return (
      <div className="container">
        <h2>Product not found</h2>
      </div>
    );
  }

  const { size, unitPrice } = resolveSelectedOption(product, selectedSize);
  const detailImage = product.sizes?.find((option) => option.size === size)?.image || product.image;
  const galleryImages = product.gallery?.length ? product.gallery : [];
  const mainImage = galleryImages.length ? galleryImages[activeImage] : detailImage;
  const productUrl = `https://sattarimusic.com/product/${product.slug}`;
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: detailImage ? [`https://sattarimusic.com${detailImage}`] : undefined,
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
          availability: 'https://schema.org/InStock',
          url: productUrl,
          sku: `${product.slug}-${option.size.replace(/[^a-zA-Z0-9]/g, '')}`,
        }))
      : {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: unitPrice,
          availability: 'https://schema.org/InStock',
          url: productUrl,
          sku: product.slug,
        },
  };

  function handleAddToCart() {
    addToCart({ slug: product.slug, size, color: selectedColor, quantity });
    setAddedMessage('Added to cart.');
    window.setTimeout(() => setAddedMessage(''), 2200);
  }

  return (
    <section className="section page-header-offset">
      <SEO
        title={product.name}
        description={product.description.slice(0, 155)}
        image={detailImage || product.image}
        url={productUrl}
        type="product"
      />
      <StructuredData data={productSchema} />
      <div className="container product-detail-shell">
        <div className="product-detail-media-column">
          <div className="product-detail-image">
            {mainImage ? (
              <OptimizedProductImage
                src={mainImage}
                alt={product.name}
                loading="eager"
                fetchPriority="high"
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
                  className={`product-gallery-thumb${index === activeImage ? ' is-active' : ''}`}
                  onClick={() => setActiveImage(index)}
                  aria-label={`View image ${index + 1} of ${galleryImages.length}`}
                  aria-current={index === activeImage}
                >
                  <img src={img} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
          <div className="product-benefit-grid" aria-label="Product benefits">
            {detailHighlights[product.category].map((point) => (
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
                <label className="control-label">Choose Size</label>
                <select
                  className="control-input"
                  value={selectedSize}
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
          {product.colors && (
            <div className="control-group">
              <label className="control-label">Color: {selectedColor}</label>
              <div className="color-swatches" role="group" aria-label="Choose color">
                {product.colors.map((option) => (
                  <button
                    type="button"
                    key={option.name}
                    className={`color-swatch${selectedColor === option.name ? ' is-active' : ''}`}
                    style={{ '--swatch': option.hex }}
                    onClick={() => setSelectedColor(option.name)}
                    aria-pressed={selectedColor === option.name}
                    aria-label={option.name}
                    title={option.name}
                  />
                ))}
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
              <input
                id="qty"
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="qty-input-product"
              />
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.min(99, current + 1))}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>
          <div className="product-detail-actions">
            <button className="btn-add-cart" onClick={handleAddToCart}>
              {addedMessage ? 'Added ✓' : 'Add to Cart'}
            </button>
            <Link to="/cart" className="btn-details">
              Go to Cart
            </Link>
          </div>
          {addedMessage ? (
            <p className="success-message" aria-live="polite">
              {addedMessage}
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
      <div className="container shop-back-link-row">
        <Link to="/shop" className="btn-details">
          Back to Shop
        </Link>
      </div>
    </section>
  );
}
