import { useEffect, useState, FC } from 'react';
import { Navigate, Routes, Route } from 'react-router-dom';
import Navbar from '@components/Navbar';
import BackgroundMedia from './components/BackgroundMedia';
import { useCart } from '@context/CartContext';
import { redirectToCheckout } from '@utils/stripe';
import CartSidebar from '@components/CartSidebar';
import Footer from '@components/Footer';
import {
  Category,
  CartPage,
  CheckoutStatus,
  HomePage,
  InstagramCallback,
  LazyPage,
  LocalSeoPage,
  ProductDetail,
  RepairPage,
  ServicesPage,
  ShopPage,
} from '@utils/lazyComponents';

const App: FC = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const { cartItems } = useCart();

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
      <BackgroundMedia />

      <Navbar onCartClick={() => setCartOpen(true)} />

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
            path="/los-angeles-music-store"
            element={
              <LazyPage>
                <LocalSeoPage pageKey="music-store" />
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
            element={
              <LazyPage>
                <LocalSeoPage pageKey="music-lessons" />
              </LazyPage>
            }
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
            element={
              <LazyPage>
                <RepairPage />
              </LazyPage>
            }
          />
        </Routes>
      </main>

      <Footer />
    </div>
  );
};

export default App;
