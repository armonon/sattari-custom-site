export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <p className="footer-title">Sattari Music</p>
          <p className="footer-copy">
            Drum-forward gear, local repair support, rentals, and musician services.
          </p>
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
              href="https://instagram.com/sattarimusic"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              Follow @sattarimusic
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
