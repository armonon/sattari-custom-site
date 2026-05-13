// SattariPortrait.jsx
// Portrait card for About section
import { Link } from 'react-router-dom';

export default function SattariPortrait() {
  return (
    <Link
      to="/services"
      className="info-card sattari-portrait-card interactive-card-link"
      style={{ maxWidth: 340, margin: '0 auto', textAlign: 'center' }}
      aria-label="Learn about services from Mohammad Sattari"
    >
      <img
        src="/sattari site/MO.png"
        alt="Mohammad Sattari, founder of Sattari Music"
        style={{
          width: '100%',
          borderRadius: '18px',
          marginBottom: '1.1rem',
          objectFit: 'cover',
          boxShadow: '0 4px 32px 0 rgba(0,0,0,0.18)',
        }}
      />
      <h3 style={{ margin: 0 }}>Mohammad Sattari</h3>
      <p style={{ color: 'var(--muted)', margin: '0.5rem 0 0' }}>Founder & Professional Drummer</p>
    </Link>
  );
}
