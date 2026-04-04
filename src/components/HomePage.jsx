
import { Link } from 'react-router-dom';
import AboutSection from './AboutSection';

const highlights = [
  {
    title: 'Premium Drum Gear',
    text: 'Curated cymbals, hi-hats, practice pads, and accessories—handpicked for drummers who demand more.',
  },
  {
    title: 'Founder Expertise',
    text: 'Led by Mohammad Sattari, a pro drummer with 30+ years of global experience. Every product and service is chosen with a musician’s eye.',
  },
  {
    title: 'Local Support',
    text: 'Repairs, rentals, and support for California musicians—without losing focus on the drum-first shop.',
  },
];

const productPreview = [
  'Pirouz Series Cymbals',
  'Hi-Hats & Splashes',
  'Practice Pads',
  'Classic Drumsticks & Felts',
];

export default function HomePage() {
  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Premium Drum Gear</p>
            <h1>Drums First. Always.</h1>
            <p className="hero-copy">
              Sattari Music is a California-based brand built for drummers—by drummers. Shop curated gear, get expert repairs, and join a community led by international performer Mohammad Sattari.
            </p>
            <div className="hero-actions">
              <Link to="/shop" className="button button-solid">
                Shop Drum Gear
              </Link>
              <Link to="/services" className="button button-outline">
                Local Services
              </Link>
            </div>
          </div>

          <div className="hero-card">
            <p className="card-kicker">Why Sattari Music?</p>
            <ul className="bullet-list">
              <li>Curated drum essentials</li>
              <li>Founder with 30+ years’ experience</li>
              <li>California-based, globally inspired</li>
              <li>Instagram & community highlights</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container section-header">
          <p className="eyebrow">Brand direction</p>
          <h2>Make the homepage do one job really well</h2>
          <p>
            The current site already proves you sell instruments and have an About page.
            This version turns that into a clearer message: drums first, then services. 
          </p>
        </div>

        <div className="container card-grid three-col">
          {highlights.map((item) => (
            <article className="info-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>


      <AboutSection />
    </>
  );
}
