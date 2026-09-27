// Bridges Netlify's v2 functions (web Request in, Response out) to the
// Lambda-shaped event the shared server modules were written against, so the
// business logic and its tests stay the same whichever format a function uses.
//
// v2 is needed wherever a function declares a native rate limit: Netlify only
// reads `config.rateLimit` from v2 functions, and only together with a
// `config.path`.

// Lambda-compatible events carry Blobs credentials that must be handed to
// connectLambda(). v2 functions get them from the runtime instead, and an
// adapted event has none, so passing it on would make connectLambda() throw.
export function blobsEvent(event) {
  return event?.blobs ? event : undefined;
}

export async function lambdaEvent(request, context) {
  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  // context.ip is set by Netlify's edge. The header is the same value in
  // production and keeps local tooling working when the context has no ip.
  const ip = context?.ip || headers['x-nf-client-connection-ip'];
  if (ip) headers['x-nf-client-connection-ip'] = ip;

  return {
    httpMethod: request.method,
    path: url.pathname,
    headers,
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: ['GET', 'HEAD'].includes(request.method) ? '' : await request.text(),
  };
}

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

export function webResponse({ statusCode, headers = {}, body = '', isBase64Encoded = false }) {
  const payload = NULL_BODY_STATUSES.has(statusCode)
    ? null
    : isBase64Encoded
      ? Buffer.from(body, 'base64')
      : body;
  return new Response(payload, { status: statusCode, headers });
}
