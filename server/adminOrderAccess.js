import process from 'node:process';

export function getExpectedOrderLookupToken() {
  return process.env.ORDER_LOOKUP_TOKEN || '';
}

export function getProvidedOrderLookupToken(headers = {}) {
  const authorization =
    headers.authorization || headers.Authorization || headers['x-order-admin-token'] || null;

  if (!authorization) {
    return '';
  }

  if (authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return String(authorization).trim();
}

export function validateOrderLookupAccess(headers = {}) {
  const expectedToken = getExpectedOrderLookupToken();

  if (!expectedToken) {
    return {
      ok: false,
      statusCode: 500,
      error: 'Missing ORDER_LOOKUP_TOKEN.',
    };
  }

  const providedToken = getProvidedOrderLookupToken(headers);
  if (!providedToken) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Missing admin authorization token.',
    };
  }

  if (providedToken !== expectedToken) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Invalid admin authorization token.',
    };
  }

  return { ok: true };
}