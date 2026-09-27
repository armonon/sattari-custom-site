import 'dotenv/config';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import { BlobsServer } from '@netlify/blobs/server';
import * as checkoutRelease from '../netlify/functions/checkout-release.js';
import * as checkoutSessionStatus from '../netlify/functions/checkout-session-status.js';
import * as createCheckoutSession from '../netlify/functions/create-checkout-session.js';
import * as inventory from '../netlify/functions/inventory.js';
import * as stripeWebhook from '../netlify/functions/stripe-webhook.js';
import * as adminOrders from '../netlify/functions/admin-orders.js';
import * as staffLogin from '../netlify/functions/staff-login.js';
import checkoutMaintenance from '../netlify/functions/checkout-maintenance.js';
import { errorMessage, logError, logEvent } from './log.js';

// `npm run dev:api`: the production Netlify functions, mounted on the same
// /api paths netlify.toml routes to them, with Netlify Blobs served from disk.
// Nothing here reimplements checkout — prices, stock holds, shipping, order
// recording and notifications all run the code that ships.

export const ROUTES = {
  '/api/create-checkout-session': createCheckoutSession,
  '/api/checkout-release': checkoutRelease,
  '/api/checkout-session-status': checkoutSessionStatus,
  '/api/stripe-webhook': stripeWebhook,
  '/api/inventory': inventory,
  // Order lookups take a staff session, as in production; sign in here for one.
  '/api/admin/orders': adminOrders,
  '/api/staff/login': staffLogin,
};

const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

// The Blobs server bundled with @netlify/blobs does not send an ETag on reads,
// and every stock, order and catalog write here is conditional on one. Without
// it the first write to a key succeeds and every later one is refused.
class LocalBlobsServer extends BlobsServer {
  async get(request) {
    const response = await super.get(request);
    const { dataPath, key } = this.getLocalPaths(new URL(request.url ?? '', this.address));
    if (response.status !== 200 || !dataPath || !key) return response;

    const headers = new Headers(response.headers);
    headers.set('etag', await BlobsServer.generateETag(dataPath));
    return new Response(response.body, { status: response.status, headers });
  }
}

// Points @netlify/blobs at a local server the way the Netlify runtime does in
// production, including the uncached URL that strong consistency needs.
export async function startLocalBlobs(directory) {
  const token = crypto.randomUUID();
  const server = new LocalBlobsServer({ directory, token });
  const { port } = await server.start();
  const url = `http://localhost:${port}`;

  globalThis.netlifyBlobsContext = Buffer.from(
    JSON.stringify({ siteID: 'local', token, edgeURL: url, uncachedEdgeURL: url })
  ).toString('base64');

  return {
    server,
    // What connectLambda() expects to find on a Lambda-style event.
    lambdaBlobs: Buffer.from(JSON.stringify({ url, token })).toString('base64'),
  };
}

function toLambdaEvent(req, lambdaBlobs) {
  const query = {};
  for (const [name, value] of Object.entries(req.query)) {
    query[name] = Array.isArray(value) ? String(value.at(-1)) : String(value);
  }

  return {
    httpMethod: req.method,
    path: req.path,
    headers: { ...req.headers, 'x-nf-site-id': 'local', 'x-nf-deploy-id': 'local' },
    queryStringParameters: query,
    body: Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '',
    isBase64Encoded: false,
    blobs: lambdaBlobs,
  };
}

function toRequest(req) {
  const hasBody = !['GET', 'HEAD'].includes(req.method) && Buffer.isBuffer(req.body);
  return new Request(`http://${req.get('host')}${req.originalUrl}`, {
    method: req.method,
    headers: Object.entries(req.headers).flatMap(([name, value]) =>
      Array.isArray(value) ? value.map((item) => [name, item]) : [[name, String(value)]]
    ),
    body: hasBody ? req.body : undefined,
  });
}

// Runs a function module the way Netlify would: `handler(event)` for a Lambda
// style (v1) function, `default(request, context)` for a v2 one.
async function invoke(module, req, lambdaBlobs) {
  if (typeof module.handler === 'function') {
    const result = await module.handler(toLambdaEvent(req, lambdaBlobs));
    const body = result?.body ?? '';
    return {
      status: result?.statusCode || 200,
      headers: Object.entries(result?.headers || {}),
      body: result?.isBase64Encoded ? Buffer.from(body, 'base64') : body,
    };
  }

  const response = await module.default(toRequest(req), { ip: req.ip });
  return {
    status: response.status,
    headers: [...response.headers.entries()],
    body: Buffer.from(await response.arrayBuffer()),
  };
}

export function createDevApp({ lambdaBlobs, clientUrl }) {
  const app = express();
  app.use(cors({ origin: clientUrl }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Raw bodies for every route: the webhook's signature is computed over the
  // exact bytes Stripe sent, and the functions parse JSON themselves.
  const rawBody = express.raw({ type: () => true, limit: '1mb' });

  for (const [route, module] of Object.entries(ROUTES)) {
    app.all(route, rawBody, async (req, res) => {
      try {
        const { status, headers, body } = await invoke(module, req, lambdaBlobs);
        res.status(status);
        for (const [name, value] of headers) res.set(name, value);
        res.send(body);
      } catch (error) {
        logError('dev-api-function-error', { route, message: errorMessage(error) });
        res.status(500).json({ error: 'Function failed. See the dev:api log.' });
      }
    });
  }

  return app;
}

async function main() {
  const port = Number(process.env.PORT || 4242);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  // Netlify sets URL to the site's address; success and cancel links are built
  // from it. Locally the site is the Vite app, not this server.
  process.env.URL ||= clientUrl;

  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('Missing STRIPE_SECRET_KEY. Checkout endpoints will fail until it is configured.');
  }

  const directory = process.env.LOCAL_BLOBS_PATH || path.resolve('.local-data/blobs');
  const { lambdaBlobs } = await startLocalBlobs(directory);

  createDevApp({ lambdaBlobs, clientUrl }).listen(port, () => {
    logEvent({ type: 'dev-api-ready', url: `http://localhost:${port}`, blobs: directory });
  });

  // Production runs this on a schedule; so does local development.
  setInterval(() => {
    checkoutMaintenance().catch(() => {});
  }, SWEEP_INTERVAL_MS).unref();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
