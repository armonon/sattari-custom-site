// thecreateco suite kit (shared app menu + Locker) for the studio apps.
// https://thecreatingco.com/suite/v1/suite.js, published by thecreatingco.com.
// Loaded only on the studio/tool pages, never on the shop or marketing pages.
// Everything here fails soft: offline, blocked or slow, the apps work as before
// and the menu/Locker buttons simply do not appear.
import { useEffect, useState, useSyncExternalStore } from 'react';

export const SUITE_SRC = 'https://thecreatingco.com/suite/v1/suite.js';
export const LOCKER_URL = 'https://thecreatingco.com/locker/';
const READY_TIMEOUT_MS = 10000;

/** Suite app id for a studio/tool path (ids from /suite/v1/apps.json). */
export function suiteAppFor(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/studio') return 'stemdeck';
  const tool = /^\/studio\/(split|keybpm|vox|canvas|pocket)$/.exec(path)?.[1];
  if (tool) return tool === 'keybpm' ? 'key-bpm' : tool;
  if (path === '/press') return 'press';
  return null;
}

let readyPromise = null;

/**
 * Adds the suite script once. The kit reads its app id when it loads, so the
 * first studio page opened decides it (Locker records it as the source app).
 */
export function loadSuiteKit(appId) {
  if (typeof document === 'undefined' || !appId) return Promise.resolve(null);
  if (readyPromise) return readyPromise;
  readyPromise = new Promise((resolve) => {
    if (window.TCC?.ready) return resolve(window.TCC.ready.then((tcc) => tcc || null));
    const done = (value) => resolve(value);
    const timer = window.setTimeout(() => done(null), READY_TIMEOUT_MS);
    window.addEventListener(
      'tcc:ready',
      () => {
        window.clearTimeout(timer);
        done(window.TCC || null);
      },
      { once: true }
    );
    if (!document.querySelector(`script[src="${SUITE_SRC}"]`)) {
      const script = document.createElement('script');
      script.src = SUITE_SRC;
      script.defer = true;
      // CORS mode (the kit sends Access-Control-Allow-Origin: *), so the studio
      // service worker can keep a readable copy for offline use.
      script.crossOrigin = 'anonymous';
      script.dataset.app = appId;
      // Each app header places its own <tcc-suite-menu>; no floating button.
      script.dataset.menu = 'none';
      script.onerror = () => {
        window.clearTimeout(timer);
        done(null);
      };
      document.head.appendChild(script);
    }
  }).then((tcc) => (tcc && tcc.locker ? tcc : null));
  readyPromise.then((tcc) => setKit(tcc));
  return readyPromise;
}

// ---- tiny store: the kit (or null) and the latest export offered to the Locker
const store = { kit: null, offer: null };
let snapshot = { ...store };
const listeners = new Set();
function emit(patch) {
  Object.assign(store, patch);
  snapshot = { ...store };
  listeners.forEach((listener) => listener());
}
function setKit(kit) {
  emit({ kit });
}
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const useSuite = () =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot
  );

/** Loads the kit for this page. Returns the kit once ready (null when unavailable). */
export function useSuiteKit(appId) {
  const { kit } = useSuite();
  useEffect(() => {
    if (appId) void loadSuiteKit(appId);
  }, [appId]);
  return kit;
}

/**
 * Called by every export download in the studio apps: the Locker offer shows
 * "Save to Locker" for the file just downloaded (only once the kit is ready).
 */
export function offerToLocker(blob, name) {
  if (!(blob instanceof Blob) || !name) return;
  emit({ offer: { blob, name, type: blob.type || guessType(name), at: Date.now() } });
}
export function clearLockerOffer() {
  emit({ offer: null });
}

function guessType(name) {
  const ext = name.split('.').pop().toLowerCase();
  return (
    {
      wav: 'audio/wav',
      mp3: 'audio/mpeg',
      zip: 'application/zip',
      mp4: 'video/mp4',
      webm: 'video/webm',
      png: 'image/png',
      html: 'text/html',
      csv: 'text/csv',
      mid: 'audio/midi',
      json: 'application/json',
    }[ext] || 'application/octet-stream'
  );
}

/** Saves a file to the Locker. Throws the kit's user-facing errors. */
export async function saveToLocker({ blob, name, type, meta }) {
  const kit = store.kit || (await loadSuiteKit(null));
  if (!kit) throw new Error('The Locker is not available right now (offline?).');
  return kit.locker.save({ name, type: type || blob.type, blob, meta });
}

/**
 * Runs `handler({name, type, blob, meta, app})` when this page was opened from
 * the Locker or another app with ?tcc-open=. Does nothing without the kit.
 */
const handledEntries = new WeakSet();
export function useLockerOpen(appId, handler) {
  const kit = useSuiteKit(appId);
  const [latest] = useState(() => ({ current: handler }));
  latest.current = handler;
  useEffect(() => {
    if (!kit?.locker?.onOpen) return;
    // The kit replays an arrived file to late handlers; a page that remounts
    // (in-app navigation) must not load the same file twice.
    kit.locker.onOpen((entry) => {
      if (!entry || handledEntries.has(entry)) return;
      handledEntries.add(entry);
      latest.current(entry);
    });
  }, [kit, latest]);
}

/** A File for an opened Locker entry, so the app's normal file path can take it. */
export function entryFile(entry) {
  if (entry.blob instanceof File) return entry.blob;
  return new File([entry.blob], entry.name || 'Locker file', {
    type: entry.type || entry.blob.type || '',
    lastModified: Date.now(),
  });
}
