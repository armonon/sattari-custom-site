import { NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const links = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/services', label: 'Local Services' },
];

export default function Navbar({ onCartClick }) {
  const { itemCount } = useCart();

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
                width="176"
                height="44"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="brand-logo"
              />
            </picture>
          </span>
          <span className="brand-copy">
            <span className="brand-kicker">California craft</span>
            <span className="brand-name">Premium drum gear</span>
          </span>
        </NavLink>
        <nav className="nav-links" aria-label="Primary navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
          <button onClick={onCartClick} className="nav-link nav-cart-button" aria-label="Open cart">
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
