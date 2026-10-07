// Page side of the studio apps' service worker (src/pwa/studio-sw.js):
// registration on the studio routes only, the "update available" handshake,
// the browser's install prompt, and the opt-in offline copy of Split.
import { useSyncExternalStore } from 'react';

export const STUDIO_SW_URL = '/studio-sw.js';
export const STUDIO_SCOPE = '/studio';
// Dedicated workers are matched by their own URL (/assets/…), so the same
// worker is registered there too; see src/pwa/studio-sw.js.
export const ASSETS_SCOPE = '/assets/';

const state = { updateReady: false, offlineReady: false, canInstall: false, installed: false };
const listeners = new Set();
let snapshot = { ...state };
let installEvent = null;
let registration = null;
let reloading = false;

function set(patch) {
  Object.assign(state, patch);
  snapshot = { ...state };
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

if (typeof window !== 'undefined') {
  // Chrome/Edge only; Safari and Firefox install from their own menus.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent = event;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    set({ canInstall: false, installed: true });
  });
}

function watch(worker) {
  worker?.addEventListener('statechange', () => {
    if (worker.state !== 'installed') return;
    // With a controller this is an update waiting for the user; without one,
    // the first install just finished and the app now works offline.
    if (navigator.serviceWorker.controller) set({ updateReady: true });
    else set({ offlineReady: true });
  });
}

/** Registers the studio worker (production builds, studio routes only). Safe to call repeatedly. */
export async function registerStudioWorker() {
  if (registration || !import.meta.env.PROD || !('serviceWorker' in navigator)) return registration;
  try {
    registration = await navigator.serviceWorker.register(STUDIO_SW_URL, { scope: STUDIO_SCOPE });
    navigator.serviceWorker
      .register(STUDIO_SW_URL, { scope: ASSETS_SCOPE, updateViaCache: 'none' })
      .catch(() => {});
  } catch {
    return null; // Private mode or blocked storage: the app still works online.
  }
  if (registration.waiting && navigator.serviceWorker.controller) set({ updateReady: true });
  watch(registration.installing);
  registration.addEventListener('updatefound', () => watch(registration.installing));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading && state.updateReady) {
      reloading = true;
      window.location.reload();
    }
  });
  return registration;
}

/** Activates the waiting worker; the page reloads once it takes over. */
export function applyUpdate() {
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

export async function promptInstall() {
  if (!installEvent) return false;
  const event = installEvent;
  installEvent = null;
  set({ canInstall: false });
  await event.prompt();
  const choice = await event.userChoice;
  return choice?.outcome === 'accepted';
}

export function dismissOfflineReady() {
  set({ offlineReady: false });
}

export function useStudioPwa() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot
  );
}

/** Talks to the active worker about Split's offline runtime ("status" | "save" | "remove"). */
export async function splitRuntimeOffline(action) {
  if (!('serviceWorker' in navigator)) return { saved: false, unsupported: true };
  const active = (await navigator.serviceWorker.getRegistration(STUDIO_SCOPE))?.active;
  if (!active) return { saved: false, unsupported: true };
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }) => resolve(data);
    active.postMessage({ type: 'SPLIT_OFFLINE', action }, [channel.port2]);
  });
}
