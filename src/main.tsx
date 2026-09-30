import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App, { preloadRoute, routePattern } from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { reloadForNewDeploy } from './utils/lazyComponents';
import { startMonitoring } from './utils/monitoring';
import './fonts.css';
import './styles.css';
import './styles-refresh.css';
import './styles-theme.css';
import './styles-nav-hub.css';
import './styles-site-chrome.css';
import { CartProvider } from './context/CartContext';
import { InventoryProvider } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';

// A tab opened before a deploy asks for chunk files the deploy removed. Vite
// reports the failed import here; reload once (guarded against loops) to pick
// up the new build. The import still fails as usual: preventing the event
// would make it resolve to undefined, which callers cannot tell from a module.
// A page's code waits for the reload (lazyComponents), and if the visitor
// cancels it, the route's error boundary asks for a refresh.
window.addEventListener('vite:preloadError', () => {
  reloadForNewDeploy();
});

// Error and performance reporting loads once the page is idle (see monitoring.ts).
startMonitoring(routePattern);

// The inventory the page was prerendered with (scripts/prerender.mjs), so the
// first render shows the same prices and stock as the HTML it hydrates.
function readInventorySnapshot() {
  try {
    const node = document.getElementById('inventory-snapshot');
    return node?.textContent ? JSON.parse(node.textContent) : null;
  } catch {
    return null;
  }
}

const root = document.getElementById('root')!;
const router = createBrowserRouter([{ path: '*', element: <App /> }]);
const app = (
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider>
          <InventoryProvider initialInventory={readInventorySnapshot()}>
            <CartProvider>
              <RouterProvider router={router} />
            </CartProvider>
          </InventoryProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

if (!root.firstElementChild) {
  // app.html (URLs that were not prerendered, e.g. a product staff added after
  // the build) and the dev server: nothing to keep, render from scratch.
  ReactDOM.createRoot(root).render(app);
} else {
  // A prerendered page. Its route's code is downloaded before React starts, so
  // the page renders without suspending: hydration adopts the HTML already on
  // screen instead of replacing it with the loading fallback, and a page that
  // renders from browser state is rendered in one pass with no fallback either.
  // HTML rendered for another path (404.html, which Netlify serves for every
  // unknown URL, or /shop.html reached as /shop/) cannot be adopted: the
  // router renders this URL, so it is rendered fresh. Paths are compared
  // exactly, as the router's own checks (App.tsx) are.
  const renderedHere = root.dataset.prerenderedPath === window.location.pathname;
  preloadRoute(window.location.pathname).then(
    ({ hydrate }) => {
      if (hydrate && renderedHere) ReactDOM.hydrateRoot(root, app);
      else ReactDOM.createRoot(root).render(app);
    },
    // The page's code failed to load: render normally so the route's error
    // boundary can explain, with the navigation still working.
    () => ReactDOM.createRoot(root).render(app)
  );
}
