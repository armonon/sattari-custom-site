import crypto from 'node:crypto';
import process from 'node:process';
import { products as baseProducts, resolveSelectedOption } from '../../src/data/catalog.js';
import { FLAT_SHIPPING_CENTS } from '../../src/data/shipping.js';
import { aggregateStockLines, describeVariant } from '../../src/utils/inventory.js';
import { mergeCatalog } from '../../src/utils/catalogMerge.js';
import {
  isStockContention,
  patchStockHold,
  releaseStockHold,
  reserveStock,
} from '../../server/stockStore.js';
import { readCatalogDoc } from '../../server/catalogStore.js';
import { retireCheckoutSession } from '../../server/checkoutOrders.js';
import { errorMessage, logError } from '../../server/log.js';
import { getStripe } from '../../server/stripeClient.js';

const SHIPPING_COUNTRIES = ['US', 'CA'];
const SESSION_ID = /^cs_[A-Za-z0-9_]{8,250}$/;

// Stripe's minimum session lifetime is 30 minutes. The extra minute keeps a
// slightly slow clock on either side from making Stripe reject the session.
const CHECKOUT_WINDOW_SECONDS = 31 * 60;

// A hold outlives its session briefly, so a payment completed in the last
// seconds still finds its units reserved when the webhook lands, and so the
// maintenance sweep (every 10 minutes) gets to ask Stripe about a session
// whose expiry event never arrived before the units are offered again.
const HOLD_GRACE_MS = 15 * 60 * 1000;

const UNAVAILABLE = 'Checkout is temporarily unavailable. Please try again in a few minutes.';

// Messages written for the customer. Anything else that goes wrong is logged
// and answered with a generic message instead of internal detail.
class CheckoutError extends Error {
  constructor(message, statusCode = 400, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function normalizeQuantity(quantity) {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.max(1, Math.min(99, Math.floor(value)));
}

function buildPublicImageUrl(clientUrl, imagePath) {
  if (!imagePath) return [];

  try {
    return [new URL(imagePath, clientUrl).toString()];
  } catch {
    return [];
  }
}

function getShippingOptions() {
  return [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: {
          amount: FLAT_SHIPPING_CENTS,
          currency: 'usd',
        },
        display_name: 'Standard shipping',
      },
    },
  ];
}

function describeShortfalls(shortfalls) {
  const soldOut = shortfalls.filter((entry) => entry.onHand === 0);
  if (soldOut.length) {
    return `${soldOut.map(describeVariant).join(', ')} just sold out. Please remove it from your cart.`;
  }

  const held = shortfalls.filter((entry) => entry.available === 0);
  if (held.length) {
    return `${held.map(describeVariant).join(', ')} is being checked out by another customer right now. Please try again in about 30 minutes, or remove it from your cart.`;
  }

  return `Not enough stock: ${shortfalls
    .map((entry) => `${describeVariant(entry)} — only ${entry.available} left`)
    .join(', ')}.`;
}

// Checks stock and reserves the cart's tracked units for the life of the
// checkout session in one conditional write, so two customers can never both
// pass the check for the same unit.
//
// Stock is enforced HERE, not in the UI. The storefront's "Out of stock" badge
// is a courtesy; anyone can POST straight to this endpoint, so this is the
// only check that actually prevents selling what we do not have.
//
// Fails OPEN if the stock store is unreachable: overselling one item during an
// outage is recoverable (the webhook flags it to the owner), refusing every
// order is lost revenue. It fails CLOSED under write contention, which means
// many checkouts at once — exactly when an unreserved sale is likely to clash.
async function reserveCart(event, { holdId, lines, checkoutExpiresAt, replaces }) {
  try {
    const { held, shortfalls } = await reserveStock(event, {
      holdId,
      lines,
      expiresAt: checkoutExpiresAt + HOLD_GRACE_MS,
      extra: { checkoutExpiresAt },
      replaces,
    });

    if (shortfalls.length) {
      throw new CheckoutError(describeShortfalls(shortfalls), 409, {
        code: 'out_of_stock',
        shortfalls: shortfalls.map(({ slug, name, size, color, requested, available }) => ({
          slug,
          name,
          size,
          color,
          requested,
          available,
        })),
      });
    }

    return held;
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    if (isStockContention(error)) {
      throw new CheckoutError('Checkout is busy right now. Please try again in a moment.', 503);
    }
    logError('checkout-stock-read-error', { message: errorMessage(error) });
    return false;
  }
}

function getClientUrl(event) {
  if (process.env.URL) return process.env.URL;
  if (process.env.DEPLOY_PRIME_URL) return process.env.DEPLOY_PRIME_URL;
  if (process.env.SITE_URL) return process.env.SITE_URL;

  const proto = event.headers['x-forwarded-proto'] || 'https';
  const host = event.headers.host;
  return `${proto}://${host}`;
}

function parseRequest(event) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    throw new CheckoutError('Invalid request.');
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) throw new CheckoutError('Cart is empty.');

  // Optional, and ignored rather than refused when malformed: a stale value
  // left in the browser must never stop a checkout.
  const replaces = body.replacesSessionId;
  return {
    items,
    replacesSessionId: typeof replaces === 'string' && SESSION_ID.test(replaces) ? replaces : null,
  };
}

// The checkout this browser started last, abandoned with Back or the cancel
// link. Until it times out, its hold stands between the shopper and the very
// units they are trying to buy again. Expired at Stripe here; its hold is
// released in the same write that reserves the new checkout. Never fatal: at
// worst the old hold lapses on its own, as it always did.
async function retirePreviousCheckout(sessionId) {
  if (!sessionId) return null;
  try {
    return await retireCheckoutSession(sessionId, { stripe: getStripe() });
  } catch (error) {
    logError('checkout-replace-error', { message: errorMessage(error) });
    return null;
  }
}

// Prices come from the merged catalog, never from the request body. An
// employee's edited price has to be the one Stripe charges, so the same merge
// the storefront displays is recomputed here on the server.
//
// Fails CLOSED: without the staff-edited layer, hidden and discontinued
// products would be sold at stale prices.
async function loadProducts(event) {
  try {
    return mergeCatalog(baseProducts, await readCatalogDoc(event));
  } catch (error) {
    logError('checkout-catalog-read-error', { message: errorMessage(error) });
    throw new CheckoutError(UNAVAILABLE, 503);
  }
}

function resolveItems(payloadItems, products) {
  if (payloadItems.some((item) => typeof item?.slug !== 'string' || !item.slug)) {
    throw new CheckoutError('Invalid request.');
  }

  // A removed, hidden, or unpriced product reads the same to a customer: it is
  // no longer for sale. The stable code and slugs let the cart drop exactly
  // those items instead of showing an error it cannot act on.
  const unavailable = [];
  const resolved = [];

  for (const item of payloadItems) {
    const product = products.find((entry) => entry.slug === item.slug);
    const { size, unitPrice } = resolveSelectedOption(product, item.size ?? null);
    if (!product || typeof unitPrice !== 'number') {
      if (!unavailable.includes(item.slug)) unavailable.push(item.slug);
      continue;
    }

    // Only accept a color that the product actually offers.
    const offeredColors = product.colors?.map((option) => option.name) ?? [];
    const color = offeredColors.includes(item.color) ? item.color : null;

    resolved.push({
      product,
      size,
      color,
      unitPrice,
      quantity: normalizeQuantity(item.quantity),
    });
  }

  if (unavailable.length) {
    throw new CheckoutError(
      unavailable.length === 1
        ? 'An item in your cart is no longer available. Please remove it and try again.'
        : 'Some items in your cart are no longer available. Please remove them and try again.',
      409,
      { code: 'product_unavailable', slug: unavailable[0], slugs: unavailable }
    );
  }

  return resolved;
}

function buildLineItems(resolvedItems, clientUrl) {
  return resolvedItems.map(({ product, size, color, unitPrice, quantity }) => {
    const variant = [size, color].filter(Boolean).join(', ');

    return {
      quantity,
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(unitPrice * 100),
        product_data: {
          name: variant ? `${product.name} (${variant})` : product.name,
          description: product.description?.slice(0, 500),
          images: buildPublicImageUrl(clientUrl, product.image),
          metadata: {
            slug: product.slug,
            size: size || 'default',
            color: color || 'default',
          },
        },
      },
    };
  });
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return json(500, { error: 'Missing STRIPE_SECRET_KEY.' });
  }

  let holdId = null;
  let held = false;

  try {
    const { items: payloadItems, replacesSessionId } = parseRequest(event);
    const clientUrl = getClientUrl(event);
    const resolvedItems = resolveItems(payloadItems, await loadProducts(event));
    const replaces = await retirePreviousCheckout(replacesSessionId);

    holdId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + CHECKOUT_WINDOW_SECONDS;
    held = await reserveCart(event, {
      holdId,
      replaces,
      checkoutExpiresAt: expiresAt * 1000,
      lines: aggregateStockLines(
        resolvedItems.map(({ product, size, color, quantity }) => ({
          slug: product.slug,
          name: product.name,
          size,
          color,
          quantity,
        }))
      ),
    });

    const session = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        submit_type: 'pay',
        line_items: buildLineItems(resolvedItems, clientUrl),
        phone_number_collection: { enabled: true },
        billing_address_collection: 'required',
        shipping_address_collection: {
          allowed_countries: SHIPPING_COUNTRIES,
        },
        shipping_options: getShippingOptions(),
        expires_at: expiresAt,
        metadata: { kind: 'shop_order', holdId },
        success_url: `${clientUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        // The cancel page hands the id to /api/checkout-release, so the units
        // go back on sale the moment the shopper leaves.
        cancel_url: `${clientUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
      },
      { idempotencyKey: `checkout-${holdId}` }
    );

    if (held) {
      // Lets the sweep ask Stripe about this session if its expiry event is
      // lost. Not fatal: without it the hold still lapses on its own.
      await patchStockHold(event, holdId, { sessionId: session.id }).catch((error) => {
        logError('checkout-hold-session-error', { holdId, message: errorMessage(error) });
      });
    }

    return json(200, { id: session.id, url: session.url });
  } catch (error) {
    // No session reached the customer, so nothing can be paid against this hold.
    if (held) {
      await releaseStockHold(event, holdId).catch((releaseError) => {
        logError('checkout-hold-release-error', { holdId, message: errorMessage(releaseError) });
      });
    }

    if (error instanceof CheckoutError) {
      return json(error.statusCode, { error: error.message, ...error.extra });
    }

    logError('checkout-session-error', { message: errorMessage(error) });
    return json(500, { error: 'Failed to create checkout session.' });
  }
}
