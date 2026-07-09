import { Link } from 'react-router-dom';

const services = [
  {
    kicker: 'Precision care',
    icon: '✦',
    title: 'Instrument repair',
    href: '/services/instrument-repair-los-angeles',
    body: 'Bring in violins, guitars, rare drums, percussion, hardware, and musician gear for careful repair, tuning, setup, and troubleshooting support.',
    points: [
      'Repair support for violins, guitars, rare drums, and percussion',
      'Troubleshooting for tone, tuning, hardware, pedal, and setup issues',
      'Thoughtful handling for vintage, rare, and sentimental pieces',
    ],
  },
  {
    kicker: 'Session-ready',
    icon: '◌',
    title: 'Instrument rentals',
    href: '/services/instrument-rentals-los-angeles',
    body: 'Reserve local instruments and musician gear for rehearsals, sessions, gigs, classes, and events when you need dependable equipment without buying last-minute.',
    points: [
      'Short-term instrument and gear rental inquiries',
      'Rental support for events, rehearsals, classes, and sessions',
      'Clear availability details before you commit',
    ],
  },
  {
    kicker: 'Creative space',
    icon: '◎',
    title: 'Studio & rehearsal space',
    href: '/services/rehearsal-space-los-angeles',
    body: 'Ask about rental studio and rehearsal space options for bands, teachers, students, creators, and musicians preparing for sessions or shows.',
    points: [
      'Rehearsal space for bands, drummers, classes, and practice',
      'Rental studio support for recording, content, and teaching',
      'Gear, repair, and setup support connected to the space',
    ],
  },
  {
    kicker: 'Tailored support',
    icon: '✺',
    title: 'Teachers & classes',
    href: '/services/music-lessons-los-angeles',
    body: 'Book teachers, lessons, classes, and local consultations when you want practical guidance that matches your instrument, setup, and goals.',
    points: [
      'Music lessons and classes for students and working musicians',
      'Support for drums, rhythm, instruments, and musician development',
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
        title="Local Instrument Services"
        description="Book Sattari Music for local instrument repair, rare drum repair, guitar and violin repair, instrument rentals, rehearsal space, rental studio time, teachers, and music classes in California."
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
          serviceType: [
            'Instrument repair',
            'Instrument rentals',
            'Rehearsal space',
            'Rental studio',
            'Music lessons',
            'Music classes',
            'Local musician support',
          ],
          url: 'https://sattarimusic.com/services',
        }}
      />
      <div className="container services-hero section-header">
        <div className="services-hero-grid">
          <div className="services-copy">
            <p className="eyebrow">Local services</p>
            <h1>Local instrument services built around what you need most</h1>
            <p>
              Whether you need a repair, rental, rehearsal space, studio time, teacher, class, or
              hands-on guidance, you can get local help that feels clear, personal, and easy to
              book.
            </p>
            <div className="hero-actions services-actions">
              <a className="button button-solid" href="#service-inquiry">
                Request local support
              </a>
              <Link className="button button-outline" to="/los-angeles-music-store">
                Explore the local hub
              </Link>
            </div>
            <div className="services-pills" aria-label="Service highlights">
              <Link className="service-pill" to="/services/instrument-repair-los-angeles">
                Instrument repair
              </Link>
              <Link className="service-pill" to="/services/rehearsal-space-los-angeles">
                Rehearsal space
              </Link>
              <Link className="service-pill" to="/services/music-lessons-los-angeles">
                Teachers & classes
              </Link>
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
              will help you get back to playing, rehearsing, teaching, recording, or performing
              faster.
            </p>
            <div className="services-stats">
              <div>
                <strong>4 service lanes</strong>
                <span>repairs, rentals, space, teachers/classes</span>
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
          <Link
            className="info-card service-card interactive-card-link"
            to={service.href || '#service-inquiry'}
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
          </Link>
        ))}
      </div>

      <div className="container services-location" id="visit">
        <div className="services-location-copy">
          <p className="card-kicker">Visit the shop</p>
          <h2>SATTARI Musical Instruments</h2>
          <p className="services-location-address">
            4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364
          </p>
          <p>
            Come in to play the gear, talk through a repair, or plan a rental, lesson, or session in
            person. Serving Woodland Hills and the greater San Fernando Valley.
          </p>
          <div className="services-location-actions">
            <a
              className="button button-solid"
              href="https://www.google.com/maps/dir//SATTARI+Musical+Instruments,+4881+Topanga+Canyon+Blvd+%23202,+Woodland+Hills,+CA+91364"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions
            </a>
            <a
              className="button button-outline"
              href="https://www.google.com/maps/search/?api=1&query=SATTARI+Musical+Instruments+Woodland+Hills"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on Google
            </a>
          </div>
        </div>
        <div className="services-map">
          <iframe
            title="Map to SATTARI Musical Instruments in Woodland Hills"
            src="https://www.google.com/maps?q=SATTARI+Musical+Instruments,+4881+Topanga+Canyon+Blvd+%23202,+Woodland+Hills,+CA+91364&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
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
