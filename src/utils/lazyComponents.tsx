import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any -- pages take arbitrary props */
type PageModule = { default: ComponentType<any> };

export type PreloadablePage = LazyExoticComponent<ComponentType<any>> & {
  /** Starts (or joins) the chunk download; resolves once the page can render without suspending. */
  preload: () => Promise<PageModule>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const RELOAD_STAMP_KEY = 'sattari-chunk-reload-v1';
const RELOAD_GUARD_MS = 30_000;
// How long a reload may take to replace the page before it counts as cancelled.
// A page with unsaved work (a Studio recording, the stem separator) asks
// "Leave site?", and choosing to stay keeps this page running.
export const RELOAD_WAIT_MS = 6_000;
let reloading = false;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading (CSS )?chunk \S+ failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return CHUNK_ERROR.test(text);
}

/**
 * A tab opened before a deploy asks for chunk files the new deploy no longer
 * has. One reload fetches the new HTML and chunk names. The sessionStorage stamp
 * keeps a chunk that is genuinely broken from reloading in a loop; without
 * storage there is no guard, so it does not reload at all.
 *
 * Returns true when a reload is under way (the caller should wait for it, see
 * untilReload). If the page is still here RELOAD_WAIT_MS later, the reload was
 * cancelled and a later failure may try again (subject to the guard).
 */
export function reloadForNewDeploy(): boolean {
  if (reloading) return true;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_STAMP_KEY));
    if (last && Date.now() - last < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
  } catch {
    return false;
  }
  reloading = true;
  window.location.reload();
  window.setTimeout(() => {
    reloading = false;
  }, RELOAD_WAIT_MS);
  return true;
}

/**
 * Waits for the reload started by reloadForNewDeploy: meanwhile rendering stays
 * suspended and the current page stays on screen. If the page outlives the
 * reload (the visitor chose to stay), fails with the original error so the
 * route's error boundary can ask for a refresh instead of hanging.
 */
export function untilReload(error: unknown): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(error), RELOAD_WAIT_MS);
  });
}

export function lazyPage(
  load: () => Promise<Record<string, unknown> | undefined>,
  name = 'default'
) {
  let loaded: PageModule | null = null;
  let pending: Promise<PageModule> | null = null;

  const preload = () => {
    pending ??= load().then(
      (module) => {
        loaded = { default: module?.[name] as PageModule['default'] };
        return loaded;
      },
      (error) => {
        pending = null;
        if (isChunkLoadError(error) && reloadForNewDeploy()) return untilReload(error);
        throw error;
      }
    );
    return pending;
  };

  // React.lazy renders without suspending only if the thenable it is handed has
  // already settled when it calls then(). Handing it one once the chunk is in
  // lets a prerendered page hydrate in a single pass, so the Suspense fallback
  // never replaces the server HTML.
  const Page = lazy(() =>
    loaded
      ? ({
          then: (resolve: (value: PageModule) => void) => resolve(loaded as PageModule),
        } as Promise<PageModule>)
      : preload()
  ) as PreloadablePage;
  Page.preload = preload;
  return Page;
}

// Lazy load pages for code splitting
export const HomePage = lazyPage(() => import('@pages/HomePage'));
export const AboutPage = lazyPage(() => import('@components/AboutPage'));
export const ShopPage = lazyPage(() => import('@components/ShopPage'));
export const Category = lazyPage(() => import('@pages/Category'));
export const ProductDetail = lazyPage(() => import('@pages/ProductDetail'));
export const CartPage = lazyPage(() => import('@pages/CartPage'));
export const CheckoutStatus = lazyPage(() => import('@pages/CheckoutStatus'));
export const InstagramCallback = lazyPage(() => import('@pages/InstagramCallback'));
export const ServicesPage = lazyPage(() => import('@components/ServicesPage'));
export const StudioBookingStatus = lazyPage(() => import('@pages/StudioBookingStatus'));
export const RepairPage = lazyPage(() => import('@components/RepairPage'));
export const LocalSeoPage = lazyPage(() => import('@components/LocalSeoPage'));
export const DownloadsPage = lazyPage(() => import('@pages/DownloadsPage'));
// The guided guitar workspace replaces the former analysis/arranger Learn page.
export const SattariLearnPage = lazyPage(() => import('@pages/LoopPracticePage'));
export const SattariStudioPage = lazyPage(() => import('@pages/SattariStudioPage'));
export const SattariHubPage = lazyPage(() => import('@pages/SattariHubPage'));
export const StemSeparatorPage = lazyPage(() => import('@pages/StemSeparatorPage'));
export const GuideIndex = lazyPage(() => import('@pages/MusicResources'), 'GuideIndex');
export const GuideArticle = lazyPage(() => import('@pages/MusicResources'), 'GuideArticle');
export const ToolDetailsPage = lazyPage(() => import('@pages/MusicResources'), 'ToolDetailsPage');
export const VisitPage = lazyPage(() => import('@pages/MusicResources'), 'VisitPage');
export const PrivacyPage = lazyPage(() => import('@pages/MusicResources'), 'PrivacyPage');
// Wave-2 alpha tools (src/labs).
export const CanvasPage = lazyPage(() => import('@/labs/canvas/CanvasPage'));
export const PocketPage = lazyPage(() => import('@/labs/pocket/PocketPage'));
export const PressPage = lazyPage(() => import('@/labs/press/PressPage'));

// Fallback loading component
export const PageLoader = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
    }}
  >
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
      <p>Loading...</p>
    </div>
  </div>
);

// Wrapper component for lazy routes
export const LazyPage = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);
