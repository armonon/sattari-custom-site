import { metricPage, referralSource } from './siteMetrics';
const PREFERENCE = 'sattari-measurement-v1';
const SOURCE = 'sattari-referral-v1';
let lastPage = '';
let lastPageAt = 0;
let emitted = 0;

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
    if (!allowed) sessionStorage.removeItem(SOURCE);
  } catch {
    /* Measurement is optional when storage is unavailable. */
  }
  window.dispatchEvent(new Event('sattari-measurement-change'));
}
export function trackSiteEvent(event) {
  try {
    if (
      measurementBlocked() ||
      measurementPreference() !== 'allowed' ||
      window.location.hostname !== 'sattarimusic.com'
    )
      return;
    const page = metricPage(window.location.pathname);
    if (!page || emitted >= 200) return;
    if (event === 'page_view') {
      const now = Date.now();
      if (lastPage === page && now - lastPageAt < 1000) return;
      lastPage = page;
      lastPageAt = now;
    }
    let source = sessionStorage.getItem(SOURCE);
    if (!source) {
      source = referralSource(document.referrer, window.location.search, window.location.origin);
      sessionStorage.setItem(SOURCE, source);
    }
    emitted += 1;
    void fetch('/api/site-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, page, source }),
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }).catch(() => {});
  } catch {
    /* Never interrupt a musical session or inquiry for measurement. */
  }
}
