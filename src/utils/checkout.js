function normalizeCheckoutItems(cartItems = []) {
  return cartItems.map((item) => ({
    slug: item.slug,
    size: item.size ?? null,
    color: item.color ?? null,
    quantity: item.quantity,
  }));
}

function buildApiUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export function getCheckoutEndpoint() {
  if (import.meta.env.VITE_CHECKOUT_URL) {
    return import.meta.env.VITE_CHECKOUT_URL;
  }

  if (import.meta.env.VITE_API_URL) {
    return buildApiUrl(import.meta.env.VITE_API_URL, '/api/create-checkout-session');
  }

  return '/api/create-checkout-session';
}

export function getCheckoutStatusEndpoint() {
  if (import.meta.env.VITE_CHECKOUT_STATUS_URL) {
    return import.meta.env.VITE_CHECKOUT_STATUS_URL;
  }

  if (import.meta.env.VITE_API_URL) {
    return buildApiUrl(import.meta.env.VITE_API_URL, '/api/checkout-session-status');
  }

  return '/api/checkout-session-status';
}

const FALLBACK_MESSAGES = {
  409: 'Something in your cart just changed or sold out. Please review your cart and try again.',
  503: 'Checkout is temporarily unavailable. Please try again in a few minutes.',
};

// The server names the slug for its logs ("Unknown product slug: x"), which
// is what a customer sees when a product was hidden after they added it.
const UNAVAILABLE_PRODUCT = /^(Unknown product slug|Price not configured)/;

function checkoutErrorMessage(status, serverMessage) {
  if (serverMessage && UNAVAILABLE_PRODUCT.test(serverMessage)) {
    return 'An item in your cart is no longer available. Please review your cart and try again.';
  }
  return serverMessage || FALLBACK_MESSAGES[status] || 'Unable to create checkout session.';
}

// `replacesSessionId` names an earlier session the shopper abandoned, so the
// server can move that session's stock hold to this checkout.
export async function createCheckoutSession(cartItems = [], { replacesSessionId } = {}) {
  let response;
  try {
    response = await fetch(getCheckoutEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: normalizeCheckoutItems(cartItems),
        ...(replacesSessionId ? { replacesSessionId } : {}),
      }),
    });
  } catch {
    throw new Error('We could not reach checkout. Check your connection and try again.');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(checkoutErrorMessage(response.status, errorBody.error));
    // Callers use the status to tell "the cart is out of date" (409) apart
    // from "checkout is down" (503).
    error.status = response.status;
    error.code = errorBody.code || null;
    throw error;
  }

  return response.json();
}

// Kept separate so tests can observe the hand-off to Stripe.
export function redirectToCheckoutUrl(url) {
  window.location.assign(url);
}

export async function fetchCheckoutSessionStatus(sessionId) {
  const response = await fetch(
    `${getCheckoutStatusEndpoint()}?session_id=${encodeURIComponent(sessionId)}`
  );

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Unable to verify checkout session.');
  }

  return response.json();
}
