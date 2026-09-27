import process from 'node:process';
import Stripe from 'stripe';

// Created on first use rather than at import. The SDK throws on a missing key,
// which at import time crashes the function before it can answer with its own
// error — and stops `npm run dev:api` from starting at all.
let client = null;

export function getStripe() {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}
