// SattariPortrait.jsx
// Portrait card for About section

export default function SattariPortrait() {
  return (
    <div
      className="info-card sattari-portrait-card"
      style={{ maxWidth: 340, margin: '0 auto', textAlign: 'center' }}
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
    </div>
  );
}
