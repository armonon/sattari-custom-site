import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useCart } from '../context/CartContext';

export default function CheckoutStatus() {
  const location = useLocation();
  const isSuccess = location.pathname.includes('/checkout/success');
  const { clearCart } = useCart();

  useEffect(() => {
    if (isSuccess) {
      clearCart();
    }
  }, [isSuccess, clearCart]);

  return (
    <section className="section page-header-offset">
      <div className="container section-header narrow">
        <p className="eyebrow">Checkout</p>
        <h1>{isSuccess ? 'Payment complete' : 'Checkout canceled'}</h1>
        <p>
          {isSuccess
            ? 'Thank you for your order. Stripe confirmed your payment.'
            : 'No worries. Your cart is still saved and ready when you are.'}
        </p>
        <div className="hero-actions">
          <Link to="/shop" className="button button-outline">
            Continue Shopping
          </Link>
          <Link to="/cart" className="button button-solid">
            Back to Cart
          </Link>
        </div>
      </div>
    </section>
  );
}
