import { useEffect, useState, FC } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from '@components/Navbar';
import BackgroundMedia from './components/BackgroundMedia';
import { useCart } from '@context/CartContext';
import { redirectToCheckout } from '@utils/stripe';
import CartSidebar from '@components/CartSidebar';
import Footer from '@components/Footer';
import ShopAssistant from '@components/ShopAssistant';
import NotFoundPage from '@components/NotFoundPage';
import SiteMeasurement from './components/SiteMeasurement';
import { OrganizationSchema, SEO } from '@utils/seo';
import {
  Category,
  CartPage,
  DownloadsPage,
  CheckoutStatus,
  HomePage,
  InstagramCallback,
  LazyPage,
  LocalSeoPage,
  ProductDetail,
  RepairPage,
  SattariHubPage,
  SattariLearnPage,
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
} from '@utils/lazyComponents';

const App: FC = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const { cartItems } = useCart();
  const location = useLocation();
  const isAudioWorkspace = ['/hub', '/learn', '/studio', '/stem-separator'].includes(
    location.pathname
  );
  const isResourcePage = /^\/(guides|tools|visit|privacy)(\/|$)/.test(location.pathname);

  const handleCheckout = async () => {
    setCheckoutError('');

    if (!cartItems.length) {
      setCheckoutError('Your cart is empty. Add a product before checkout.');
      return;
    }

    try {
      await redirectToCheckout({ cartItems });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout failed.');
      console.error('Checkout failed:', error);
    }
  };

  useEffect(() => {
    document.body.classList.toggle('cart-lock-scroll', cartOpen);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCartOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.classList.remove('cart-lock-scroll');
      window.removeEventListener('keydown', handleEscape);
    };
  }, [cartOpen]);

  return (
    <div className="site-shell">
      <OrganizationSchema />
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
      {!['/studio', '/stem-separator'].includes(location.pathname) && <BackgroundMedia />}

      {location.pathname !== '/studio' && <Navbar onCartClick={() => setCartOpen(true)} />}

      {/* Cart Drawer */}
      <div
        className={`cart-drawer${cartOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        aria-hidden={!cartOpen}
      >
        <button
          className="cart-drawer-close"
          aria-label="Close cart"
          onClick={() => setCartOpen(false)}
        >
          ×
        </button>
        <CartSidebar
          onCheckout={handleCheckout}
          onNavigate={() => setCartOpen(false)}
          checkoutError={checkoutError}
        />
      </div>

      {/* Overlay */}
      {cartOpen && (
        <div
          className="cart-drawer-overlay"
          onClick={() => setCartOpen(false)}
          aria-hidden="true"
        />
      )}

      <main>
        <Routes>
          <Route
            path="/guides"
            element={
              <LazyPage>
                <GuideIndex />
              </LazyPage>
            }
          />
          <Route
            path="/guides/:slug"
            element={
              <LazyPage>
                <GuideArticle />
              </LazyPage>
            }
          />
          <Route
            path="/tools/:tool"
            element={
              <LazyPage>
                <ToolDetailsPage />
              </LazyPage>
            }
          />
          <Route
            path="/visit"
            element={
              <LazyPage>
                <VisitPage />
              </LazyPage>
            }
          />
          <Route
            path="/privacy"
            element={
              <LazyPage>
                <PrivacyPage />
              </LazyPage>
            }
          />
          <Route
            path="/studio-booking"
            element={
              <LazyPage>
                <StudioBookingStatus />
              </LazyPage>
            }
          />
          <Route
            path="/"
            element={
              <LazyPage>
                <HomePage />
              </LazyPage>
            }
          />
          <Route
            path="/shop"
            element={
              <LazyPage>
                <ShopPage />
              </LazyPage>
            }
          />
          <Route path="/buy" element={<Navigate to="/shop" replace />} />
          <Route
            path="/hub"
            element={
              <LazyPage>
                <SattariHubPage />
              </LazyPage>
            }
          />
          <Route
            path="/learn"
            element={
              <LazyPage>
                <SattariLearnPage />
              </LazyPage>
            }
          />
          <Route
            path="/studio"
            element={
              <LazyPage>
                <SattariStudioPage />
              </LazyPage>
            }
          />
          <Route
            path="/stem-separator"
            element={
              <LazyPage>
                <StemSeparatorPage />
              </LazyPage>
            }
          />
          {/* The Audio Suite and its downloads are one page, on /downloads. */}
          <Route
            path="/downloads"
            element={
              <LazyPage>
                <DownloadsPage />
              </LazyPage>
            }
          />
          <Route path="/audio-suite" element={<Navigate to="/downloads" replace />} />
          <Route path="/audio-suite/downloads" element={<Navigate to="/downloads" replace />} />
          <Route path="/audio" element={<Navigate to="/downloads" replace />} />
          <Route
            path="/los-angeles-music-store"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="music-store" />
              </LazyPage>
            }
          />
          <Route
            path="/woodland-hills-music-store"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="woodland-hills" />
              </LazyPage>
            }
          />
          <Route
            path="/encino-music-store"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="encino" />
              </LazyPage>
            }
          />
          <Route
            path="/calabasas-music-store"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="calabasas" />
              </LazyPage>
            }
          />
          <Route
            path="/shop/instruments-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="instruments" />
              </LazyPage>
            }
          />
          <Route
            path="/shop/accessories-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="accessories" />
              </LazyPage>
            }
          />
          <Route
            path="/shop/drums-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="drums" />
              </LazyPage>
            }
          />
          <Route
            path="/shop/violins-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="violins" />
              </LazyPage>
            }
          />
          <Route
            path="/shop/guitars-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="guitars" />
              </LazyPage>
            }
          />
          <Route
            path="/shop/:categoryKey"
            element={
              <LazyPage>
                <Category />
              </LazyPage>
            }
          />
          <Route
            path="/product/:slug"
            element={
              <LazyPage>
                <ProductDetail />
              </LazyPage>
            }
          />
          <Route
            path="/cart"
            element={
              <LazyPage>
                <CartPage />
              </LazyPage>
            }
          />
          <Route
            path="/checkout/success"
            element={
              <LazyPage>
                <CheckoutStatus />
              </LazyPage>
            }
          />
          <Route
            path="/checkout/cancel"
            element={
              <LazyPage>
                <CheckoutStatus />
              </LazyPage>
            }
          />
          <Route
            path="/instagram/callback"
            element={
              <LazyPage>
                <InstagramCallback />
              </LazyPage>
            }
          />
          <Route
            path="/services"
            element={
              <LazyPage>
                <ServicesPage />
              </LazyPage>
            }
          />
          <Route
            path="/services/instrument-rentals-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="instrument-rentals" />
              </LazyPage>
            }
          />
          <Route
            path="/services/rehearsal-space-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="rehearsal-space" />
              </LazyPage>
            }
          />
          <Route
            path="/services/recording-studio-rental-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="recording-studio" />
              </LazyPage>
            }
          />
          <Route
            path="/services/music-lessons-los-angeles"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="music-lessons" />
              </LazyPage>
            }
          />
          <Route
            path="/services/music-classes-los-angeles"
            element={<Navigate to="/services/music-lessons-los-angeles" replace />}
          />
          <Route
            path="/services/instrument-repair-los-angeles"
            element={
              <LazyPage>
                <RepairPage />
              </LazyPage>
            }
          />
          <Route
            path="/services/drum-repair-los-angeles"
            element={<Navigate to="/services/instrument-repair-los-angeles" replace />}
          />
          <Route
            path="/services/instrument-repair-woodland-hills"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="repair-woodland-hills" />
              </LazyPage>
            }
          />
          <Route
            path="/services/instrument-repair-calabasas"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="repair-calabasas" />
              </LazyPage>
            }
          />
          <Route path="/stem-seperator" element={<Navigate to="/stem-separator" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      {!isAudioWorkspace && <Footer />}
      <SiteMeasurement />
      {!isAudioWorkspace && !isResourcePage && <ShopAssistant />}
    </div>
  );
};

export default App;
