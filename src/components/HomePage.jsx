import { Link } from 'react-router-dom';
import AboutSection from './AboutSection';
import { SEO, OrganizationSchema } from '../utils/seo';

export default function HomePage() {
  return (
    <>
      <SEO
        title="Handcrafted Drum Gear"
        description="Shop handcrafted cymbals, sticks, practice pads, and drum essentials from Sattari Music. California-based expertise with secure online checkout."
        url="https://sattarimusic.com/"
      />
      <OrganizationSchema />
      <section className="hero-section hero-shell">
        <div className="container hero-grid hero-premium-grid">
          <div className="hero-copy-panel">
            <div className="hero-kicker-row">
              <p className="eyebrow">Premium Drum Gear</p>
              <span className="hero-status-pill">California-crafted support</span>
            </div>
            <h1>Drums First. Always.</h1>
            <p className="hero-copy">
              Shop handcrafted cymbals, sticks, pads, and essentials. Built by drummers, for
              drummers.
            </p>
            <div className="hero-actions">
              <Link to="/shop" className="button button-solid">
                Shop Drum Gear
              </Link>
              <Link to="/services" className="button button-outline">
                Services & Rentals
              </Link>
            </div>

            <div className="hero-metrics" aria-label="Storefront highlights">
              <div className="hero-metric-card">
                <strong>Direct founder insight</strong>
                <span>Practical recommendations from a drummer-first perspective.</span>
              </div>
              <div className="hero-metric-card">
                <strong>Premium visual polish</strong>
                <span>A storefront feel that matches the quality of the gear.</span>
              </div>
              <div className="hero-metric-card">
                <strong>Local support when needed</strong>
                <span>Repairs, rentals, and working-musician help in California.</span>
              </div>
            </div>
          </div>

          <div className="hero-card-stack">
            <div className="hero-card hero-card-feature">
              <p className="card-kicker">Why shop here?</p>
              <h2>Premium gear, direct guidance, and a more elevated buying experience.</h2>
              <ul className="bullet-list hero-bullet-list">
                <li>Curated gear from pros</li>
                <li>30+ years of hands-on expertise</li>
                <li>California-based brand support</li>
                <li>Direct connection to the founder</li>
              </ul>
            </div>

            <div className="hero-mini-card">
              <p className="card-kicker">Built for</p>
              <strong>Players, teachers, rehearsals, and event-ready setups.</strong>
              <p>
                Whether you are buying for your own kit or planning local support, the experience is
                designed to feel considered and premium.
              </p>
            </div>
          </div>
        </div>
      </section>

      <AboutSection />
    </>
  );
}
