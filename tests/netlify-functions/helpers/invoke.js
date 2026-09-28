// Calls a v2 function the way Netlify does — a web Request in, a Response
// out — from the Lambda-shaped description these tests were written in, and
// hands back { statusCode, headers, body } for the assertions. Response
// header names come back lower-cased, as the Fetch API reports them.
//
//   const webhook = callWith(stripeWebhookModule.default);
//   const response = await webhook({ httpMethod: 'POST', headers, body });

export function callWith(fn, { origin = 'https://sattarimusic.com', path = '/' } = {}) {
  return async (event = {}) => {
    const url = new URL(event.path || path, origin);
    for (const [name, value] of Object.entries(event.queryStringParameters || {})) {
      if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
    }

    const method = event.httpMethod || 'GET';
    const headers = new Headers();
    for (const [name, value] of Object.entries(event.headers || {})) {
      if (value !== undefined && value !== null) headers.set(name, String(value));
    }
    const hasBody = !['GET', 'HEAD'].includes(method) && event.body != null && event.body !== '';

    const response = await fn(
      new Request(url, { method, headers, body: hasBody ? event.body : undefined }),
      { ip: headers.get('x-nf-client-connection-ip') || undefined, waitUntil: () => {} }
    );
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
    };
  };
}
