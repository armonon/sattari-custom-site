import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import ThemeToggle from './ThemeToggle';

const links = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/shop', label: 'Shop' },
  { to: '/services', label: 'Local Services' },
  // The plugin catalogue at /downloads is a static site deployed next to this
  // app, so this link loads it from the server instead of routing in the SPA.
  { to: '/downloads', label: 'Downloads', reloadDocument: true },
];

export default function Navbar({ onCartClick }) {
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navRef = useRef(null);
  const headerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const path = location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const inHub =
    path.startsWith('/studio/') ||
    ['/hub', '/learn', '/loop', '/studio', '/stem-separator'].includes(path);
  const inShop = path === '/shop' || path.startsWith('/shop/') || path.startsWith('/product/');

  // Every navigation gets a new key, including tapping the link for the page
  // already open, which leaves the pathname unchanged.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.key]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const dismiss = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const outside = (event) => {
      if (!headerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
    };
  }, [menuOpen]);

  // On phones the links collapse into the menu. Closed, they are hidden from
  // the keyboard and screen readers: CSS hides the list, and `inert` also covers
  // the links, whose own transitions keep them visible for a moment after it.
  useEffect(() => {
    const nav = navRef.current;
    const compact = window.matchMedia('(max-width: 760px)');
    const sync = () => {
      nav.toggleAttribute('inert', compact.matches && !menuOpen);
    };
    sync();
    compact.addEventListener('change', sync);
    return () => compact.removeEventListener('change', sync);
  }, [menuOpen]);

  const handleCartClick = () => {
    setMenuOpen(false);
    onCartClick();
  };

  return (
    <header ref={headerRef} className="nav-wrap">
      <div className="container nav-inner nav-chrome">
        <NavLink to="/" className="brand-mark">
          <span className="nav-logo-frame">
            <picture>
              {/* Encoded: a literal space would split the srcset candidate. */}
              <source srcSet="/sattari%20site/sattari%20logo.avif" type="image/avif" />
              <img
                src="/sattari site/sattari logo.png"
                alt="Sattari Music Logo"
                width="529"
                height="143"
                loading="eager"
                // React 18 warns about fetchPriority; the lowercase attribute renders as is.
                // eslint-disable-next-line react/no-unknown-property
                fetchpriority="high"
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
            ref={menuButtonRef}
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
          ref={navRef}
          id="primary-navigation"
          className={`nav-links${menuOpen ? ' nav-links-open' : ''}`}
          aria-label="Primary navigation"
        >
          {links.map((link) => {
            const current =
              link.to === '/shop'
                ? inShop
                : path === link.to || (link.to !== '/' && path.startsWith(`${link.to}/`));
            return (
              <Link
                key={link.to}
                to={link.to}
                reloadDocument={link.reloadDocument}
                aria-current={current ? 'page' : undefined}
                className={current ? 'nav-link nav-link-active' : 'nav-link'}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            to="/hub"
            aria-current={inHub ? 'page' : undefined}
            className={
              inHub ? 'nav-link nav-hub-button nav-hub-button-active' : 'nav-link nav-hub-button'
            }
          >
            <LayoutGrid size={16} aria-hidden="true" />
            Sattari Hub
          </Link>
          <button
            type="button"
            onClick={handleCartClick}
            className="nav-link nav-cart-button"
            aria-label={`Open cart${itemCount > 0 ? ` with ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : ''}`}
          >
            <ShoppingBag size={17} aria-hidden="true" />
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
