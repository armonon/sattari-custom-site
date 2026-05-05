import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { fetchCheckoutSessionStatus } from '../utils/checkout';
import '../styles-cart-page-premium.css';

export default function CheckoutStatus() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isSuccess = location.pathname.includes('/checkout/success');
  const { clearCart } = useCart();
  const sessionId = searchParams.get('session_id');
  const [verificationState, setVerificationState] = useState(isSuccess ? 'loading' : 'canceled');
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [verificationError, setVerificationError] = useState('');

  useEffect(() => {
    if (!isSuccess) {
      setVerificationState('canceled');
      return;
    }

    if (!sessionId) {
      setVerificationState('unverified');
      return;
    }

    let isActive = true;

    async function verifySession() {
      try {
        setVerificationState('loading');
        setVerificationError('');

        const session = await fetchCheckoutSessionStatus(sessionId);
        if (!isActive) {
          return;
        }

        setCheckoutSession(session);

        if (session.payment_status === 'paid') {
          clearCart();
          setVerificationState('verified');
          return;
        }

        setVerificationState('pending');
      } catch (error) {
        if (!isActive) {
          return;
        }

        setVerificationError(
          error instanceof Error ? error.message : 'Unable to verify checkout status.'
        );
        setVerificationState('error');
      }
    }

    verifySession();

    return () => {
      isActive = false;
    };
  }, [clearCart, isSuccess, sessionId]);

  const statusContent = useMemo(() => {
    if (!isSuccess) {
      return {
        heading: 'Checkout canceled',
        message: 'No worries. Your cart is still saved and ready when you are.',
      };
    }

    if (verificationState === 'loading') {
      return {
        heading: 'Verifying payment',
        message: 'We are confirming your Stripe payment before we mark the order complete.',
      };
    }

    if (verificationState === 'verified') {
      return {
        heading: 'Payment verified',
        message:
          'Your Stripe payment was confirmed successfully and your order is ready for fulfillment.',
      };
    }

    if (verificationState === 'pending') {
      return {
        heading: 'Payment still processing',
        message:
          'Stripe has not marked this checkout session as paid yet. Please refresh in a moment or check your email.',
      };
    }

    if (verificationState === 'unverified') {
      return {
        heading: 'Payment confirmation unavailable',
        message:
          'We could not verify this order because the checkout session ID was missing from the return URL.',
      };
    }

    return {
      heading: 'Unable to verify payment',
      message: verificationError || 'We could not verify this checkout session right now.',
    };
  }, [isSuccess, verificationError, verificationState]);

  const formattedTotal = useMemo(() => {
    if (typeof checkoutSession?.amount_total !== 'number') {
      return null;
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (checkoutSession.currency || 'usd').toUpperCase(),
    }).format(checkoutSession.amount_total / 100);
  }, [checkoutSession]);

  const statusToneClass = useMemo(() => {
    if (verificationState === 'verified') return 'checkout-status-card success';
    if (verificationState === 'pending' || verificationState === 'loading') {
      return 'checkout-status-card pending';
    }

    if (!isSuccess) return 'checkout-status-card neutral';

    return 'checkout-status-card warning';
  }, [isSuccess, verificationState]);

  return (
    <section className="section page-header-offset checkout-status-shell">
      <div className="container section-header narrow checkout-status-header">
        <p className="eyebrow">Checkout</p>
        <h1>{statusContent.heading}</h1>
        <p>{statusContent.message}</p>
        <div className="checkout-status-pill-row" aria-label="Checkout flow notes">
          <span className="trust-chip">Server-verified payment state</span>
          <span className="trust-chip">Stripe-hosted checkout</span>
          <span className="trust-chip">Secure order recording</span>
        </div>
      </div>

      <div className="container checkout-status-layout">
        <div className={statusToneClass}>
          <p className="card-kicker">Purchase status</p>
          <h2>{statusContent.heading}</h2>
          <p>{statusContent.message}</p>

          <div className="checkout-status-meta">
            <div>
              <strong>Current state</strong>
              <span>{checkoutSession?.payment_status || verificationState}</span>
            </div>
            <div>
              <strong>Session ID</strong>
              <span>{sessionId || 'Unavailable'}</span>
            </div>
          </div>
        </div>

        {checkoutSession && (
          <div className="info-card checkout-session-card">
            <p className="card-kicker">Verified session details</p>
            <p>
              <strong>Checkout session:</strong> {checkoutSession.id}
            </p>
            {checkoutSession.customer_email && (
              <p>
                <strong>Email:</strong> {checkoutSession.customer_email}
              </p>
            )}
            {formattedTotal && (
              <p>
                <strong>Total paid:</strong> {formattedTotal}
              </p>
            )}
            <p>
              <strong>Stripe status:</strong>{' '}
              {checkoutSession.payment_status || checkoutSession.status}
            </p>
          </div>
        )}

        <div className="hero-actions checkout-status-actions">
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
