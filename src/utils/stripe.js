import React from 'react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export async function redirectToCheckout({ cartItems }) {
  const stripe = await stripePromise;
  // Call backend to create a Stripe Checkout session
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartItems }),
  });
  const session = await response.json();
  // Redirect to Stripe Checkout
  const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
  if (error) {
    alert(error.message);
  }
}
