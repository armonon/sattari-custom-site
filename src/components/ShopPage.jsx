import React from 'react';
import { useCart } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { categories, products, formatPrice } from '../data/catalog';

const shopMoreDescriptions = {
  cymbals: 'Browse our handcrafted cymbals, hi-hats, and splashes for every drummer.',
  sticks: 'Explore classic hickory, maple, and specialty sticks for every playing style.',
  essentials: 'Find practice pads, felts, keys, and must-have accessories for your kit.',
};

export default function ShopPage() {
  const { addToCart } = useCart();
  return (
    <section className="section page-header-offset">
      <div className="container section-header narrow">
        <p className="eyebrow">Shop drums</p>
        <h1>Build your setup with handcrafted Sattari gear</h1>
        <p>
          Add items to cart, review everything in one place, and checkout securely with Stripe.
        </p>
      </div>

      <div className="container card-grid three-col" style={{ marginBottom: '2.5rem' }}>
        {categories.map((category) => (
          <article className="info-card" key={category.key}>
            <h3>{category.title}</h3>
            <p>{category.description}</p>
          </article>
        ))}
      </div>

      {categories.map((category) => {
        const filtered = products.filter((p) => p.category === category.key).slice(0, 2);
        return (
          <div className="container product-grid" key={category.key}>
            {filtered.map((product) => (
              <article className="product-card" key={product.name}>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: 0,
                  paddingBottom: '110%',
                  overflow: 'hidden',
                  borderRadius: 16,
                  marginBottom: 0,
                  boxShadow: '0 4px 24px 0 rgba(0,0,0,0.13)'
                }}>
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="product-image" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  ) : (
                    <div className="product-image-placeholder" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  )}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: '1.1rem 1rem 0.7rem',
                    background: 'linear-gradient(0deg, rgba(18,18,18,0.92) 70%, rgba(18,18,18,0.45) 100%, rgba(18,18,18,0.0) 100%)',
                    backdropFilter: 'blur(8px)',
                    borderBottomLeftRadius: 16,
                    borderBottomRightRadius: 16,
                    zIndex: 2
                  }}>
                    <p className="product-name" style={{ margin: 0, fontWeight: 600, fontSize: '1.13rem', color: '#fff', textShadow: '0 2px 8px #0008' }}>{product.name}</p>
                    <p className="product-price" style={{ margin: '0.2rem 0 0.7rem', color: '#fff', fontWeight: 500, textShadow: '0 2px 8px #0008' }}>{product.sizes ? `${formatPrice(product.sizes[0].price)} - ${formatPrice(product.sizes[product.sizes.length-1].price)}` : formatPrice(product.price)}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                      <Link to={`/product/${product.slug ? product.slug : product.name.replace(/\s+/g, '-').toLowerCase()}`} className="button button-outline" style={{ background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1.5px solid #fff', fontWeight: 500, minWidth: 0, padding: '0.45rem 1.1rem', fontSize: '1rem' }}>More Details</Link>
                      <button
                        className="button button-solid"
                        style={{ marginLeft: 8, fontWeight: 600, fontSize: '1rem', padding: '0.45rem 1.1rem' }}
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
            <article className="product-card" style={{ borderStyle: 'dashed', opacity: 0.85 }}>
              <div className="product-image-placeholder" style={{ opacity: 0.5 }} />
              <p className="product-name">Shop More {category.title}</p>
              <p className="product-price" style={{ fontStyle: 'italic' }}>{shopMoreDescriptions[category.key]}</p>
                <Link to={`/shop/${category.key}`} className="button button-outline button-full">Browse All</Link>
            </article>
          </div>
        );
      })}
    </section>
  );
}
