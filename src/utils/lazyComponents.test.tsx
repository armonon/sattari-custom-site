import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type LazyModule = typeof import('./lazyComponents');

// Fresh module state per test: the reload flag is module-level.
async function loadFresh(): Promise<LazyModule> {
  vi.resetModules();
  return import('./lazyComponents');
}

const MISSING_CHUNK = new TypeError(
  'Failed to fetch dynamically imported module: https://sattarimusic.com/assets/ShopPage-old.js'
);

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

it('renders a preloaded page without showing the loading fallback', async () => {
  const { lazyPage, LazyPage } = await loadFresh();
  const Page = lazyPage(async () => ({ default: () => <h1>Shop</h1> }));

  await Page.preload();
  render(
    <LazyPage>
      <Page />
    </LazyPage>
  );

  // Rendered in the same pass: this is what lets main.tsx hydrate the
  // prerendered HTML instead of replacing it with "Loading...".
  expect(screen.getByRole('heading', { name: 'Shop' })).toBeInTheDocument();
  expect(screen.queryByText('Loading...')).toBeNull();
});

it('picks a named export and shares one download between preload and render', async () => {
  const { lazyPage } = await loadFresh();
  const load = vi.fn(async () => ({ GuideIndex: () => <p>Guides</p> }));
  const Page = lazyPage(load, 'GuideIndex');

  const first = Page.preload();
  const second = Page.preload();
  expect(first).toBe(second);
  await first;
  render(<Page />);

  expect(screen.getByText('Guides')).toBeInTheDocument();
  expect(load).toHaveBeenCalledTimes(1);
});

it('reloads once for a chunk a new deploy removed, then lets a repeat failure through', async () => {
  const { lazyPage, reloadForNewDeploy } = await loadFresh();
  const Page = lazyPage(() => Promise.reject(MISSING_CHUNK));

  let settled = false;
  Page.preload().then(
    () => (settled = true),
    () => (settled = true)
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

  // A reload is under way (jsdom cannot navigate); the page waits for it.
  expect(settled).toBe(false);
  expect(Number(sessionStorage.getItem('sattari-chunk-reload-v1'))).toBeGreaterThan(0);
  expect(reloadForNewDeploy()).toBe(true);

  // After that reload, the same failure within the guard window is an error
  // for the route's error boundary, not another reload.
  const next = await loadFresh();
  const Again = next.lazyPage(() => Promise.reject(MISSING_CHUNK));
  await expect(Again.preload()).rejects.toBe(MISSING_CHUNK);
});

it('stops waiting when the reload is cancelled ("Leave site?" → Stay), so the page can say so', async () => {
  vi.useFakeTimers();
  try {
    const { lazyPage, reloadForNewDeploy, RELOAD_WAIT_MS } = await loadFresh();
    const Page = lazyPage(() => Promise.reject(MISSING_CHUNK));
    let outcome: unknown = 'pending';
    Page.preload().then(
      () => (outcome = 'loaded'),
      (error) => (outcome = error)
    );

    // While the reload may still be on its way, rendering waits for it.
    await vi.advanceTimersByTimeAsync(RELOAD_WAIT_MS - 1);
    expect(outcome).toBe('pending');
    expect(reloadForNewDeploy()).toBe(true);

    // The page outlived the reload: the original error reaches the route's
    // error boundary ("This page needs a refresh") instead of a hang.
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toBe(MISSING_CHUNK);
    // No longer marked as reloading; the guard still stops an immediate retry.
    expect(reloadForNewDeploy()).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it('does not reload for errors that are not missing chunks', async () => {
  const { lazyPage } = await loadFresh();
  const bug = new Error('Cannot read properties of undefined');
  const Page = lazyPage(() => Promise.reject(bug));

  await expect(Page.preload()).rejects.toBe(bug);
  expect(sessionStorage.getItem('sattari-chunk-reload-v1')).toBeNull();
});

it('recognizes the chunk errors browsers and Vite report', async () => {
  const { isChunkLoadError } = await loadFresh();
  expect(isChunkLoadError(MISSING_CHUNK)).toBe(true);
  expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/HomePage-x.css'))).toBe(
    true
  );
  expect(isChunkLoadError(new Error('Network request failed'))).toBe(false);
});
