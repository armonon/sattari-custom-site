// src/pages/Category.jsx
import { useParams, Link } from 'react-router-dom';
import { categories, products, formatPrice } from '../data/catalog';

export default function Category() {
  const { categoryKey } = useParams();
  const category = categories.find(c => c.key === categoryKey);
  const filtered = products.filter(p => p.category === categoryKey);

  if (!category) return <div className="container"><h2>Category not found</h2></div>;

  return (
    <section className="section page-header-offset">
      <div className="container section-header narrow">
        <h1>{category.title}</h1>
        <p>{category.description}</p>
      </div>
      <div className="container product-grid">
        {filtered.map(product => {
          // Special UI for Sattari Hand Crafted Cymbals
          if (product.name === 'Sattari Hand Crafted Cymbals' && categoryKey === 'cymbals') {
            return (
              <article className="product-card" key={product.name}>
                <div className="product-image-placeholder" style={{ minHeight: 180, marginBottom: 16 }} />
                <p className="product-name">{product.name}</p>
                <p className="product-price" style={{ fontWeight: 600, fontSize: '1.2rem' }}>
                  ${product.sizes[0].price} - ${product.sizes[product.sizes.length-1].price}
                </p>
                {/* Description removed; only shown on detail page */}
                {/* Specs removed; only shown on detail page */}
                <Link to={`/product/${product.slug ? product.slug : product.name.replace(/\s+/g, '-').toLowerCase()}`} className="button button-outline button-full" style={{ marginTop: 16 }}>More Details</Link>
              </article>
            );
          }
          // Default product card
          return (
            <article className="product-card" key={product.name}>
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  style={{ width: '100%', minHeight: 180, objectFit: 'cover', borderRadius: 16, marginBottom: 16 }}
                />
              ) : (
                <div className="product-image-placeholder" />
              )}
              <p className="product-name">{product.name}</p>
              <p className="product-price">
                {product.sizes
                  ? `${formatPrice(product.sizes[0].price)} - ${formatPrice(product.sizes[product.sizes.length - 1].price)}`
                  : formatPrice(product.price)}
              </p>
              <Link to={`/product/${product.slug ? product.slug : product.name.replace(/\s+/g, '-').toLowerCase()}`} className="button button-outline button-full">More Details</Link>
            </article>
          );
        })}
      </div>
      <div className="container" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link to="/shop" className="button button-outline">Back to Shop</Link>
      </div>
    </section>
  );
}
