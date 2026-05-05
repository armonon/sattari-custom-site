import { useState, FC } from 'react';
import { Routes, Route } from 'react-router-dom';
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
  ProductDetail,
  ServicesPage,
  ShopPage,
} from '@utils/lazyComponents';

const App: FC = () => {
  const [cartOpen, setCartOpen] = useState(false);
  const { cartItems } = useCart();

  const handleCheckout = async () => {
    try {
      await redirectToCheckout({ cartItems });
    } catch (error) {
      console.error('Checkout failed:', error);
    }
  };

  return (
    <div
      className="site-shell"
      style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}
    >
      <BackgroundMedia />

      <Navbar onCartClick={() => setCartOpen(true)} />

      {/* Cart Drawer */}
      <div
        className={`cart-drawer${cartOpen ? ' open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 360,
          maxWidth: '90vw',
          background: 'rgba(18,18,20,0.98)',
          boxShadow: cartOpen ? '-8px 0 32px rgba(0,0,0,0.28)' : 'none',
          zIndex: 100,
          transform: cartOpen ? 'translateX(0)' : 'translateX(110%)',
          transition: 'transform 0.32s cubic-bezier(.7,.2,.2,1)',
          display: 'flex',
          flexDirection: 'column',
        }}
        aria-hidden={!cartOpen}
      >
        <button
          style={{
            alignSelf: 'flex-end',
            margin: 16,
            fontSize: 22,
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
          }}
          aria-label="Close cart"
          onClick={() => setCartOpen(false)}
        >
          ×
        </button>
        <CartSidebar onCheckout={handleCheckout} />
      </div>

      {/* Overlay */}
      {cartOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.32)',
            zIndex: 99,
          }}
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
        </Routes>
      </main>

      <Footer />
    </div>
  );
};

export default App;
