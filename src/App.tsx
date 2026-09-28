import { useCallback, useEffect, useRef, useState, FC } from 'react';
import { Navigate, Routes, Route, matchRoutes, useLocation } from 'react-router-dom';
import Navbar from '@components/Navbar';
import BackgroundMedia from './components/BackgroundMedia';
import CartSidebar from '@components/CartSidebar';
import Footer from '@components/Footer';
import ShopAssistant from '@components/ShopAssistant';
import NotFoundPage from '@components/NotFoundPage';
import RouteErrorBoundary from '@components/RouteErrorBoundary';
import ScrollManager from '@components/ScrollManager';
import SiteMeasurement from './components/SiteMeasurement';
import { OrganizationSchema, SEO } from '@utils/seo';
import {
  Category,
  CartPage,
  DownloadsPage,
  CheckoutStatus,
  HomePage,
  AboutPage,
  InstagramCallback,
  LazyPage,
  LocalSeoPage,
  ProductDetail,
  RepairPage,
  SattariHubPage,
  SattariLearnPage,
  LoopPracticePage,
  SattariStudioPage,
  StemSeparatorPage,
  ServicesPage,
  StudioBookingStatus,
  ShopPage,
  GuideIndex,
  GuideArticle,
  ToolDetailsPage,
  VisitPage,
  PrivacyPage,
  type PreloadablePage,
} from '@utils/lazyComponents';

type RouteDefinition =
  | {
      path: string;
      page: PreloadablePage;
      props?: Record<string, unknown>;
      /** False for a page whose first render reads browser state (storage) and so
       * cannot match its prerendered HTML: it is rendered fresh, not hydrated. */
      hydrate?: false;
    }
  | { path: string; redirect: string };

const localPage = (path: string, pageKey: string): RouteDefinition => ({
  path,
  page: LocalSeoPage,
  props: { pageKey },
});

// One table drives both the <Routes> below and preloadRoute(), so the page the
// browser downloads before hydrating is always the page the router renders.
const ROUTES: RouteDefinition[] = [
  { path: '/guides', page: GuideIndex },
  { path: '/guides/:slug', page: GuideArticle },
  { path: '/tools/:tool', page: ToolDetailsPage },
  { path: '/visit', page: VisitPage },
  { path: '/privacy', page: PrivacyPage },
  { path: '/studio-booking', page: StudioBookingStatus },
  { path: '/', page: HomePage },
  { path: '/about', page: AboutPage },
  { path: '/shop', page: ShopPage },
  { path: '/buy', redirect: '/shop' },
  { path: '/hub', page: SattariHubPage },
  { path: '/learn', page: SattariLearnPage },
  { path: '/loop', page: LoopPracticePage, hydrate: false },
  // Restores its panels from localStorage while rendering.
  { path: '/studio', page: SattariStudioPage, hydrate: false },
  { path: '/stem-separator', page: StemSeparatorPage },
  // The Audio Suite and its downloads are one page, on /downloads.
  { path: '/downloads', page: DownloadsPage },
  { path: '/audio-suite', redirect: '/downloads' },
  { path: '/audio-suite/downloads', redirect: '/downloads' },
  { path: '/audio', redirect: '/downloads' },
  localPage('/woodland-hills-drum-shop', 'woodland-drums'),
  localPage('/encino-violin-shop', 'encino-violins'),
  localPage('/services/violin-repair-los-angeles', 'violin-repair'),
  localPage('/services/guitar-setup-los-angeles', 'guitar-setup'),
  localPage('/los-angeles-music-store', 'music-store'),
  localPage('/woodland-hills-music-store', 'woodland-hills'),
  localPage('/encino-music-store', 'encino'),
  localPage('/calabasas-music-store', 'calabasas'),
  localPage('/shop/instruments-los-angeles', 'instruments'),
  localPage('/shop/accessories-los-angeles', 'accessories'),
  localPage('/shop/drums-los-angeles', 'drums'),
  localPage('/shop/violins-los-angeles', 'violins'),
  localPage('/shop/guitars-los-angeles', 'guitars'),
  { path: '/shop/:categoryKey', page: Category },
  { path: '/product/:slug', page: ProductDetail },
  { path: '/cart', page: CartPage },
  { path: '/checkout/success', page: CheckoutStatus },
  { path: '/checkout/cancel', page: CheckoutStatus },
  { path: '/instagram/callback', page: InstagramCallback },
  { path: '/services', page: ServicesPage },
  localPage('/services/instrument-rentals-los-angeles', 'instrument-rentals'),
  localPage('/services/rehearsal-space-los-angeles', 'rehearsal-space'),
  localPage('/services/recording-studio-rental-los-angeles', 'recording-studio'),
  localPage('/services/music-lessons-los-angeles', 'music-lessons'),
  { path: '/services/music-classes-los-angeles', redirect: '/services/music-lessons-los-angeles' },
  { path: '/services/instrument-repair-los-angeles', page: RepairPage },
  {
    path: '/services/drum-repair-los-angeles',
    redirect: '/services/instrument-repair-los-angeles',
  },
  localPage('/services/instrument-repair-woodland-hills', 'repair-woodland-hills'),
  localPage('/services/instrument-repair-calabasas', 'repair-calabasas'),
  { path: '/stem-seperator', redirect: '/stem-separator' },
];

// Matched exactly as <Routes> ranks them, including the catch-all.
const MATCHABLE = [...ROUTES.map(({ path }) => ({ path })), { path: '*' }];

/** The route a URL path belongs to ("/product/:slug"), for grouping reports by page. */
export function routePattern(pathname: string): string {
  return matchRoutes(MATCHABLE, pathname)?.[0]?.route.path ?? pathname;
}

/**
 * Downloads the code for the page at `pathname`. Once it resolves, that page
 * renders without suspending, which is what lets main.tsx hydrate prerendered
 * HTML without the loading fallback ever replacing it. `hydrate` says whether
 * the page's first render can match its prerendered HTML.
 */
export async function preloadRoute(pathname: string): Promise<{ hydrate: boolean }> {
  const matched = matchRoutes(MATCHABLE, pathname)?.[0]?.route;
  const route = matched ? ROUTES[MATCHABLE.indexOf(matched)] : undefined;
  if (!route || !('page' in route)) return { hydrate: true };
  await route.page.preload();
  return { hydrate: route.hydrate !== false };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.getClientRects().length > 0
  );
}

// Back to the control that opened the cart. On a phone that control (Cart) sat
// in the menu, which closed as the cart opened, so the menu button takes focus.
function restoreFocus(opener: HTMLElement | null) {
  if (opener?.isConnected) {
    opener.focus({ preventScroll: true });
    if (document.activeElement === opener) return;
  }
  document.querySelector<HTMLElement>('.mobile-menu-button')?.focus({ preventScroll: true });
}

const App: FC = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const isAudioWorkspace = ['/hub', '/learn', '/loop', '/studio', '/stem-separator'].includes(
    location.pathname
  );
  const isResourcePage = /^\/(guides|tools|visit|privacy)(\/|$)/.test(location.pathname);

  const openCart = useCallback(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCartOpen(true);
  }, []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  // The drawer is a modal dialog: focus moves into it, Tab stays inside, the
  // rest of the page is inert (unreachable by keyboard, pointer and screen
  // readers) and Escape or closing returns focus where it came from.
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return undefined;
    // Closed, nothing inside may take focus. CSS hides it, but controls with
    // their own `transition: all` stay visible, and tabbable, for a moment
    // after the drawer hides.
    drawer.toggleAttribute('inert', !cartOpen);
    if (!cartOpen) return undefined;

    document.body.classList.add('cart-lock-scroll');
    // The overlay stays live: clicking it is one way to close the cart.
    const background = Array.from(drawer.parentElement?.children ?? []).filter(
      (element) =>
        element !== drawer &&
        !element.classList.contains('cart-drawer-overlay') &&
        !element.hasAttribute('inert')
    );
    background.forEach((element) => element.setAttribute('inert', ''));
    drawer.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCartOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      // Always moved here, never left to the browser: Safari's default Tab
      // order skips links, so from the last control it would leave the dialog.
      event.preventDefault();
      const focusable = focusableIn(drawer);
      if (!focusable.length) {
        drawer.focus();
        return;
      }
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? focusable[index <= 0 ? focusable.length - 1 : index - 1]
        : focusable[index + 1 < focusable.length ? index + 1 : 0];
      next.focus();
    };
    document.addEventListener('keydown', handleKeyDown);

    // Removing the line whose button had focus drops focus to <body>, outside
    // the dialog; bring it back.
    const keepFocusInside = new MutationObserver(() => {
      if (!drawer.contains(document.activeElement)) drawer.focus({ preventScroll: true });
    });
    keepFocusInside.observe(drawer, { childList: true, subtree: true });

    return () => {
      keepFocusInside.disconnect();
      document.body.classList.remove('cart-lock-scroll');
      background.forEach((element) => element.removeAttribute('inert'));
      document.removeEventListener('keydown', handleKeyDown);
      restoreFocus(openerRef.current);
    };
  }, [cartOpen]);

  return (
    <div className={`site-shell${location.pathname === '/' ? ' is-home' : ''}`}>
      <OrganizationSchema />
      <ScrollManager />
      {['/cart', '/checkout/success', '/checkout/cancel', '/instagram/callback'].includes(
        location.pathname
      ) && (
        <SEO
          title="Your Sattari Music Account & Checkout"
          description="Manage your Sattari Music cart, checkout or account connection."
          url={`https://sattarimusic.com${location.pathname}`}
          noindex
        />
      )}
      {!['/', '/studio', '/loop', '/stem-separator'].includes(location.pathname) && (
        <BackgroundMedia />
      )}

      {!['/studio', '/loop'].includes(location.pathname) && <Navbar onCartClick={openCart} />}

      {/* Cart Drawer */}
      <div
        ref={drawerRef}
        className={`cart-drawer${cartOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        aria-hidden={!cartOpen}
        tabIndex={-1}
      >
        <button className="cart-drawer-close" aria-label="Close cart" onClick={closeCart}>
          ×
        </button>
        <CartSidebar onNavigate={closeCart} />
      </div>

      {/* Overlay */}
      {cartOpen && <div className="cart-drawer-overlay" onClick={closeCart} aria-hidden="true" />}

      <main>
        <RouteErrorBoundary resetKey={location.pathname}>
          <Routes>
            {ROUTES.map((route) =>
              'redirect' in route ? (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<Navigate to={route.redirect} replace />}
                />
              ) : (
                <Route
                  key={route.path}
                  path={route.path}
                  element={
                    <LazyPage>
                      <route.page {...route.props} />
                    </LazyPage>
                  }
                />
              )
            )}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </RouteErrorBoundary>
      </main>

      {!isAudioWorkspace && <Footer />}
      {location.pathname !== '/loop' && <SiteMeasurement />}
      {!isAudioWorkspace && !isResourcePage && <ShopAssistant />}
    </div>
  );
};

export default App;
