import { Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './components/HomePage';
import ShopPage from './components/ShopPage';
import Category from './pages/Category';
import ProductDetail from './pages/ProductDetail';
import ServicesPage from './components/ServicesPage';
import CartPage from './pages/CartPage';
import CheckoutStatus from './pages/CheckoutStatus';

export default function App() {
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
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/shop/:categoryKey" element={<Category />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout/success" element={<CheckoutStatus />} />
          <Route path="/checkout/cancel" element={<CheckoutStatus />} />
          <Route path="/services" element={<ServicesPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
