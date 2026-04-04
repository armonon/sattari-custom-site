
import SattariPortrait from './SattariPortrait';

export default function AboutSection() {
  return (
    <>
      <section className="section section-contrast">
        <div className="container about-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '2.5rem' }}>
          <div style={{ flex: 2 }}>
            <p className="eyebrow">About Sattari Music</p>
            <h2>Founded by Mohammad Sattari</h2>
            <p>
              Based in Woodland Hills, California, Sattari Music is led by Mohammad Sattari—a professional drummer with over 30 years of international performance experience. Our mission is to serve drummers and musicians with curated gear, expert repairs, and a passion for the craft.
            </p>
            <p>
              Whether you’re a touring artist or a local student, you’ll find a home for your sound and your instrument here.
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 340 }}>
            <SattariPortrait />
          </div>
        </div>
      </section>
      <section className="section instagram-row">
        <div className="container">
          <div className="info-card instagram-card" style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <p className="card-kicker">Follow us on Instagram</p>
            <h3>@sattarimusic</h3>
            <div className="instagram-placeholder">
              {/* Replace with Instagram embed or gallery */}
              <span>Instagram feed coming soon</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
