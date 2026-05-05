import { createCheckoutSession } from './checkout';

export async function redirectToCheckout({ cartItems }) {
  const session = await createCheckoutSession(cartItems);

  if (!session?.url) {
    throw new Error('Checkout session did not return a redirect URL.');
  }

  window.location.assign(session.url);
}
