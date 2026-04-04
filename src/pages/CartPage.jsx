import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { formatPrice } from '../data/catalog';
import { useCart } from '../context/CartContext';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export default function CartPage() {
  const { cartItems, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();
  const [checkoutError, setCheckoutError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const shipping = useMemo(() => (cartItems.length ? 7.95 : 0), [cartItems.length]);
  const orderTotal = subtotal + shipping;

  async function handleCheckout() {
    setCheckoutError('');

    if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
      setCheckoutError('Add VITE_STRIPE_PUBLISHABLE_KEY to your .env file to enable checkout.');
      return;
    }

    if (!cartItems.length) {
      setCheckoutError('Your cart is empty. Add a product before checkout.');
      return;
    }

    try {
      setIsCheckingOut(true);

      const response = await fetch(
        `${import.meta.env.VITE_STRIPE_API_URL || 'http://localhost:4242'}/api/create-checkout-session`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cartItems.map((item) => ({
              slug: item.slug,
              size: item.size,
              quantity: item.quantity,
            })),
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Unable to create Stripe checkout session.');
      }

      const payload = await response.json();

      if (payload.url) {
        window.location.assign(payload.url);
        return;
      }

      const stripe = await stripePromise;
      if (!stripe || !payload.id) {
        throw new Error('Stripe did not initialize correctly.');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId: payload.id });
      if (error) {
        throw new Error(error.message || 'Stripe redirect failed.');
      }
    } catch (error) {
      setCheckoutError(error.message || 'Checkout failed.');
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <section className="section page-header-offset">
      <div className="container section-header narrow">
        <p className="eyebrow">Cart</p>
        <h1>Your drum cart</h1>
        <p>Review quantities, remove items, and checkout securely with Stripe.</p>
      </div>

      <div className="container cart-layout">
        <div className="info-card" style={{ padding: '1.2rem' }}>
          {!cartItems.length ? (
            <div>
              <p>Your cart is empty.</p>
              <Link className="button button-outline" to="/shop">
                Continue Shopping
              </Link>
            </div>
          ) : (
            <>
              {cartItems.map((item) => (
                <div key={item.key} className="cart-line-item">
                  <img src={item.product.image} alt={item.product.name} className="cart-item-image" />
                  <div>
                    <p className="product-name" style={{ margin: 0 }}>{item.product.name}</p>
                    <p className="product-price" style={{ margin: '0.25rem 0' }}>
                      {item.size ? `Size: ${item.size} • ` : ''}
                      {formatPrice(item.unitPrice)} each
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className="cart-qty-input"
                    value={item.quantity}
                    onChange={(event) => updateQuantity(item.key, event.target.value)}
                    aria-label={`Quantity for ${item.product.name}`}
                  />
                  <p style={{ margin: 0, fontWeight: 600 }}>{formatPrice(item.lineTotal)}</p>
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => removeFromCart(item.key)}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button type="button" className="button button-outline" onClick={clearCart}>
                Clear Cart
              </button>
            </>
          )}
        </div>

        <aside className="info-card" style={{ padding: '1.2rem', height: 'fit-content' }}>
          <h3 style={{ marginTop: 0 }}>Order Summary</h3>
          <p className="product-price" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </p>
          <p className="product-price" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Shipping</span>
            <span>{formatPrice(shipping)}</span>
          </p>
          <p style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total</span>
            <span>{formatPrice(orderTotal)}</span>
          </p>
          <button
            type="button"
            className="button button-solid button-full"
            disabled={!cartItems.length || isCheckingOut}
            onClick={handleCheckout}
            style={{ opacity: !cartItems.length || isCheckingOut ? 0.65 : 1 }}
          >
            {isCheckingOut ? 'Redirecting...' : 'Checkout with Stripe'}
          </button>
          {checkoutError ? <p style={{ color: '#ff9f9f' }}>{checkoutError}</p> : null}
        </aside>
      </div>
    </section>
  );
}
