import { Link } from 'react-router-dom';
import ServiceInquiryForm from './ServiceInquiryForm';
import { SEO, StructuredData } from '../utils/seo';

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
      <SEO
        title="Instrument Repair in Los Angeles"
        description="Book Sattari Music for local instrument repair, violin repair, guitar repair, rare drum repair, drum tuning, pedal repair, hardware fixes, and musician gear support in Los Angeles and the San Fernando Valley."
        url="https://sattarimusic.com/services/instrument-repair-los-angeles"
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Sattari Music Instrument Repair',
          provider: {
            '@type': 'Organization',
            name: 'Sattari Music',
            url: 'https://sattarimusic.com',
          },
          areaServed: ['Los Angeles', 'San Fernando Valley', 'Woodland Hills', 'California'],
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

      <div className="container repair-hero">
        <div className="repair-hero-copy">
          <p className="eyebrow">Los Angeles instrument repair</p>
          <h1>Instrument repair for violins, guitars, rare drums, hardware, and musician gear.</h1>
          <p>
            Sattari Music helps local musicians diagnose, repair, tune, and dial in instruments and
            performance gear across the Los Angeles and San Fernando Valley area — from everyday
            fixes to rare or sentimental pieces that need thoughtful care.
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
    </section>
  );
}
