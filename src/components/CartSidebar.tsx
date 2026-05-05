import { FC, useState } from 'react';
import { useCart } from '@context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import type { CartContextValue, CartItem } from '@/types';

interface CartSidebarProps {
  onCheckout: () => Promise<void>;
}

const CartSidebar: FC<CartSidebarProps> = ({ onCheckout }) => {
  const { cartItems, itemCount, subtotal, updateQuantity, removeFromCart, clearCart } =
    useCart() as CartContextValue;
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleRemove = async (key: string) => {
    setIsRemoving(key);
    await new Promise((resolve) => setTimeout(resolve, 300));
    removeFromCart(key);
    setIsRemoving(null);
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    await onCheckout();
    setIsCheckingOut(false);
  };

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
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
  };

  return (
    <aside className="cart-sidebar-premium">
      {/* Header */}
      <div className="cart-header-premium">
        <h2 className="cart-title">Shopping Bag</h2>
        <span className="cart-badge-premium">{itemCount}</span>
      </div>

      {/* Items List */}
      <div className="cart-items-container-premium">
        {cartItems.length === 0 ? (
          <motion.div
            className="cart-empty-premium"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="empty-icon">🥁</div>
            <p>Your cart is empty</p>
            <small>Add some premium gear to get started</small>
          </motion.div>
        ) : (
          <motion.ul
            className="cart-list-premium"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {cartItems.map((item: CartItem) => (
                <motion.li
                  key={item.key}
                  className={`cart-item-premium ${isRemoving === item.key ? 'removing' : ''}`}
                  variants={itemVariants}
                  exit="exit"
                  layout
                >
                  {/* Item Image */}
                  <div className="cart-item-image-wrapper">
                    {item.product.image ? (
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        className="cart-item-image-premium"
                      />
                    ) : (
                      <div className="cart-item-image-placeholder">📦</div>
                    )}
                  </div>

                  {/* Item Info */}
                  <div className="cart-item-info-premium">
                    <p className="cart-item-name">{item.product.name}</p>
                    {item.size && <p className="cart-item-size">{item.size}</p>}
                    <p className="cart-item-price">${item.unitPrice.toFixed(2)}</p>
                  </div>

                  {/* Item Controls */}
                  <div className="cart-item-controls-premium">
                    <div className="quantity-adjuster">
                      <button
                        onClick={() => updateQuantity(item.key, Math.max(1, item.quantity - 1))}
                        className="qty-btn"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.key, e.target.value)}
                        className="qty-input"
                        aria-label={`Quantity for ${item.product.name}`}
                      />
                      <button
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="qty-btn"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <p className="cart-item-total">${item.lineTotal.toFixed(2)}</p>
                  </div>

                  {/* Remove Button */}
                  <motion.button
                    onClick={() => handleRemove(item.key)}
                    className="cart-item-remove-premium"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    aria-label={`Remove ${item.product.name} from cart`}
                  >
                    ✕
                  </motion.button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      {/* Summary */}
      {cartItems.length > 0 && (
        <motion.div
          className="cart-summary-premium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="summary-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-row total">
            <span>Total</span>
            <span className="total-amount">${subtotal.toFixed(2)}</span>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      {cartItems.length > 0 && (
        <motion.div
          className="cart-actions-premium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="checkout-btn-premium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span>{isCheckingOut ? 'Processing...' : 'Proceed to Checkout'}</span>
            {!isCheckingOut && <span className="checkout-arrow">→</span>}
          </motion.button>
          <motion.button
            onClick={clearCart}
            className="clear-cart-btn-premium"
            whileHover={{ opacity: 0.8 }}
            whileTap={{ scale: 0.95 }}
          >
            Clear Bag
          </motion.button>
        </motion.div>
      )}
    </aside>
  );
};

export default CartSidebar;
