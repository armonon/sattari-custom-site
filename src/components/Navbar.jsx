import { NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const links = [
  { to: '/', label: 'Home' },
  { to: '/shop', label: 'Shop' },
  { to: '/services', label: 'Local Services' },
  { to: '/cart', label: 'Cart' },
];

export default function Navbar() {
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
              {link.to === '/cart' && itemCount > 0 ? (
                <span className="cart-badge" aria-label={`${itemCount} items in cart`}>
                  {itemCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
