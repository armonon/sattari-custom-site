import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import * as Sentry from '@sentry/react';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './fonts.css';
import './styles.css';
import './styles-refresh.css';
import './styles-theme.css';
import './styles-nav-hub.css';
import { CartProvider } from './context/CartContext';
import { InventoryProvider } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';

// Initialize Sentry — error + performance tracking.
// Session Replay was removed to keep the initial bundle lean; re-add
// `Sentry.replayIntegration()` here if you want it back.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // React Router 7 keeps the v6 hooks this integration needs, so page loads
  // and navigations are named by route ("/product/:slug"), not by raw URL.
  integrations: [
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ],
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
});

// Must run after Sentry.init. Without a DSN Sentry stays disabled and this
// returns the plain <Routes>.
const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider>
          <InventoryProvider>
            <CartProvider>
              <BrowserRouter>
                <App RoutesComponent={SentryRoutes} />
              </BrowserRouter>
            </CartProvider>
          </InventoryProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
