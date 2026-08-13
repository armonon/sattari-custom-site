import { lazy, Suspense } from 'react';

// Lazy load pages for code splitting
export const HomePage = lazy(() => import('@components/HomePage'));
export const ShopPage = lazy(() => import('@components/ShopPage'));
export const Category = lazy(() => import('@pages/Category'));
export const ProductDetail = lazy(() => import('@pages/ProductDetail'));
export const CartPage = lazy(() => import('@pages/CartPage'));
export const CheckoutStatus = lazy(() => import('@pages/CheckoutStatus'));
export const InstagramCallback = lazy(() => import('@pages/InstagramCallback'));
export const ServicesPage = lazy(() => import('@components/ServicesPage'));
export const RepairPage = lazy(() => import('@components/RepairPage'));
export const LocalSeoPage = lazy(() => import('@components/LocalSeoPage'));
export const AudioSuitePage = lazy(() => import('@pages/AudioSuitePage'));
export const DownloadsPage = lazy(() => import('@pages/DownloadsPage'));

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
export const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);
