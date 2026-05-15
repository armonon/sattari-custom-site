import { Link } from 'react-router-dom';
import ServiceInquiryForm from './ServiceInquiryForm';
import { SEO, StructuredData } from '../utils/seo';

type PageKey =
  | 'music-store'
  | 'instruments'
  | 'accessories'
  | 'instrument-rentals'
  | 'rehearsal-space'
  | 'recording-studio'
  | 'music-lessons';

interface LocalSeoPageProps {
  pageKey: PageKey;
}

const pages = {
  'music-store': {
    eyebrow: 'Los Angeles music store',
    title:
      'A local music store for instruments, accessories, repairs, rentals, classes, and studio space.',
    seoTitle: 'Los Angeles Music Store',
    description:
      'Shop Sattari Music for instruments, accessories, instrument repair, rentals, rehearsal space, studio rental, teachers, and music classes in Los Angeles and the San Fernando Valley.',
    url: 'https://sattarimusic.com/los-angeles-music-store',
    schemaType: 'MusicStore',
    schemaName: 'Sattari Music Store',
    intro:
      'Sattari Music is built as a local musician hub: instruments and accessories for sale, repairs for all kinds of gear, rentals, rehearsal space, studio support, teachers, and classes.',
    highlights: ['Instruments', 'Accessories', 'Repairs', 'Rentals', 'Studio', 'Classes'],
    offerings: [
      'Instrument and accessory sales for players, students, and working musicians',
      'Repair support for violins, guitars, rare drums, percussion, hardware, and musician gear',
      'Rental studio and rehearsal space options for practice, sessions, and events',
      'Teachers and classes for musicians who want guided local support',
    ],
    goodFor: [
      'Finding gear locally instead of guessing online',
      'Getting an instrument repaired, tuned, or checked before a session',
      'Booking space for rehearsal, recording, lessons, or music classes',
      'Connecting with a California-based music brand that can support the whole setup',
    ],
    primaryCta: { label: 'Shop current gear', to: '/shop' },
    secondaryCta: { label: 'Request local support', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Los Angeles music store SEO page',
  },
  instruments: {
    eyebrow: 'Instruments in Los Angeles',
    title: 'Shop instruments through Sattari Music and ask about the gear you need next.',
    seoTitle: 'Instruments for Sale in Los Angeles',
    description:
      'Shop instruments through Sattari Music in Los Angeles, including drums, percussion, guitars, violins, and musician gear availability by request.',
    url: 'https://sattarimusic.com/shop/instruments-los-angeles',
    schemaType: 'Store',
    schemaName: 'Sattari Music Instruments',
    intro:
      'Sattari sells instruments and musician gear, with current online inventory plus local support for requests, sourcing, repairs, setup, rentals, and classes.',
    highlights: ['Drums', 'Percussion', 'Guitars', 'Violins', 'Student gear', 'Pro gear'],
    offerings: [
      'Instruments for students, working musicians, producers, and collectors',
      'Drums, percussion, string instruments, and specialty gear support',
      'Local guidance when you need the right instrument, not just another listing',
      'Repair, setup, and rental support connected to the same Sattari service flow',
    ],
    goodFor: [
      'Players looking for instruments in the Los Angeles / Valley area',
      'Parents or students who need guidance before buying',
      'Musicians who want help sourcing, repairing, or setting up gear',
      'Rare, vintage, or unusual instrument questions that need a human check',
    ],
    primaryCta: { label: 'Shop current catalog', to: '/shop' },
    secondaryCta: { label: 'Ask about an instrument', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Instruments Los Angeles SEO page',
  },
  accessories: {
    eyebrow: 'Music accessories in Los Angeles',
    title: 'Accessories, essentials, and replacement gear for musicians who need to stay ready.',
    seoTitle: 'Music Accessories in Los Angeles',
    description:
      'Shop music accessories, drum essentials, sticks, cymbal felts, practice pads, hardware support, and musician gear through Sattari Music in Los Angeles.',
    url: 'https://sattarimusic.com/shop/accessories-los-angeles',
    schemaType: 'Store',
    schemaName: 'Sattari Music Accessories',
    intro:
      'From sticks and practice pads to hardware, cases, setup essentials, and replacement parts, Sattari helps local musicians keep their gear ready.',
    highlights: ['Sticks', 'Pads', 'Hardware', 'Cases', 'Parts', 'Essentials'],
    offerings: [
      'Drumsticks, practice pads, cymbal felts, and daily-use essentials',
      'Accessory guidance for rehearsal, recording, performance, and lessons',
      'Hardware and replacement-part support when something breaks or goes missing',
      'Local service connection for repairs, setup checks, and gear questions',
    ],
    goodFor: [
      'Musicians replacing everyday accessories before a session or show',
      'Students building a practice setup',
      'Drummers and percussionists needing sticks, pads, felts, and hardware support',
      'Players who want local help choosing what actually fits their setup',
    ],
    primaryCta: { label: 'Shop accessories', to: '/shop/essentials' },
    secondaryCta: { label: 'Ask about accessories', href: '#local-inquiry' },
    formService: 'accessories',
    formSource: 'Accessories Los Angeles SEO page',
  },
  'instrument-rentals': {
    eyebrow: 'Instrument rentals in Los Angeles',
    title:
      'Rent instruments and musician gear for rehearsals, sessions, gigs, classes, and events.',
    seoTitle: 'Instrument Rentals in Los Angeles',
    description:
      'Request instrument rentals, drum rentals, musician gear rentals, and local rental support through Sattari Music in Los Angeles and the San Fernando Valley.',
    url: 'https://sattarimusic.com/services/instrument-rentals-los-angeles',
    schemaType: 'Service',
    schemaName: 'Sattari Music Instrument Rentals',
    intro:
      'When you need reliable gear without buying it last-minute, Sattari can help with rental options for local musicians, rehearsals, sessions, classes, and events.',
    highlights: [
      'Instrument rentals',
      'Gear rentals',
      'Events',
      'Sessions',
      'Classes',
      'Local pickup',
    ],
    offerings: [
      'Instrument and musician gear rental inquiries for local needs',
      'Rental support for rehearsals, classes, recording sessions, gigs, and events',
      'Clear availability guidance before you commit',
      'Connection to repair/setup support if the gear needs to be performance-ready',
    ],
    goodFor: [
      'Musicians who need gear for one session or event',
      'Teachers or students who need short-term access',
      'Studios, bands, and event organizers filling gear gaps',
      'Local players comparing rent vs buy vs repair',
    ],
    primaryCta: { label: 'Request rental availability', href: '#local-inquiry' },
    secondaryCta: { label: 'View services', to: '/services' },
    formService: 'rentals',
    formSource: 'Instrument rentals SEO page',
  },
  'rehearsal-space': {
    eyebrow: 'Rehearsal space in Los Angeles',
    title: 'Book rehearsal space for bands, drummers, students, teachers, and creative sessions.',
    seoTitle: 'Rehearsal Space in Los Angeles',
    description:
      'Request rehearsal space through Sattari Music for bands, drummers, music students, teachers, classes, and creative sessions in Los Angeles and the San Fernando Valley.',
    url: 'https://sattarimusic.com/services/rehearsal-space-los-angeles',
    schemaType: 'Service',
    schemaName: 'Sattari Music Rehearsal Space',
    intro:
      'Sattari supports musicians who need a practical local place to rehearse, practice, teach, prepare for gigs, or run focused creative sessions.',
    highlights: [
      'Band rehearsal',
      'Practice',
      'Classes',
      'Lessons',
      'Pre-show prep',
      'Creative sessions',
    ],
    offerings: [
      'Rehearsal space requests for bands, solo musicians, drummers, and teachers',
      'Support for classes, private lessons, practice blocks, and creative prep',
      'Gear/rental/repair support connected to the same local musician hub',
      'Clear inquiry flow so timing, setup, and needs can be confirmed first',
    ],
    goodFor: [
      'Bands preparing for shows or recordings',
      'Drummers and instrumentalists who need room to practice',
      'Teachers and students needing a focused local space',
      'Musicians who also need gear, repairs, rentals, or setup help',
    ],
    primaryCta: { label: 'Request rehearsal time', href: '#local-inquiry' },
    secondaryCta: {
      label: 'Ask about studio rental',
      to: '/services/recording-studio-rental-los-angeles',
    },
    formService: 'rehearsal',
    formSource: 'Rehearsal space SEO page',
  },
  'recording-studio': {
    eyebrow: 'Rental studio in Los Angeles',
    title: 'Rental studio support for recording, content, lessons, rehearsals, and music projects.',
    seoTitle: 'Rental Studio in Los Angeles',
    description:
      'Request rental studio time through Sattari Music for recording, rehearsal, lessons, content, classes, and musician projects in Los Angeles and the San Fernando Valley.',
    url: 'https://sattarimusic.com/services/recording-studio-rental-los-angeles',
    schemaType: 'Service',
    schemaName: 'Sattari Music Rental Studio',
    intro:
      'Sattari can support local musicians, teachers, producers, and creators who need a studio-style space for recording, lessons, content, rehearsal, or focused creative work.',
    highlights: ['Recording', 'Content', 'Lessons', 'Classes', 'Rehearsal', 'Creative work'],
    offerings: [
      'Rental studio inquiries for music, content, teaching, and rehearsal needs',
      'Support for artists, teachers, bands, students, and creators',
      'Connection to Sattari gear, rentals, repairs, and local musician services',
      'Inquiry-first scheduling so setup and availability can be confirmed clearly',
    ],
    goodFor: [
      'Artists preparing demos, content, lessons, or performances',
      'Teachers needing a polished space for instruction or classes',
      'Producers and musicians who need a local creative room',
      'Bands or solo players who need rehearsal and recording support together',
    ],
    primaryCta: { label: 'Request studio time', href: '#local-inquiry' },
    secondaryCta: {
      label: 'Ask about rehearsal space',
      to: '/services/rehearsal-space-los-angeles',
    },
    formService: 'studio',
    formSource: 'Rental studio SEO page',
  },
  'music-lessons': {
    eyebrow: 'Music teachers and classes in Los Angeles',
    title: 'Teachers, lessons, and music classes for players who want practical guidance.',
    seoTitle: 'Music Lessons & Classes in Los Angeles',
    description:
      'Request music teachers, lessons, classes, drum lessons, instrument lessons, and local musician support through Sattari Music in Los Angeles and the San Fernando Valley.',
    url: 'https://sattarimusic.com/services/music-lessons-los-angeles',
    schemaType: 'Service',
    schemaName: 'Sattari Music Lessons and Classes',
    intro:
      'Sattari connects musicians with practical teaching support, lessons, classes, instrument guidance, and local help that matches the player’s setup and goals.',
    highlights: ['Teachers', 'Classes', 'Lessons', 'Drums', 'Instruments', 'Beginner to pro'],
    offerings: [
      'Music lessons and classes for students, players, and working musicians',
      'Instrument guidance tied to repairs, rentals, accessories, and practice needs',
      'Support for drums, rhythm, instrument fundamentals, and musician development',
      'Flexible inquiry flow so the right teacher/class path can be recommended',
    ],
    goodFor: [
      'Beginners who need the right start',
      'Players returning to music after time away',
      'Drummers and instrumentalists who need focused coaching',
      'Parents, students, and musicians looking for local guidance',
    ],
    primaryCta: { label: 'Request lessons or classes', href: '#local-inquiry' },
    secondaryCta: { label: 'View local services', to: '/services' },
    formService: 'lessons',
    formSource: 'Music lessons SEO page',
  },
} as const;

function CtaLink({
  cta,
  className,
}: {
  cta: { label: string; to?: string; href?: string };
  className: string;
}) {
  if (cta.to) {
    return (
      <Link className={className} to={cta.to}>
        {cta.label}
      </Link>
    );
  }

  return (
    <a className={className} href={cta.href}>
      {cta.label}
    </a>
  );
}

export default function LocalSeoPage({ pageKey }: LocalSeoPageProps) {
  const page = pages[pageKey];

  return (
    <section className="section page-header-offset services-shell local-seo-shell">
      <SEO title={page.seoTitle} description={page.description} url={page.url} />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': page.schemaType,
          name: page.schemaName,
          description: page.description,
          url: page.url,
          areaServed: ['Los Angeles', 'San Fernando Valley', 'Woodland Hills', 'California'],
          provider: {
            '@type': 'Organization',
            name: 'Sattari Music',
            url: 'https://sattarimusic.com',
          },
        }}
      />

      <div className="container repair-hero local-seo-hero">
        <div className="repair-hero-copy">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p>{page.intro}</p>
          <div className="hero-actions services-actions">
            <CtaLink cta={page.primaryCta} className="button button-solid" />
            <CtaLink cta={page.secondaryCta} className="button button-outline" />
          </div>
        </div>

        <div className="repair-callout-card">
          <p className="card-kicker">Sattari local hub</p>
          <h2>One place for gear, space, repair, and guidance.</h2>
          <p>
            The goal is simple: help local musicians get what they need faster, with a real person
            on the other side of the request.
          </p>
          <div className="repair-mini-stats" aria-label="Local service highlights">
            {page.highlights.map((highlight) => (
              <span key={highlight}>{highlight}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="container repair-grid">
        <article className="info-card repair-info-card">
          <p className="card-kicker">What Sattari offers</p>
          <h2>Built for local musicians who need practical support.</h2>
          <ul className="service-list repair-list">
            {page.offerings.map((offering) => (
              <li key={offering}>{offering}</li>
            ))}
          </ul>
        </article>

        <article className="info-card repair-info-card">
          <p className="card-kicker">Good fit for</p>
          <h2>Use Sattari when you need more than a generic listing.</h2>
          <ul className="service-list repair-list">
            {page.goodFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      <div className="container service-form-shell" id="local-inquiry">
        <div className="service-form-copy section-header narrow">
          <p className="eyebrow">Start the conversation</p>
          <h2>Tell us what you need and we’ll help you find the right next step.</h2>
          <p>
            Share the instrument, accessory, class, rental, studio, rehearsal, or repair request and
            any timing details that matter.
          </p>
        </div>
        <ServiceInquiryForm initialService={page.formService} source={page.formSource} />
      </div>
    </section>
  );
}
