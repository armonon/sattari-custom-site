// One-line JSON records for the Netlify function log, so they can be searched
// by `type`. Errors go through console.error directly.
export function logEvent(record) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(record));
}

export function logError(type, details = {}) {
  console.error(JSON.stringify({ type, ...details }));
}

export function errorMessage(error) {
  return error?.message || String(error);
}
