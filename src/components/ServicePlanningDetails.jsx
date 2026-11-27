import { Link } from 'react-router-dom';
import { BUSINESS } from '../data/siteSeo';
import './ServicePlanningDetails.css';

const PLANNING = {
  repairs: {
    title: 'Choose the right kind of instrument care',
    cards: [
      [
        'String replacement',
        'For a guitar, send the model, gauge and usual tuning. For a violin, include the size, string name and end fitting. Tell us if you have your own set or want us to supply the replacement.',
      ],
      [
        'Setup and playability',
        'Describe buzzing, uncomfortable action or tuning trouble. The team reviews the instrument before recommending adjustments, parts or further work.',
      ],
      [
        'Repair assessment',
        'Send the model, symptoms and deadline. Confirm the supported work, estimate and timing before approving a repair or arranging your visit.',
      ],
    ],
    note: 'Tell us about previous repairs or modifications. For structural work, electronics, bow work or restoration, we will confirm whether we can take the instrument and what an assessment would cover.',
    links: [
      ['Guitar and bass setup', '/services/guitar-setup-los-angeles'],
      ['Guitar string replacement prices', '/services/guitar-restringing-woodland-hills'],
      ['Violin string fitting and quotes', '/services/violin-restringing-woodland-hills'],
      ['Violin repair and setup', '/services/violin-repair-los-angeles'],
    ],
  },
  rentals: {
    title: 'Plan your rental before the date',
    cards: [
      [
        'Tell us the exact gear',
        'Include instrument type, size or model, quantity, and any case, stand or other equipment you need. Availability is confirmed for your request.',
      ],
      [
        'Give pickup and return dates',
        'Share the event or session, collection and return dates, and location. Ask whether collection or any delivery arrangement fits your plans.',
      ],
      [
        'Confirm the full terms',
        'Ask for the rental period and price, deposit, included equipment, damage responsibility and cancellation terms before committing.',
      ],
    ],
    note: 'The online retail catalog shows products for sale. Contact the shop to confirm which instruments are available to rent for your dates.',
    links: [
      ['Compare instruments for sale', '/shop'],
      ['Local service options', '/services'],
    ],
  },
  lessons: {
    title: 'Find guidance that fits your goals',
    cards: [
      [
        'Your instrument and starting point',
        'Tell us the instrument, experience level and what you would like to play. For a child, a parent or guardian can start the inquiry.',
      ],
      [
        'Your preferred lesson',
        'Share the lesson format, length, schedule and location you are looking for. Ask which teachers and instruments are currently available.',
      ],
      [
        'Agree on the details',
        'Confirm the teacher, session price, equipment, scheduling and cancellation terms before arranging a lesson.',
      ],
    ],
    note: 'Teacher connections and classes are arranged by inquiry. Sattari Learn is a separate free browser practice preview; using it does not book a teacher.',
    links: [
      ['Try Sattari Learn', '/learn'],
      ['Beginner instrument guides', '/guides'],
      ['Ask about instrument rentals', '/services/instrument-rentals-los-angeles'],
    ],
  },
  rehearsal: {
    title: 'Make sure the room fits your session',
    cards: [
      [
        'Date, time and group size',
        'Call with your preferred date, session length, number of people and purpose: rehearsal, recording, teaching or content.',
      ],
      [
        'Equipment and access',
        'Confirm the room capacity, instruments, amps, microphones or PA you need, what is included, and what you should bring. Ask about loading and access before arriving.',
      ],
      [
        'Price and confirmation',
        'Published rates are $25 per hour or $60 for a four-hour block. Confirm availability, total price, payment, cancellation and arrival arrangements with the shop.',
      ],
    ],
    note: 'Recording equipment or an engineer should be confirmed for your session. Studio and rehearsal hours are separate from appointment-only shop visits.',
    links: [
      ['Rehearsal space', '/services/rehearsal-space-los-angeles'],
      ['Recording-space inquiries', '/services/recording-studio-rental-los-angeles'],
    ],
  },
};

export default function ServicePlanningDetails({ service = 'repairs' }) {
  const details = PLANNING[service === 'studio' ? 'rehearsal' : service];
  if (!details) return null;
  return (
    <section className="service-planning" aria-label={details.title}>
      <h2>{details.title}</h2>
      <div className="service-planning-grid">
        {details.cards.map(([title, copy]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <p>{details.note}</p>
      <nav aria-label="Related service help">
        {details.links.map(([label, path]) => (
          <Link key={path} to={path}>
            {label}
          </Link>
        ))}
        <a href={BUSINESS.phoneHref}>Call {BUSINESS.phoneDisplay}</a>
      </nav>
    </section>
  );
}
