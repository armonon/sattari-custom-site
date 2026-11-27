import {
  METRIC_SOURCES,
  PRODUCT_ORIGIN_PAGES,
  metricPage,
  referralSource,
  validMetric,
} from './siteMetrics';
const PREFERENCE = 'sattari-measurement-v1';
const SOURCE = 'sattari-referral-v1';
const SHOPPING_ORIGIN = 'sattari-product-origin-v1';
let lastPage = '';
let lastPageAt = 0;
let emitted = 0;
const onceKeys = new Set();

export function measurementBlocked() {
  return (
    typeof navigator === 'undefined' ||
    navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === '1'
  );
}
export function measurementPreference() {
  try {
    return localStorage.getItem(PREFERENCE);
  } catch {
    return 'denied';
  }
}
export function setMeasurementPreference(allowed) {
  try {
    localStorage.setItem(PREFERENCE, allowed && !measurementBlocked() ? 'allowed' : 'denied');
    if (!allowed) {
      sessionStorage.removeItem(SOURCE);
      sessionStorage.removeItem(SHOPPING_ORIGIN);
      sessionStorage.removeItem('sattari-purchase-measured-v1');
    }
  } catch {
    /* Measurement is optional when storage is unavailable. */
  }
  window.dispatchEvent(new Event('sattari-measurement-change'));
}
export function trackSiteEvent(event, fromPath) {
  if (fromPath === undefined) return sendMetric(event);
  const page = metricPage(fromPath);
  if (page) return sendMetric(event, page);
}

function sendMetric(event, originatingPage) {
  try {
    if (
      measurementBlocked() ||
      measurementPreference() !== 'allowed' ||
      window.location.hostname !== 'sattarimusic.com'
    )
      return;
    // A verified purchase emits one coarse event; checkout URLs/query strings
    // and session/customer details never enter the measurement payload.
    const page =
      event === 'purchase_verified' && window.location.pathname === '/checkout/success'
        ? 'purchase'
        : (originatingPage ?? metricPage(window.location.pathname));
    if (!page || emitted >= 200) return;
    if (event === 'page_view') {
      const now = Date.now();
      if (lastPage === page && now - lastPageAt < 1000) return;
      lastPage = page;
      lastPageAt = now;
    }
    let source = sessionStorage.getItem(SOURCE);
    if (!METRIC_SOURCES.includes(source)) {
      source = referralSource(document.referrer, window.location.search, window.location.origin);
      sessionStorage.setItem(SOURCE, source);
    }
    const metric = { event, page, source };
    if (!validMetric(metric)) return;
    if (event === 'product_link_click' && PRODUCT_ORIGIN_PAGES.includes(page)) {
      sessionStorage.setItem(SHOPPING_ORIGIN, page);
    }
    emitted += 1;
    void fetch('/api/site-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metric),
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }).catch(() => {});
    return true;
  } catch {
    /* Never interrupt a musical session or inquiry for measurement. */
  }
}

/**
 * Count an outcome once per page load for a caller-chosen key (for example a
 * track attempt id), so rerenders, retries of the same attempt and restored
 * saved work never inflate counts. Keys are local only and never sent.
 */
export function trackSiteEventOnce(key, event) {
  if (onceKeys.has(key)) return;
  if (onceKeys.size > 2000) onceKeys.clear();
  onceKeys.add(key);
  trackSiteEvent(event);
}

// Retain the deduplication marker only in this browser session after consent.
// The checkout identifier never enters an analytics request.
export function trackVerifiedPurchaseOnce(sessionId) {
  try {
    if (
      !sessionId ||
      measurementBlocked() ||
      measurementPreference() !== 'allowed' ||
      window.location.hostname !== 'sattarimusic.com' ||
      window.location.pathname !== '/checkout/success'
    )
      return;
    const key = 'sattari-purchase-measured-v1';
    const seen = JSON.parse(sessionStorage.getItem(key) || '[]');
    if (!Array.isArray(seen) || seen.includes(sessionId)) return;
    if (trackSiteEvent('purchase_verified')) {
      sessionStorage.setItem(key, JSON.stringify([...seen, sessionId].slice(-200)));
      // Last measured local product link in this tab before a verified purchase.
      const origin = sessionStorage.getItem(SHOPPING_ORIGIN);
      if (PRODUCT_ORIGIN_PAGES.includes(origin)) sendMetric('purchase_after_product_visit', origin);
      sessionStorage.removeItem(SHOPPING_ORIGIN);
    }
  } catch {
    /* Optional measurement must never interrupt payment confirmation. */
  }
}
