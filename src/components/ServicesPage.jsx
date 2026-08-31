import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  DoorOpen,
  GraduationCap,
  MapPin,
  Phone,
  Wrench,
} from 'lucide-react';
import ServiceInquiryForm from './ServiceInquiryForm';
import { SEO, StructuredData } from '../utils/seo';

const services = [
  {
    value: 'repairs',
    kicker: 'Precision care',
    icon: Wrench,
    title: 'Instrument repair',
    short: 'Setups, tuning, hardware fixes, and troubleshooting.',
    href: '/services/instrument-repair-los-angeles',
    body: 'Bring in guitars, violins, rare drums, percussion, hardware, pedals, and musician gear for careful diagnosis and repair.',
    points: ['Setup and tuning', 'Hardware and tone issues', 'Rare or sentimental instruments'],
  },
  {
    value: 'rentals',
    kicker: 'Session-ready',
    icon: CalendarClock,
    title: 'Instrument rentals',
    short: 'Gear for rehearsals, sessions, gigs, classes, and events.',
    href: '/services/instrument-rentals-los-angeles',
    body: 'Tell us what you need and when. We will confirm local availability before you commit.',
    points: ['Short-term gear rentals', 'Event and session support', 'Clear availability details'],
  },
  {
    value: 'rehearsal',
    kicker: 'Creative space',
    icon: DoorOpen,
    title: 'Studio & rehearsal',
    short: 'Space for bands, lessons, practice, recording, and content.',
    href: '/services/rehearsal-space-los-angeles',
    body: 'Request a rehearsal or rental studio setup for your band, class, practice session, recording, or content shoot.',
    points: ['Band and drum rehearsal', 'Recording and content', 'Teaching and practice'],
  },
  {
    value: 'lessons',
    kicker: 'Tailored support',
    icon: GraduationCap,
    title: 'Teachers & classes',
    short: 'Practical instruction matched to your instrument and goals.',
    href: '/services/music-lessons-los-angeles',
    body: 'Find local lessons, classes, and guidance for your instrument, rhythm, setup, and next musical goal.',
    points: [
      'Private lessons and classes',
      'Rhythm and instrument support',
      'Goal-based recommendations',
    ],
  },
];

const directionsUrl =
  'https://www.google.com/maps/dir//SATTARI+Musical+Instruments,+4881+Topanga+Canyon+Blvd+%23202,+Woodland+Hills,+CA+91364';

export default function ServicesPage() {
  const [selectedService, setSelectedService] = useState(services[0]);

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

      <div className="container services-intake">
        <header className="services-intake-header">
          <div className="services-intake-title">
            <p className="eyebrow">Sattari local services</p>
            <h1>What do you need help with?</h1>
            <p>
              Choose a service and send the essentials. We will reply with availability and the next
              step.
            </p>
          </div>

          <div className="services-contact-actions" aria-label="Contact Sattari Music">
            <a className="services-contact-action" href="tel:+14244653020">
              <Phone size={19} aria-hidden="true" />
              <span>
                Call the shop
                <strong>(424) 465-3020</strong>
              </span>
            </a>
            <a
              className="services-contact-action"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={19} aria-hidden="true" />
              <span>
                Get directions
                <strong>Woodland Hills</strong>
              </span>
            </a>
          </div>
        </header>

        <div className="services-workspace">
          <section className="services-picker" aria-labelledby="service-picker-title">
            <div className="services-pane-heading">
              <span className="services-step-badge" aria-hidden="true">
                1
              </span>
              <div>
                <h2 id="service-picker-title">Choose a service</h2>
                <p>Select the closest match. We can adjust it after you send.</p>
              </div>
            </div>

            <div className="services-picker-list">
              {services.map((service) => {
                const Icon = service.icon;
                const isSelected = selectedService.value === service.value;

                return (
                  <button
                    className={`services-picker-option${isSelected ? ' is-selected' : ''}`}
                    type="button"
                    key={service.value}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedService(service)}
                  >
                    <span className="services-picker-icon" aria-hidden="true">
                      <Icon size={20} />
                    </span>
                    <span className="services-picker-copy">
                      <strong>{service.title}</strong>
                      <small>{service.short}</small>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            <div className="services-selection" aria-live="polite">
              <div className="services-selection-heading">
                <div>
                  <p className="card-kicker">{selectedService.kicker}</p>
                  <h3>{selectedService.title}</h3>
                </div>
                <Link
                  to={selectedService.href}
                  aria-label={`View ${selectedService.title} details`}
                >
                  Details
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <p>{selectedService.body}</p>
              <ul>
                {selectedService.points.map((point) => (
                  <li key={point}>
                    <Check size={15} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section
            className="services-request"
            id="service-inquiry"
            aria-labelledby="service-request-title"
          >
            <div className="services-pane-heading">
              <span className="services-step-badge" aria-hidden="true">
                2
              </span>
              <div>
                <h2 id="service-request-title">Send your request</h2>
                <p>Share the timing and a few useful details. No commitment required.</p>
              </div>
            </div>
            <ServiceInquiryForm
              compact
              initialService={selectedService.value}
              source="Local services action page"
            />
          </section>
        </div>

        <aside className="services-visit-bar" id="visit">
          <span className="services-visit-icon" aria-hidden="true">
            <MapPin size={21} />
          </span>
          <div className="services-visit-copy">
            <h2>Visit SATTARI Musical Instruments</h2>
            <p>4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364</p>
          </div>
          <div className="services-visit-actions">
            <a
              className="button button-solid"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={17} aria-hidden="true" />
              Get directions
            </a>
            <a className="button button-outline" href="tel:+14244653020">
              <Phone size={17} aria-hidden="true" />
              Call shop
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}
