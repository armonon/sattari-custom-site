import { Link } from 'react-router-dom';
import ServiceInquiryForm from './ServiceInquiryForm';
import { SEO, StructuredData } from '../utils/seo';
import { BUSINESS, PAGE_SEO, breadcrumbSchema, businessSchema } from '../data/siteSeo';
import './LocalSeoPage.css';

const repairFaqs = [
  {
    q: 'Where can I request instrument repair near Encino or Calabasas?',
    a: `Sattari Music takes repair inquiries at our Woodland Hills location: ${BUSINESS.addressLine}. Call ${BUSINESS.phoneDisplay} or send a request before bringing your instrument. We do not have separate Encino or Calabasas branches.`,
  },
  {
    q: 'Which instruments can I ask about?',
    a: 'We take inquiries for guitars, bass, violins, drums, percussion and musician hardware. Describe the instrument and the issue so the team can confirm whether the work is within scope. Rare or specialist repairs require individual assessment.',
  },
  {
    q: 'How much will an instrument repair cost?',
    a: 'Cost depends on the instrument, work and any parts needed. An inquiry starts the assessment; it is not a fixed quote. The team will discuss the proposed work and price before you approve it.',
  },
  {
    q: 'Can my instrument be ready before a gig or lesson?',
    a: 'Include your deadline in the request. Turnaround depends on the assessment, parts and workload, so same-day service is not guaranteed. Confirm a completion estimate with the team before making plans.',
  },
];

const repairServices = [
  'Violin, guitar, bass, and string-instrument troubleshooting',
  'Rare drum, vintage drum, snare, kick, tom, and full-kit repair support',
  'Drum tuning for recording, rehearsal, and live performance',
  'Pedal, stand, throne, case, and hardware fixes',
  'Head, string, part, setup, tone, and playability checks',
  'Percussion and unusual instrument support when the issue needs a careful local look',
];

const repairSignals = [
  'Rattles, buzzes, loose hardware, stripped parts, or unstable stands',
  'Strings, bridges, tuning, tone, or playability issues that need a careful check',
  'A rare, vintage, or sentimental instrument that needs thoughtful handling',
  'Pedals, stands, cases, or accessories that feel noisy, loose, or inconsistent',
];

export default function RepairPage() {
  return (
    <section className="section page-header-offset services-shell repair-shell">
      <SEO {...PAGE_SEO.repair} />
      <StructuredData
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Local services', path: '/services' },
          { name: 'Instrument repair', path: '/services/instrument-repair-los-angeles' },
        ])}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: repairFaqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Sattari Music Instrument Repair',
          description: PAGE_SEO.repair.description,
          provider: { '@id': businessSchema['@id'] },
          areaServed: BUSINESS.areas,
          serviceType: [
            'Instrument repair',
            'Violin repair',
            'Guitar repair',
            'Rare drum repair',
            'Vintage drum repair',
            'Drum repair',
            'Drum tuning',
            'Pedal repair',
            'Hardware repair',
            'Percussion repair',
          ],
          url: 'https://sattarimusic.com/services/instrument-repair-los-angeles',
        }}
      />

      <nav className="container local-seo-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link to="/">Home</Link>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
          </li>
          <li>
            <Link to="/services">Local services</Link>
            <span className="crumb-sep" aria-hidden="true">
              /
            </span>
          </li>
          <li>
            <span aria-current="page">Instrument repair</span>
          </li>
        </ol>
      </nav>

      <div className="container repair-hero">
        <div className="repair-hero-copy">
          <p className="eyebrow">Los Angeles instrument repair</p>
          <h1>Instrument repair in Woodland Hills</h1>
          <p>
            Sattari Music helps local musicians diagnose, repair, tune, and dial in instruments and
            performance gear for Woodland Hills, Encino, Calabasas, and Los Angeles musicians — from
            everyday fixes to rare or sentimental pieces that need thoughtful care.
          </p>
          <div className="hero-actions services-actions">
            <a className="button button-solid" href="#repair-inquiry">
              Request a repair check
            </a>
            <Link className="button button-outline" to="/services">
              View all local services
            </Link>
          </div>
        </div>

        <div className="repair-callout-card">
          <p className="card-kicker">Repair focus</p>
          <h2>Fast clarity before you spend money.</h2>
          <p>
            Tell us what is wrong, send photos if needed when we reply, and we’ll point you toward
            the best next step: repair, tune-up, replacement part, setup adjustment, or a deeper
            inspection.
          </p>
          <div className="repair-mini-stats" aria-label="Repair service highlights">
            <span>Violins</span>
            <span>Guitars</span>
            <span>Rare drums</span>
            <span>Hardware</span>
          </div>
        </div>
      </div>

      <div className="container repair-grid">
        <article className="info-card repair-info-card">
          <p className="card-kicker">What we help with</p>
          <h2>Local repair support for the problems that stop the session.</h2>
          <ul className="service-list repair-list">
            {repairServices.map((service) => (
              <li key={service}>{service}</li>
            ))}
          </ul>
        </article>

        <article className="info-card repair-info-card">
          <p className="card-kicker">Good time to reach out</p>
          <h2>If your instrument or gear feels off, we can help diagnose it.</h2>
          <ul className="service-list repair-list">
            {repairSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="container repair-process-panel">
        <div>
          <p className="eyebrow">Simple process</p>
          <h2>Send the issue. Get a clear next step.</h2>
        </div>
        <div className="repair-process-steps">
          <div>
            <strong>1</strong>
            <span>Describe the instrument, gear, or rare piece and what is happening.</span>
          </div>
          <div>
            <strong>2</strong>
            <span>We reply with what to check, bring, or send photos of.</span>
          </div>
          <div>
            <strong>3</strong>
            <span>We schedule the repair, tune-up, setup, or inspection.</span>
          </div>
        </div>
      </div>

      <div className="container service-form-shell" id="repair-inquiry">
        <div className="service-form-copy section-header narrow">
          <p className="eyebrow">Start a repair request</p>
          <h2>Tell us what needs fixing and we’ll help you find the right next step.</h2>
          <p>
            Include the instrument or hardware, what changed, any sounds or symptoms, and when you
            need it ready.
          </p>
        </div>
        <ServiceInquiryForm initialService="repairs" source="Instrument repair landing page" />
      </div>

      <div className="container local-seo-faq">
        <div className="section-header narrow">
          <h2>Instrument repair questions</h2>
        </div>
        <div className="faq-list">
          {repairFaqs.map((faq) => (
            <details className="faq-item" key={faq.q}>
              <summary className="faq-question">{faq.q}</summary>
              <p className="faq-answer">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
      <section className="container category-local-help">
        <h2>More about your instrument</h2>
        <nav aria-label="Instrument-specific services">
          <Link to="/services/violin-repair-los-angeles">Violin repair and setup</Link>
          <Link to="/services/guitar-setup-los-angeles">Guitar and bass setup</Link>
          <Link to="/woodland-hills-drum-shop">Woodland Hills drum gear</Link>
        </nav>
        <p>
          {BUSINESS.name}: {BUSINESS.addressLine}. {BUSINESS.shopHoursNote}
        </p>
        <div className="local-contact-links">
          <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>
          <a href={BUSINESS.directions} target="_blank" rel="noopener noreferrer">
            Get directions
          </a>
        </div>
      </section>
    </section>
  );
}
