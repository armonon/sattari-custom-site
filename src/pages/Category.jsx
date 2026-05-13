// src/pages/Category.jsx
import { useParams, Link } from 'react-router-dom';
import { categories, products, formatPrice } from '../data/catalog';
import OptimizedProductImage from '../components/OptimizedProductImage';
import { SEO, StructuredData } from '../utils/seo';
import '../styles-products-premium.css';

const categoryHighlights = {
  cymbals: ['Handcrafted tone', 'Stage-ready projection', 'Distinctive response'],
  sticks: ['Premium wood', 'Balanced rebound', 'Daily-play durability'],
  essentials: ['Practice-ready', 'Compact carry', 'Built for consistency'],
};

export default function Category() {
  const { categoryKey } = useParams();
  const category = categories.find((c) => c.key === categoryKey);
  const filtered = products.filter((p) => p.category === categoryKey);

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
        title={`${category.title} Drum Gear`}
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
      <div className="container product-grid">
        {filtered.map((product) => {
          // Special UI for Sattari Hand Crafted Cymbals
          if (product.name === 'Sattari Hand Crafted Cymbals' && categoryKey === 'cymbals') {
            return (
              <article className="product-card-enhanced" key={product.name}>
                <div className="product-image-container">
                  <Link
                    to={buildProductPath(product)}
                    className="product-media-link"
                    aria-label={`View ${product.name}`}
                  >
                    <div className="product-image-placeholder" />
                  </Link>
                  <div className="product-info-overlay">
                    <Link
                      to={buildProductPath(product)}
                      className="product-copy-link"
                      aria-label={`View details for ${product.name}`}
                    >
                      <p className="product-kicker">{category.title}</p>
                      <p className="product-name-enhanced">{product.name}</p>
                      <p className="product-price-enhanced">
                        <span className="product-price-accent">
                          {`${formatPrice(product.sizes[0].price)} - ${formatPrice(
                            product.sizes[product.sizes.length - 1].price
                          )}`}
                        </span>
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
            <article className="product-card-enhanced" key={product.name}>
              <div className="product-image-container">
                <Link
                  to={buildProductPath(product)}
                  className="product-media-link"
                  aria-label={`View ${product.name}`}
                >
                  {product.image ? (
                    <OptimizedProductImage
                      src={product.image}
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
                    <p className="product-kicker">{category.title}</p>
                    <p className="product-name-enhanced">{product.name}</p>
                    <p className="product-price-enhanced">
                      <span className="product-price-accent">
                        {product.sizes
                          ? `${formatPrice(product.sizes[0].price)} - ${formatPrice(
                              product.sizes[product.sizes.length - 1].price
                            )}`
                          : formatPrice(product.price)}
                      </span>
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
