function normalizeCheckoutItems(cartItems = []) {
  return cartItems.map((item) => ({
    slug: item.slug,
    size: item.size ?? null,
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

export async function createCheckoutSession(cartItems = []) {
  const response = await fetch(getCheckoutEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: normalizeCheckoutItems(cartItems) }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Unable to create checkout session.');
  }

  return response.json();
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
