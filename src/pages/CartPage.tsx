import { useMemo, useState, FC } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
    await new Promise((resolve) => setTimeout(resolve, 300));
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  return (
    <section className="section page-header-offset cart-shell-premium">
      {/* Header */}
      <motion.div
        className="container section-header narrow"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
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
      </motion.div>

      <div className="container cart-layout-premium">
        {/* Main Cart Items */}
        <motion.div
          className="cart-items-section-premium"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {!cartItems.length ? (
            <motion.div className="empty-cart-premium" variants={itemVariants}>
              <div className="empty-illustration">
                <div className="drum-icon">🥁</div>
              </div>
              <h2>Your bag is empty</h2>
              <p>Discover our curated collection of premium drum gear</p>
              <Link to="/shop" className="button button-solid">
                Start Shopping
              </Link>
            </motion.div>
          ) : (
            <motion.div className="cart-items-list-premium">
              <AnimatePresence mode="popLayout">
                {cartItems.map((item: CartItem) => (
                  <motion.div
                    key={item.key}
                    className={`cart-line-item-premium ${removingItems.has(item.key) ? 'removing' : ''}`}
                    variants={itemVariants}
                    exit="exit"
                    layout
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
                    <motion.button
                      onClick={() => handleRemove(item.key)}
                      className="cart-remove-btn"
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={`Remove ${item.product.name}`}
                    >
                      ✕
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Clear Cart Button */}
              {cartItems.length > 0 && (
                <motion.button
                  onClick={clearCart}
                  className="clear-cart-link"
                  whileHover={{ x: -4 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ← Clear entire bag
                </motion.button>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Order Summary Sidebar */}
        {cartItems.length > 0 && (
          <motion.aside
            className="order-summary-premium"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <p className="card-kicker">Checkout summary</p>
            <h2 className="summary-title">Order Summary</h2>
            <p className="summary-helper-copy">
              Finalize your curated setup with secure checkout and quick confirmation.
            </p>

            {/* Summary Details */}
            <motion.div
              className="summary-details"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div className="summary-line" variants={itemVariants}>
                <span className="summary-label">Subtotal</span>
                <span className="summary-value">${subtotal.toFixed(2)}</span>
              </motion.div>

              <motion.div className="summary-line" variants={itemVariants}>
                <span className="summary-label">Shipping</span>
                <span className="summary-value">${shipping.toFixed(2)}</span>
              </motion.div>

              {/* Tax (optional) */}
              <motion.div className="summary-divider" variants={itemVariants}></motion.div>

              <motion.div className="summary-line total" variants={itemVariants}>
                <span className="summary-label">Total</span>
                <span className="summary-total">${orderTotal.toFixed(2)}</span>
              </motion.div>
            </motion.div>

            {/* Error Message */}
            <AnimatePresence>
              {checkoutError && (
                <motion.div
                  className="error-message-premium"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <span className="error-icon">⚠</span>
                  <p>{checkoutError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Checkout Button */}
            <motion.button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="checkout-btn-full"
              whileHover={!isCheckingOut ? { scale: 1.02 } : {}}
              whileTap={!isCheckingOut ? { scale: 0.98 } : {}}
            >
              <span>
                {isCheckingOut ? 'Processing Secure Checkout...' : 'Proceed to Secure Checkout'}
              </span>
              {!isCheckingOut && <span className="checkout-icon">→</span>}
            </motion.button>

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
          </motion.aside>
        )}
      </div>
    </section>
  );
};

export default CartPage;
