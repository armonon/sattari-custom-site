import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { products, formatPrice, resolveSelectedOption } from '../data/catalog';
import { useCart } from '../context/CartContext';

export default function ProductDetail() {
  const { slug } = useParams();
  const product = products.find(
    p => (p.slug ? p.slug === slug : p.name.replace(/\s+/g, '-').toLowerCase() === slug)
  );
  const [selectedSize, setSelectedSize] = useState(product?.sizes ? product.sizes[0].size : null);
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState('');
  const { addToCart } = useCart();

  if (!product) return <div className="container"><h2>Product not found</h2></div>;

  const { size, unitPrice } = resolveSelectedOption(product, selectedSize);

  function handleAddToCart() {
    addToCart({ slug: product.slug, size, quantity });
    setAddedMessage('Added to cart.');
  }

  return (
    <section className="section page-header-offset">
      <div className="container" style={{ maxWidth: 900, display: 'flex', flexWrap: 'wrap', gap: '2.5rem' }}>
        <div style={{ flex: '1 1 320px', minWidth: 320 }}>
          {product.slug === 'sattari-drummer-practice-pad' ? (
            <img
              src="/sattari site/drumpad.png"
              alt={product.name}
              style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 16, marginBottom: 16, background: '#222' }}
            />
          ) : (
            <div className="product-image-placeholder" style={{ minHeight: 280, marginBottom: 16 }} />
          )}
          {/* Add more images here if available */}
        </div>
        <div style={{ flex: '2 1 340px', minWidth: 320 }}>
          <h1>{product.name}</h1>
          {product.sizes ? (
            <>
              <label style={{ display: 'block', margin: '1rem 0 0.5rem' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>Choose Size:</span>
                <select
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 8, marginTop: 4 }}
                  value={selectedSize}
                  onChange={e => setSelectedSize(e.target.value)}
                >
                  {product.sizes.map(opt => (
                    <option key={opt.size} value={opt.size}>
                      {opt.size} — ${opt.price}
                    </option>
                  ))}
                </select>
              </label>
              <p className="product-price" style={{ fontSize: 24, margin: '0.5rem 0 1.2rem' }}>
                {formatPrice(unitPrice)}
              </p>
            </>
          ) : (
            <p className="product-price" style={{ fontSize: 24, margin: '0.5rem 0 1.2rem' }}>{formatPrice(product.price)}</p>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <label htmlFor="qty" style={{ color: 'var(--accent)' }}>Qty</label>
            <input
              id="qty"
              type="number"
              min={1}
              max={99}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 80, padding: '0.5rem', borderRadius: 8 }}
            />
          </div>
          <button className="button button-solid button-full" style={{ marginBottom: 10 }} onClick={handleAddToCart}>Add to Cart</button>
          {addedMessage ? <p style={{ marginTop: 0, color: 'var(--accent)' }}>{addedMessage}</p> : null}
          <Link to="/cart" className="button button-outline button-full" style={{ display: 'inline-block', textAlign: 'center', marginBottom: 16 }}>Go to Cart</Link>
          {/* Always show description and specs for Sattari Hand Crafted Cymbals */}
          {product.name === 'Sattari Hand Crafted Cymbals' ? (
            <>
              <p style={{ margin: '1.2rem 0 0.5rem', fontSize: '1.1rem' }}>{product.description}</p>
              <ul style={{ marginTop: 12 }}>
                {product.specs && product.specs.map((spec, i) => <li key={i}>{spec}</li>)}
              </ul>
            </>
          ) : (
            <details style={{ margin: '1.2rem 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--accent)' }}>More Details</summary>
              <p style={{ marginTop: 12 }}>{product.description}</p>
              <ul style={{ marginTop: 12 }}>
                {product.specs && product.specs.map((spec, i) => <li key={i}>{spec}</li>)}
              </ul>
            </details>
          )}
        </div>
      </div>
      <div className="container" style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link to="/shop" className="button button-outline">Back to Shop</Link>
      </div>
    </section>
  );
}
