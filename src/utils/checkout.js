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
  429: 'There are already several checkouts open from your connection. Please finish or close one of them, or try again later.',
  503: 'Checkout is temporarily unavailable. Please try again in a few minutes.',
};

// Codes create-checkout-session answers with. The server's `error` text is
// written for the shopper; these messages stand in when a response has none.
export const COLOR_REQUIRED = 'color_required'; // 409, with `slug`/`slugs`
export const QUANTITY_LIMIT = 'quantity_limit'; // 409, with `limit` (and `slugs`)
export const HOLD_LIMIT = 'hold_limit'; // 429: too many open checkouts
const PRODUCT_UNAVAILABLE = 'product_unavailable'; // 409, with `slug`/`slugs`

const CODE_MESSAGES = {
  [COLOR_REQUIRED]: 'Choose a color for an item in your cart before checking out.',
  [HOLD_LIMIT]: FALLBACK_MESSAGES[429],
};

// The server names the slug for its logs ("Unknown product slug: x"), which
// is what a customer sees when a product was hidden after they added it.
const UNAVAILABLE_PRODUCT = /^(Unknown product slug|Price not configured)/;

function checkoutErrorMessage(status, serverMessage, code) {
  if (serverMessage && UNAVAILABLE_PRODUCT.test(serverMessage)) {
    return 'An item in your cart is no longer available. Please review your cart and try again.';
  }
  return (
    serverMessage ||
    CODE_MESSAGES[code] ||
    FALLBACK_MESSAGES[status] ||
    'Unable to create checkout session.'
  );
}

/**
 * The product page a refused checkout sends the shopper to, or null. Only
 * where that page is the fix: choosing a color. A product that is gone
 * (product_unavailable) drops out of the cart once the catalog reloads, and a
 * quantity over the limit is lowered in the cart itself.
 */
export function productToFix(error) {
  if (!error?.slug || [PRODUCT_UNAVAILABLE, QUANTITY_LIMIT].includes(error.code)) return null;
  return { slug: error.slug, code: error.code };
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
    const code = typeof errorBody?.code === 'string' ? errorBody.code : null;
    const slugs = Array.isArray(errorBody?.slugs)
      ? errorBody.slugs.filter((slug) => typeof slug === 'string')
      : [];
    const error = new Error(checkoutErrorMessage(response.status, errorBody?.error, code));
    // Callers use the status to tell "the cart is out of date" (409) apart
    // from "checkout is down" (503), and the code, slugs and limit to say
    // which items need attention (a color to choose, too many of one item).
    error.status = response.status;
    error.code = code;
    error.slug = typeof errorBody?.slug === 'string' ? errorBody.slug : slugs[0] || null;
    error.slugs = slugs.length ? slugs : error.slug ? [error.slug] : [];
    error.limit = Number.isInteger(errorBody?.limit) ? errorBody.limit : null;
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
