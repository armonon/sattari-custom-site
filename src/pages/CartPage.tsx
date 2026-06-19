import { useMemo, useState, FC } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@context/CartContext';
import type { CartContextValue, CartItem } from '@/types';
import { createCheckoutSession } from '@utils/checkout';
import '@/styles-cart-page-premium.css';

const CartPage: FC = () => {
  const { cartItems, subtotal, updateQuantity, removeFromCart, clearCart } =
    useCart() as CartContextValue;
  const [checkoutError, setCheckoutError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [removingItems, setRemovingItems] = useState<Set<string>>(new Set());

  const shipping = useMemo(() => (cartItems.length ? 7.95 : 0), [cartItems.length]);
  const orderTotal = subtotal + shipping;
  const orderHighlights = [
    'Secure Stripe payment',
    'No account required',
    'Fast confirmation after checkout',
  ];

  const handleRemove = async (key: string) => {
    setRemovingItems((prev) => new Set([...prev, key]));
    await new Promise((resolve) => setTimeout(resolve, 280));
    removeFromCart(key);
    setRemovingItems((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  async function handleCheckout() {
    setCheckoutError('');

    if (!cartItems.length) {
      setCheckoutError('Your cart is empty. Add a product before checkout.');
      return;
    }

    try {
      setIsCheckingOut(true);
      const payload = await createCheckoutSession(cartItems as CartItem[]);

      if (!payload.url) {
        throw new Error('Checkout session did not return a redirect URL.');
      }

      window.location.assign(payload.url);
      return;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout failed.');
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <section className="section page-header-offset cart-shell-premium">
      {/* Header */}
      <div className="container section-header narrow anim-rise-sm">
        <p className="eyebrow">Shopping Bag</p>
        <h1>Your Sattari Selection</h1>
        <p>Premium drum gear curated just for you. Review, adjust, and checkout securely.</p>
        <div className="cart-header-chips" aria-label="Checkout highlights">
          {orderHighlights.map((highlight) => (
            <span className="trust-chip" key={highlight}>
              {highlight}
            </span>
          ))}
        </div>
      </div>

      <div className="container cart-layout-premium">
        {/* Main Cart Items */}
        <div className="cart-items-section-premium">
          {!cartItems.length ? (
            <div className="empty-cart-premium anim-rise">
              <div className="empty-illustration">
                <div className="drum-icon">🥁</div>
              </div>
              <h2>Your bag is empty</h2>
              <p>Discover our curated collection of premium drum gear</p>
              <Link to="/shop" className="button button-solid">
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="cart-items-list-premium">
              {cartItems.map((item: CartItem, index: number) => (
                <div
                  key={item.key}
                  className={`cart-line-item-premium anim-item ${removingItems.has(item.key) ? 'removing' : ''}`}
                  style={{ animationDelay: `${Math.min(index * 55, 330)}ms` }}
                >
                  {/* Product Image */}
                  <Link
                    to={`/product/${item.product.slug}`}
                    className="cart-item-image-container cart-line-item-image-link"
                    aria-label={`View ${item.product.name}`}
                  >
                    {item.product.image ? (
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="cart-line-item-image"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="cart-item-placeholder">📦</div>
                    )}
                  </Link>

                  {/* Product Details */}
                  <div className="cart-item-details">
                    <Link
                      to={`/product/${item.product.slug}`}
                      className="cart-item-product-name cart-item-product-link"
                    >
                      {item.product.name}
                    </Link>
                    {item.size && (
                      <p className="cart-item-product-size">
                        Size: <strong>{item.size}</strong>
                      </p>
                    )}
                    <p className="cart-item-unit-price">${item.unitPrice.toFixed(2)} each</p>
                  </div>

                  {/* Quantity Control */}
                  <div className="cart-quantity-control">
                    <div className="qty-adjuster">
                      <button
                        onClick={() => updateQuantity(item.key, Math.max(1, item.quantity - 1))}
                        className="qty-adjust-btn"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        className="qty-input"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.key, e.target.value)}
                        aria-label={`Quantity for ${item.product.name}`}
                      />
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="qty-adjust-btn"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Line Total */}
                  <div className="cart-line-total">
                    <p className="total-price">${item.lineTotal.toFixed(2)}</p>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemove(item.key)}
                    className="cart-remove-btn"
                    aria-label={`Remove ${item.product.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Clear Cart Button */}
              {cartItems.length > 0 && (
                <button onClick={clearCart} className="clear-cart-link">
                  ← Clear entire bag
                </button>
              )}
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        {cartItems.length > 0 && (
          <aside className="order-summary-premium anim-rise">
            <p className="card-kicker">Checkout summary</p>
            <h2 className="summary-title">Order Summary</h2>
            <p className="summary-helper-copy">
              Finalize your curated setup with secure checkout and quick confirmation.
            </p>

            {/* Summary Details */}
            <div className="summary-details">
              <div className="summary-line">
                <span className="summary-label">Subtotal</span>
                <span className="summary-value">${subtotal.toFixed(2)}</span>
              </div>

              <div className="summary-line">
                <span className="summary-label">Shipping</span>
                <span className="summary-value">${shipping.toFixed(2)}</span>
              </div>

              <div className="summary-divider"></div>

              <div className="summary-line total">
                <span className="summary-label">Total</span>
                <span className="summary-total">${orderTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Error Message */}
            {checkoutError && (
              <div className="error-message-premium anim-rise-sm" role="alert">
                <span className="error-icon">⚠</span>
                <p>{checkoutError}</p>
              </div>
            )}

            {/* Checkout Button */}
            <button onClick={handleCheckout} disabled={isCheckingOut} className="checkout-btn-full">
              <span>
                {isCheckingOut ? 'Processing Secure Checkout...' : 'Proceed to Secure Checkout'}
              </span>
              {!isCheckingOut && <span className="checkout-icon">→</span>}
            </button>

            <div className="summary-note-card">
              <strong>Need a second look before paying?</strong>
              <p>Update quantities on the left and your total refreshes instantly.</p>
              <Link to="/shop" className="summary-note-link">
                Keep shopping
              </Link>
            </div>

            {/* Security Info */}
            <div className="security-info">
              <p>🔒 Secure payment with Stripe</p>
              <p>✓ SSL encrypted • ✓ 100% secure • ✓ No account required</p>
            </div>
          </aside>
        )}
      </div>
    </section>
  );
};

export default CartPage;
