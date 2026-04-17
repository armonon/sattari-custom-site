import { Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import { useState } from 'react';
import { useCart } from './context/CartContext';
import { redirectToCheckout } from './utils/stripe';
import CartSidebar from './components/CartSidebar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import ShopPage from './components/ShopPage';
import Category from './pages/Category';
import ProductDetail from './pages/ProductDetail';
import ServicesPage from './components/ServicesPage';
import CartPage from './pages/CartPage';
import CheckoutStatus from './pages/CheckoutStatus';
import InstagramCallback from './pages/InstagramCallback';

export default function App() {
  const [cartOpen, setCartOpen] = useState(false);
  const { cartItems } = useCart();
  const handleCheckout = async () => {
    await redirectToCheckout({ cartItems });
  };
  return (
    <div className="site-shell" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          pointerEvents: 'none',
          overflow: 'hidden',
          background: '#000',
          filter: 'blur(8px)',
        }}
        aria-hidden="true"
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: '100vw',
            height: '100vh',
            objectFit: 'cover',
            display: 'block',
            background: '#000',
          }}
        >
          <source src="/sattari site/INSTRA PATTERN.mp4" type="video/mp4" />
        </video>
      </div>
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
          style={{ alignSelf: 'flex-end', margin: 16, fontSize: 22, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
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
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/:categoryKey" element={<Category />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout/success" element={<CheckoutStatus />} />
          <Route path="/checkout/cancel" element={<CheckoutStatus />} />
          <Route path="/instagram/callback" element={<InstagramCallback />} />
          <Route path="/services" element={<ServicesPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
