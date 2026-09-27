import { useCallback, useEffect, useRef, useState } from 'react';
import { useCart } from '../context/CartContext';
import { createCheckoutSession, redirectToCheckoutUrl } from '../utils/checkout';

// The Stripe session this browser last sent the shopper to. Coming back without
// paying (Back, the cancel link, or retrying from another tab) leaves that
// session holding the cart's stock until it times out, so the next checkout
// names it and the server moves its units to the new checkout instead of
// refusing the shopper's own reservation. The server never releases stock from
// a session that was paid, so a stale id here is harmless.
const LAST_SESSION_KEY = 'sattari-checkout-session-v1';

function rememberedSession() {
  try {
    return localStorage.getItem(LAST_SESSION_KEY);
  } catch {
    return null;
  }
}

function rememberSession(sessionId) {
  try {
    localStorage.setItem(LAST_SESSION_KEY, sessionId);
  } catch {
    // Without storage the old hold simply lapses when its session times out.
  }
}

// A completed session has nothing left to replace.
export function forgetCheckoutSession(sessionId) {
  try {
    if (sessionId && localStorage.getItem(LAST_SESSION_KEY) === sessionId) {
      localStorage.removeItem(LAST_SESSION_KEY);
    }
  } catch {
    // Nothing was remembered.
  }
}

function releaseEndpoint() {
  const base = import.meta.env.VITE_API_URL;
  return base ? `${base.replace(/\/$/, '')}/api/checkout-release` : '/api/checkout-release';
}

// Puts the stock an abandoned checkout was holding back on sale. Best effort:
// if this never arrives, the hold lapses when the session times out.
export function releaseCheckoutSession(sessionId) {
  return fetch(releaseEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
    keepalive: true,
  }).catch(() => null);
}

// The one way to start a Stripe checkout, shared by the cart drawer and the
// cart page. Each call to startCheckout creates a Stripe session, so a second
// click while one is being created must not start another.
export function useCheckout() {
  const { cartItems, catalogStatus, unavailableCount, refreshCatalog } = useCart();
  const inFlight = useRef(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Pressing Back on Stripe's page can restore this page from the back/forward
  // cache mid-"processing"; reset so the customer can check out again.
  useEffect(() => {
    const handlePageShow = (event) => {
      if (!event.persisted) return;
      inFlight.current = false;
      setIsCheckingOut(false);
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const startCheckout = useCallback(async () => {
    if (inFlight.current) return;
    setCheckoutError('');

    // Checking out now would silently leave these entries out of the order.
    if (unavailableCount > 0) {
      setCheckoutError(
        catalogStatus === 'loading'
          ? 'Still loading some items in your cart. Try again in a moment.'
          : 'Some items in your cart could not be loaded right now. Try again in a moment.'
      );
      return;
    }

    if (!cartItems.length) {
      setCheckoutError('Your cart is empty. Add a product before checkout.');
      return;
    }

    inFlight.current = true;
    setIsCheckingOut(true);

    try {
      const session = await createCheckoutSession(cartItems, {
        replacesSessionId: rememberedSession(),
      });
      if (!session?.url) {
        throw new Error('Checkout session did not return a redirect URL.');
      }
      if (typeof session.id === 'string') rememberSession(session.id);
      // Stays in flight while the browser leaves for Stripe: re-enabling the
      // button here is exactly what allowed a second session.
      redirectToCheckoutUrl(session.url);
    } catch (error) {
      inFlight.current = false;
      setIsCheckingOut(false);
      setCheckoutError(error instanceof Error ? error.message : 'Checkout failed.');
      // The server rejected the cart as it stands (a product was hidden, or
      // stock changed). Reload the catalog so the cart catches up and says what
      // changed.
      if (error?.status === 400 || error?.status === 409) refreshCatalog();
    }
  }, [cartItems, catalogStatus, unavailableCount, refreshCatalog]);

  return { startCheckout, isCheckingOut, checkoutError };
}
