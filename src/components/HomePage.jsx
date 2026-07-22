import { Link } from 'react-router-dom';
import AboutSection from './AboutSection';
import OptimizedProductImage from './OptimizedProductImage';
import { SEO, OrganizationSchema } from '../utils/seo';

export default function HomePage() {
  return (
    <>
      <SEO
        title="Instruments, Gear & Local Music Services"
        description="Sattari Music is a home for all musicians — handcrafted cymbals and drums, violins, guitars, bass, and accessories, plus local repairs, rentals, lessons, and studio time in California."
        url="https://sattarimusic.com/"
      />
      <OrganizationSchema />
      <section className="hero-section hero-shell">
        <div className="container hero-grid hero-premium-grid">
          <div className="hero-copy-panel">
            <div className="hero-kicker-row">
              <p className="eyebrow">California instrument craft</p>
              <Link to="/services" className="hero-status-pill hero-status-pill-link">
                California-crafted support
              </Link>
            </div>
            <h1>A home for all musicians.</h1>
            <p className="hero-copy">
              Handcrafted cymbals and drums, violins, guitars, bass, and the accessories that
              complete your setup — plus local repairs, rentals, lessons, and studio time.
            </p>
            <div className="hero-actions">
              <Link to="/shop" className="button button-solid">
                Shop instruments &amp; gear
              </Link>
              <Link to="/services" className="button button-outline">
                Services & Rentals
              </Link>
            </div>

            <div className="hero-quick-links" aria-label="Popular paths">
              <Link to="/shop/cymbals">Cymbals</Link>
              <Link to="/shop/sticks">Sticks</Link>
              <Link to="/shop/violins">Violins</Link>
              <Link to="/shop/guitar-bass">Guitar &amp; Bass</Link>
              <Link to="/shop/essentials">Practice essentials</Link>
            </div>
          </div>

          <div className="hero-card-stack">
            <Link
              to="/shop"
              className="hero-card hero-card-feature interactive-card-link"
              aria-label="Shop premium drum gear"
            >
              <p className="card-kicker">Why shop here?</p>
              <h2>Premium gear, direct guidance, and a more elevated buying experience.</h2>
              <ul className="bullet-list hero-bullet-list">
                <li>Curated gear from pros</li>
                <li>30+ years of hands-on expertise</li>
                <li>California-based brand support</li>
                <li>Direct connection to the founder</li>
              </ul>
            </Link>

            <Link
              to="/services"
              className="hero-mini-card interactive-card-link"
              aria-label="Explore services for players, teachers, rehearsals, and events"
            >
              <p className="card-kicker">Built for</p>
              <strong>Players, teachers, rehearsals, and event-ready setups.</strong>
              <p>
                Whether you are buying for your own kit or planning local support, the experience is
                designed to feel considered and premium.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <AboutSection />

      <section className="section hero-metrics-section">
        <div className="container">
          <div className="hero-metrics hero-metrics-image" aria-label="Storefront highlights">
            <Link
              to="/services"
              className="hero-metric-card hero-metric-card-image interactive-card-link"
              aria-label="Learn about direct founder insight through local services"
            >
              <OptimizedProductImage
                src="/sattari site/crash.png"
                alt=""
                loading="lazy"
                sizes="(max-width: 760px) 100vw, 33vw"
              />
            </Link>
            <Link
              to="/shop"
              className="hero-metric-card hero-metric-card-image interactive-card-link"
              aria-label="Browse the shop for fast gear discovery"
            >
              <OptimizedProductImage
                src="/sattari site/violins/brescia-acoustic.jpg"
                alt=""
                loading="lazy"
                sizes="(max-width: 760px) 100vw, 33vw"
              />
            </Link>
            <Link
              to="/services"
              className="hero-metric-card hero-metric-card-image interactive-card-link"
              aria-label="Request local drum support"
            >
              <OptimizedProductImage
                src="/sattari site/guitars/bass-guitar.jpg"
                alt=""
                loading="lazy"
                sizes="(max-width: 760px) 100vw, 33vw"
              />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
