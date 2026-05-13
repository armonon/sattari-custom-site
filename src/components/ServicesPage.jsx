import { Link } from 'react-router-dom';

const services = [
  {
    kicker: 'Precision care',
    icon: '✦',
    title: 'Instrument repair',
    body: 'Bring your gear in for drum repair, hardware fixes, setup adjustments, and maintenance that helps your kit feel solid, responsive, and performance-ready.',
    points: [
      'Tune-up support for stands, pedals, and hardware',
      'Troubleshooting for snare, pedal, and stand issues',
      'Setup refinement so your kit feels ready to play',
    ],
  },
  {
    kicker: 'Session-ready',
    icon: '◌',
    title: 'Rentals',
    body: 'Reserve local gear rentals for rehearsals, sessions, gigs, and events when you need dependable equipment without the last-minute scramble.',
    points: [
      'Flexible local pickup and return timing',
      'Rental options for events, rehearsals, and sessions',
      'Clear availability details before you commit',
    ],
  },
  {
    kicker: 'Tailored support',
    icon: '◎',
    title: 'Lessons or local support',
    body: 'Book lessons, local consultations, or event support when you want practical guidance that matches your setup, goals, and playing needs.',
    points: [
      'One-on-one coaching and musician guidance',
      'Support for local event and performance needs',
      'Recommendations tailored to your setup and goals',
    ],
  },
];

import ServiceInquiryForm from './ServiceInquiryForm';
import { SEO, StructuredData } from '../utils/seo';

export default function ServicesPage() {
  return (
    <section className="section page-header-offset services-shell">
      <SEO
        title="Local Drum Services"
        description="Book Sattari Music for local drum repair, rentals, lessons, and musician support in California."
        url="https://sattarimusic.com/services"
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Sattari Music Local Services',
          provider: {
            '@type': 'Organization',
            name: 'Sattari Music',
          },
          areaServed: 'California',
          serviceType: ['Instrument repair', 'Rentals', 'Lessons', 'Local musician support'],
          url: 'https://sattarimusic.com/services',
        }}
      />
      <div className="container services-hero section-header">
        <div className="services-hero-grid">
          <div className="services-copy">
            <p className="eyebrow">Local services</p>
            <h1>Local drum services built around what you need most</h1>
            <p>
              Whether you need a repair, a rental, or hands-on guidance, you can get local help that
              feels clear, personal, and easy to book.
            </p>
            <div className="hero-actions services-actions">
              <a className="button button-solid" href="#service-inquiry">
                Request local support
              </a>
              <Link className="button button-outline" to="/shop">
                Explore the shop
              </Link>
            </div>
            <div className="services-pills" aria-label="Service highlights">
              <a className="service-pill" href="#service-inquiry">
                California-based appointments
              </a>
              <a className="service-pill" href="#service-inquiry">
                Straightforward booking
              </a>
              <a className="service-pill" href="#service-inquiry">
                Repairs, rentals, and lessons
              </a>
            </div>
          </div>

          <a
            className="services-highlight-card interactive-card-link"
            href="#service-inquiry"
            aria-label="Start a local service inquiry"
          >
            <p className="card-kicker">What to expect</p>
            <h2>Clear local help without the guesswork</h2>
            <p>
              You’ll get a simple inquiry flow, a clear response, and support that focuses on what
              will help you get back to playing faster.
            </p>
            <div className="services-stats">
              <div>
                <strong>3 service options</strong>
                <span>repair, rentals, and lessons/support</span>
              </div>
              <div>
                <strong>1 simple inquiry</strong>
                <span>tell us what you need and when</span>
              </div>
              <div>
                <strong>Fast clarity</strong>
                <span>know the next step before you book</span>
              </div>
            </div>
          </a>
        </div>
      </div>

      <div className="container card-grid three-col services-card-grid">
        {services.map((service) => (
          <a
            className="info-card service-card interactive-card-link"
            href="#service-inquiry"
            key={service.title}
            aria-label={`Request help with ${service.title}`}
          >
            <div className="service-card-header">
              <div className="service-icon" aria-hidden="true">
                {service.icon}
              </div>
              <div>
                <p className="card-kicker">{service.kicker}</p>
                <h3>{service.title}</h3>
              </div>
            </div>
            <p>{service.body}</p>
            <ul className="service-list">
              {service.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </a>
        ))}
      </div>

      <div className="container service-form-shell" id="service-inquiry">
        <div className="service-form-copy section-header narrow">
          <p className="eyebrow">Start the conversation</p>
          <h2>Tell us what you need and we’ll help you find the right next step</h2>
          <p>
            Share your timing, your setup, and the kind of help you’re looking for. We’ll use that
            to point you toward the best local service for your situation.
          </p>
        </div>
        <ServiceInquiryForm />
      </div>
    </section>
  );
}
