import { Link } from 'react-router-dom';
import { BUSINESS } from '../data/siteSeo';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="footer-title footer-brand-link">
            {BUSINESS.name}
          </Link>
          <p className="footer-copy">
            Instruments, online guitar learning and music software for musicians worldwide. Repairs,
            rentals and lessons in Woodland Hills, California.
          </p>
          <nav className="footer-quick-links" aria-label="Footer quick links">
            <Link to="/about">About Sattari</Link>
            <Link to="/shop">Shop gear</Link>
            <Link to="/services">Book local support</Link>
            <Link to="/hub">Enter Sattari Hub</Link>
            <Link to="/downloads">Music software downloads</Link>
            <Link to="/guides">Music guides</Link>
            <Link to="/visit">Visit & contact</Link>
            <Link to="/privacy">Privacy choices</Link>
          </nav>
          <nav className="footer-quick-links" aria-label="Music store service areas">
            <Link to="/woodland-hills-music-store">Woodland Hills</Link>
            <Link to="/encino-music-store">Encino</Link>
            <Link to="/calabasas-music-store">Calabasas</Link>
            <Link to="/los-angeles-music-store">Los Angeles</Link>
          </nav>
        </div>
        <div>
          <p className="footer-title">Get in touch</p>
          <p className="footer-copy">
            <a
              href={BUSINESS.phoneHref}
              style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}
            >
              {BUSINESS.phoneDisplay}
            </a>
            <br />
            {BUSINESS.address.streetAddress}
            <br />
            {BUSINESS.address.addressLocality}, {BUSINESS.address.addressRegion}{' '}
            {BUSINESS.address.postalCode}
            <br />
            <br />
            {BUSINESS.shopHoursNote}
            <br />
            <a
              href="https://www.instagram.com/sattari.music/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              Follow @sattari.music
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
