import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@context/CartContext';
import type { CartContextValue, CartItem } from '@/types';
import { FLAT_SHIPPING_CENTS } from '@data/shipping';
import CartNotice from './CartNotice';
import QuantityInput from './QuantityInput';
import { MAX_LINE_QUANTITY } from '@utils/cartCatalog';
import { useCheckout } from '../hooks/useCheckout';
import '@/styles-cart-premium.css';

// A line whose product comes in colors but has none chosen (see cartCatalog.js).
type CartLine = CartItem & { needsColor?: boolean };
type CartState = Omit<CartContextValue, 'cartItems'> & { cartItems: CartLine[] };
interface CheckoutState {
  startCheckout: () => Promise<void>;
  isCheckingOut: boolean;
  checkoutError: string;
  checkoutProduct: { slug: string; name: string | null; label: string } | null;
}

interface CartSidebarProps {
  onNavigate?: () => void;
}

const CartSidebar: FC<CartSidebarProps> = ({ onNavigate }) => {
  const { cartItems, itemCount, subtotal, updateQuantity, removeFromCart, clearCart } =
    useCart() as CartState;
  const { startCheckout, isCheckingOut, checkoutError, checkoutProduct } =
    useCheckout() as CheckoutState;
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const shipping = cartItems.length ? FLAT_SHIPPING_CENTS / 100 : 0;

  const handleRemove = async (key: string) => {
    setIsRemoving(key);
    await new Promise((resolve) => setTimeout(resolve, 280));
    removeFromCart(key);
    setIsRemoving(null);
  };

  return (
    <aside className="cart-sidebar-premium">
      {/* Header */}
      <div className="cart-header-premium">
        <h2 className="cart-title">Shopping Bag</h2>
        <span className="cart-badge-premium">{itemCount}</span>
      </div>

      <CartNotice />

      {/* Items List */}
      <div className="cart-items-container-premium">
        {cartItems.length === 0 ? (
          <div className="cart-empty-premium anim-rise">
            <div className="empty-icon">🥁</div>
            <p>Your cart is empty</p>
            <small>Add some premium gear to get started</small>
            <Link to="/shop" className="cart-empty-link" onClick={onNavigate}>
              Browse shop
            </Link>
          </div>
        ) : (
          <ul className="cart-list-premium">
            {cartItems.map((item: CartLine, index: number) => (
              <li
                key={item.key}
                className={`cart-item-premium anim-item ${isRemoving === item.key ? 'removing' : ''}`}
                style={{ animationDelay: `${Math.min(index * 55, 330)}ms` }}
              >
                {/* Item Image */}
                <Link
                  to={`/product/${item.product.slug}`}
                  className="cart-item-image-wrapper cart-item-image-link"
                  onClick={onNavigate}
                  aria-label={`View ${item.product.name}`}
                >
                  {item.product.image ? (
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="cart-item-image-premium"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="cart-item-image-placeholder">📦</div>
                  )}
                </Link>

                {/* Item Info */}
                <div className="cart-item-info-premium">
                  <Link
                    to={`/product/${item.product.slug}`}
                    className="cart-item-name cart-item-name-link"
                    onClick={onNavigate}
                  >
                    {item.product.name}
                  </Link>
                  {item.size && <p className="cart-item-size">{item.size}</p>}
                  {item.color && <p className="cart-item-size">{item.color}</p>}
                  {item.needsColor && (
                    <p className="cart-item-size cart-item-needs-color">
                      <Link
                        to={`/product/${item.product.slug}`}
                        onClick={onNavigate}
                        aria-label={`Choose a color for ${item.product.name}`}
                      >
                        Choose a color
                      </Link>
                    </p>
                  )}
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
                    <QuantityInput
                      value={item.quantity}
                      onCommit={(quantity: number) => updateQuantity(item.key, quantity)}
                      className="qty-input"
                      aria-label={`Quantity for ${item.product.name}`}
                    />
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      className="qty-btn"
                      aria-label="Increase quantity"
                      disabled={item.quantity >= MAX_LINE_QUANTITY}
                    >
                      +
                    </button>
                  </div>
                  {/* Checkout refuses more (409 quantity_limit). */}
                  {item.quantity >= MAX_LINE_QUANTITY && (
                    <p className="cart-quantity-limit">Limit {MAX_LINE_QUANTITY} per order</p>
                  )}
                  <p className="cart-item-total">${item.lineTotal.toFixed(2)}</p>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemove(item.key)}
                  className="cart-item-remove-premium"
                  aria-label={`Remove ${item.product.name} from cart`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary */}
      {cartItems.length > 0 && (
        <div className="cart-summary-premium anim-rise">
          <div className="summary-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>${shipping.toFixed(2)}</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-row total">
            <span>Total</span>
            <span className="total-amount">${(subtotal + shipping).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      {cartItems.length > 0 && (
        <div className="cart-actions-premium anim-rise">
          <Link to="/cart" className="cart-view-link-premium" onClick={onNavigate}>
            View full cart
          </Link>
          {checkoutError && (
            <div className="cart-checkout-error" role="alert">
              {checkoutError}
              {checkoutProduct && (
                <>
                  {' '}
                  <Link
                    to={`/product/${checkoutProduct.slug}`}
                    className="checkout-error-link"
                    onClick={onNavigate}
                    aria-label={
                      checkoutProduct.name
                        ? `${checkoutProduct.label} for ${checkoutProduct.name}`
                        : undefined
                    }
                  >
                    {checkoutProduct.label}
                  </Link>
                </>
              )}
            </div>
          )}
          <button onClick={startCheckout} disabled={isCheckingOut} className="checkout-btn-premium">
            <span>{isCheckingOut ? 'Processing...' : 'Proceed to Checkout'}</span>
            {!isCheckingOut && <span className="checkout-arrow">→</span>}
          </button>
          <button onClick={clearCart} className="clear-cart-btn-premium">
            Clear Bag
          </button>
        </div>
      )}
    </aside>
  );
};

export default CartSidebar;
