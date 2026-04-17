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
      <div className="container nav-inner">
        <NavLink to="/" className="brand-mark" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/sattari site/sattari logo.png" alt="Sattari Music Logo" style={{ height: 44, width: 'auto', display: 'block' }} />
        </NavLink>
        <nav className="nav-links" aria-label="Primary navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              {link.label}
            </NavLink>
          ))}
          <button
            onClick={onCartClick}
            className="nav-link"
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '0.7rem 1rem', marginLeft: 8 }}
            aria-label="Open cart"
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
