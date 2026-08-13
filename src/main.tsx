import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import * as Sentry from '@sentry/react';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './fonts.css';
import './styles.css';
import './styles-refresh.css';
import './styles-theme.css';
import { CartProvider } from './context/CartContext';
import { InventoryProvider } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';

// Initialize Sentry — error + performance tracking.
// Session Replay was removed to keep the initial bundle lean; re-add
// `Sentry.replayIntegration()` here if you want it back.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
});

const SentryRoutes = Sentry.withSentryRouting(BrowserRouter);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HelmetProvider>
        <ThemeProvider>
          <InventoryProvider>
            <CartProvider>
              <SentryRoutes>
                <App />
              </SentryRoutes>
            </CartProvider>
          </InventoryProvider>
        </ThemeProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
