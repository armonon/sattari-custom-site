import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { useCart } from '../context/CartContext';
import ThemeToggle from './ThemeToggle';

const links = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/shop', label: 'Shop' },
  { to: '/services', label: 'Local Services' },
];

export default function Navbar({ onCartClick }) {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Every navigation gets a new key, including tapping the link for the page
  // already open, which leaves the pathname unchanged.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.key]);

  const handleCartClick = () => {
    setMenuOpen(false);
    onCartClick();
  };

  return (
    <header className="nav-wrap">
      <div className="container nav-inner nav-chrome">
        <NavLink to="/" className="brand-mark">
          <span className="nav-logo-frame">
            <picture>
              <source srcSet="/sattari site/sattari logo.avif" type="image/avif" />
              <img
                src="/sattari site/sattari logo.png"
                alt="Sattari Music Logo"
                width="529"
                height="143"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="brand-logo"
              />
            </picture>
          </span>
          <span className="brand-copy">
            <span className="brand-kicker">California craft</span>
            <span className="brand-name">Music gear & services</span>
          </span>
        </NavLink>
        <div className="nav-actions-row">
          <ThemeToggle />
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </div>
        <nav
          id="primary-navigation"
          className={`nav-links${menuOpen ? ' nav-links-open' : ''}`}
          aria-label="Primary navigation"
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/hub"
            className={({ isActive }) =>
              isActive ? 'nav-link nav-hub-button nav-hub-button-active' : 'nav-link nav-hub-button'
            }
          >
            <LayoutGrid size={16} aria-hidden="true" />
            Sattari Hub
          </NavLink>
          <button
            type="button"
            onClick={handleCartClick}
            className="nav-link nav-cart-button"
            aria-label={`Open cart${itemCount > 0 ? ` with ${itemCount} items` : ''}`}
          >
            Cart
            {itemCount > 0 && (
              <span className="cart-badge" aria-label={`${itemCount} items in cart`}>
                {itemCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
