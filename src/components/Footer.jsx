import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Link to="/" className="footer-title footer-brand-link">
            Sattari Music
          </Link>
          <p className="footer-copy">
            Drum-forward gear, local repair support, rentals, and musician services.
          </p>
          <div className="footer-quick-links" aria-label="Footer quick links">
            <Link to="/shop">Shop gear</Link>
            <Link to="/services">Book local support</Link>
            <Link to="/learn">Learn a song</Link>
            <Link to="/studio">Open Studio</Link>
          </div>
        </div>
        <div>
          <p className="footer-title">Get in touch</p>
          <p className="footer-copy">
            <a
              href="tel:+14244653020"
              style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}
            >
              (424) 465-3020
            </a>
            <br />
            Woodland Hills, CA
            <br />
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
