import React from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { categories, products, formatPrice } from '../data/catalog';
import OptimizedProductImage from './OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';
import '../styles-products-premium.css';

const shopMoreDescriptions = {
  cymbals: 'Browse our handcrafted cymbals, hi-hats, and splashes for every drummer.',
  sticks: 'Explore classic hickory, maple, and specialty sticks for every playing style.',
  essentials: 'Find practice pads, felts, keys, and must-have accessories for your kit.',
};

const productSellingPoints = {
  cymbals: 'Hand-forged response with expressive attack and warm sustain.',
  sticks: 'Balanced feel, durable wood selection, and reliable rebound.',
  essentials: 'Built for daily practice, setup protection, and grab-and-go sessions.',
};

const trustPoints = ['Handcrafted quality', 'Secure Stripe checkout', 'Fast local fulfillment'];

const categorySpotlights = {
  cymbals: 'Expressive attack, warm sustain, and handcrafted nuance.',
  sticks: 'Balanced rebound and dependable feel for repeat sessions.',
  essentials: 'Purpose-built accessories for practice, setup, and carry.',
};

export default function ShopPage() {
  const { addToCart } = useCart();

  const buildProductPath = (product) =>
    `/product/${product.slug || product.name.replace(/\s+/g, '-').toLowerCase()}`;

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Sattari Music Shop',
    url: 'https://sattarimusic.com/shop',
    description:
      'Handcrafted cymbals, drumsticks, practice pads, and drum essentials from Sattari Music.',
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
        title="Shop Drum Gear"
        description="Browse premium Sattari cymbals, sticks, and drum accessories with secure checkout and California-based support."
        url="https://sattarimusic.com/shop"
      />
      <StructuredData data={itemListSchema} />
      <div className="container section-header narrow">
        <p className="eyebrow">Shop drums</p>
        <h1>Build your setup with handcrafted Sattari gear</h1>
        <p>Add items to cart, review everything in one place, and checkout securely with Stripe.</p>
        <div className="shop-trust-bar" aria-label="Storefront trust highlights">
          {trustPoints.map((point) => (
            <span className="trust-chip" key={point}>
              {point}
            </span>
          ))}
        </div>
      </div>

      <div className="container card-grid three-col shop-category-grid">
        {categories.map((category) => (
          <article className="info-card shop-category-card" key={category.key}>
            <p className="card-kicker">{category.title} spotlight</p>
            <h3>{category.title}</h3>
            <p>{category.description}</p>
            <p className="shop-category-spotlight">{categorySpotlights[category.key]}</p>
            <Link to={`/shop/${category.key}`} className="btn-secondary-detail shop-category-link">
              Explore {category.title}
            </Link>
          </article>
        ))}
      </div>

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
                <article className="product-card-enhanced" key={product.name}>
                  <div className="product-image-container">
                    {product.image ? (
                      <OptimizedProductImage
                        src={product.image}
                        alt={product.name}
                        className="product-image"
                        loading="lazy"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div
                        className="product-image-placeholder"
                        style={{
                          width: '100%',
                          height: '100%',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                        }}
                      />
                    )}
                    <div className="product-info-overlay">
                      <p className="product-kicker">{category.title}</p>
                      <p className="product-name-enhanced">{product.name}</p>
                      <p className="product-card-copy">{productSellingPoints[product.category]}</p>
                      <p className="product-price-enhanced">
                        <span className="product-price-accent">
                          {product.sizes
                            ? `${formatPrice(product.sizes[0].price)} - ${formatPrice(product.sizes[product.sizes.length - 1].price)}`
                            : formatPrice(product.price)}
                        </span>
                      </p>
                      <div className="product-actions">
                        <Link to={buildProductPath(product)} className="btn-details">
                          More Details
                        </Link>
                        <button
                          className="btn-add-cart"
                          onClick={() => addToCart({ slug: product.slug, quantity: 1 })}
                          aria-label={`Add ${product.name} to cart`}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
              <article className="shop-more-card" key={`${category.key}-more`}>
                <p className="shop-more-title">Shop More {category.title}</p>
                <p className="shop-more-desc">{shopMoreDescriptions[category.key]}</p>
                <Link to={`/shop/${category.key}`} className="btn-secondary-detail">
                  Browse All
                </Link>
              </article>
            </div>
          </section>
        );
      })}
    </section>
  );
}
