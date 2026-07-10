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
    faqs: [
      {
        q: 'Where is Sattari Music located?',
        a: 'Sattari Music is based in Woodland Hills and serves Los Angeles and the greater San Fernando Valley. You can visit the shop in person or start any request online.',
      },
      {
        q: 'What can I do at a local music store like Sattari?',
        a: 'Buy instruments and accessories, get gear repaired or set up, arrange rentals, book rehearsal or studio time, and connect with teachers and classes — all through one local hub.',
      },
      {
        q: 'Do I have to buy online, or can I ask first?',
        a: 'You can ask first. Send a request describing what you need and you’ll get a real response with honest guidance before you commit to anything.',
      },
    ],
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
    faqs: [
      {
        q: 'What instruments does Sattari carry?',
        a: 'The catalog centers on handcrafted drums, cymbals, and percussion, plus violins, guitars, and bass, with more available by request. Ask about anything you don’t see listed.',
      },
      {
        q: 'Can you help me source a specific or rare instrument?',
        a: 'Yes. If it’s not in the current catalog, send a request and we’ll help you track down the right instrument or a suitable alternative.',
      },
      {
        q: 'Do you help students and beginners choose gear?',
        a: 'Absolutely. Tell us your level and goals and we’ll point you to gear that fits, along with setup, lessons, or rental options if they’d help.',
      },
    ],
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
    faqs: [
      {
        q: 'What accessories can I get from Sattari?',
        a: 'Drumsticks, practice pads, cymbal felts, hardware, cases, and everyday essentials — plus replacement parts by request.',
      },
      {
        q: 'I broke a part before a session — can you help fast?',
        a: 'Send a request with what you need and your timing, and we’ll tell you what’s available and the quickest way to get it.',
      },
      {
        q: 'Can you recommend accessories for my setup?',
        a: 'Yes. Describe your kit or instrument and how you play, and we’ll suggest what actually fits instead of a generic list.',
      },
    ],
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
    faqs: [
      {
        q: 'What can I rent from Sattari?',
        a: 'Instruments and musician gear for rehearsals, sessions, gigs, classes, and events. Send a request and we’ll confirm what’s available for your dates.',
      },
      {
        q: 'How do rentals work?',
        a: 'Tell us the gear, the dates, and what it’s for. We’ll respond with availability and next steps — no long-term commitment required.',
      },
      {
        q: 'Do you rent for one-off events or single sessions?',
        a: 'Yes. Short-term rentals for a single session or event are welcome, with support if the gear needs to be performance-ready.',
      },
    ],
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
    faqs: [
      {
        q: 'Who is the rehearsal space for?',
        a: 'Bands, drummers, solo players, teachers, and students who need a focused local place to practice, prep for shows, or run creative sessions.',
      },
      {
        q: 'How do I book rehearsal time?',
        a: 'Send a request with your timing and setup needs and we’ll confirm availability and the details before you lock it in.',
      },
      {
        q: 'Can I also get gear or studio time through the same request?',
        a: 'Yes. Rehearsal, rental studio time, gear, rentals, and repairs all connect through the same local hub.',
      },
    ],
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
    faqs: [
      {
        q: 'What can I use the rental studio for?',
        a: 'Recording, content creation, lessons, rehearsals, and focused creative projects for musicians, teachers, and producers.',
      },
      {
        q: 'How do I request studio time?',
        a: 'Send a request describing your project and timing and we’ll respond with availability and setup details.',
      },
      {
        q: 'Do you support teaching and content, not just recording?',
        a: 'Yes. The space suits lessons, classes, and content work as well as music recording.',
      },
    ],
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
    faqs: [
      {
        q: 'What lessons and classes does Sattari offer?',
        a: 'Teacher connections and classes for drums, rhythm, and instrument fundamentals — from first-time beginners to more advanced players.',
      },
      {
        q: 'I’m a total beginner — is that okay?',
        a: 'Definitely. Tell us your goals and your instrument and we’ll recommend the right starting point.',
      },
      {
        q: 'Can lessons connect to gear and rentals?',
        a: 'Yes. Lessons tie into instrument guidance, accessories, rentals, and practice support through the same local flow.',
      },
    ],
  },
} as const;

const ORIGIN = 'https://sattarimusic.com';
const SHOP_NAP =
  'SATTARI Musical Instruments, 4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364';

const toPath = (url: string) => url.replace(ORIGIN, '');

// Sibling local pages, for cross-linking (internal-link + navigation value).
const LOCAL_PAGE_LINKS = (Object.keys(pages) as PageKey[]).map((key) => ({
  key,
  label: pages[key].eyebrow,
  path: toPath(pages[key].url),
}));

// Home → (Shop | Services) → current — drives both the breadcrumb UI and schema.
function getBreadcrumbs(pageKey: PageKey): { label: string; to?: string }[] {
  const page = pages[pageKey];
  const path = toPath(page.url);
  const crumbs: { label: string; to?: string }[] = [{ label: 'Home', to: '/' }];
  if (path.startsWith('/shop')) crumbs.push({ label: 'Shop', to: '/shop' });
  else if (path.startsWith('/services')) crumbs.push({ label: 'Local services', to: '/services' });
  crumbs.push({ label: page.eyebrow });
  return crumbs;
}

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
  const breadcrumbs = getBreadcrumbs(pageKey);

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
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: page.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a },
          })),
        }}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.label,
            item: crumb.to ? `${ORIGIN}${crumb.to === '/' ? '' : crumb.to}` : page.url,
          })),
        }}
      />

      <nav className="container local-seo-breadcrumb" aria-label="Breadcrumb">
        <ol>
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.label}>
              {crumb.to ? (
                <Link to={crumb.to}>{crumb.label}</Link>
              ) : (
                <span aria-current="page">{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 ? (
                <span className="crumb-sep" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </nav>

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

      <div className="container local-seo-faq">
        <div className="section-header narrow">
          <p className="eyebrow">Common questions</p>
          <h2>Local questions, answered</h2>
        </div>
        <div className="faq-list">
          {page.faqs.map((faq) => (
            <details className="faq-item" key={faq.q}>
              <summary className="faq-question">{faq.q}</summary>
              <p className="faq-answer">{faq.a}</p>
            </details>
          ))}
        </div>
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

      <div className="container local-seo-crosslinks">
        <div className="section-header narrow">
          <p className="eyebrow">More local pages</p>
          <h2>Explore more Sattari local services</h2>
        </div>
        <div className="local-seo-link-grid">
          {LOCAL_PAGE_LINKS.filter((link) => link.key !== pageKey).map((link) => (
            <Link
              className="local-seo-link-card interactive-card-link"
              to={link.path}
              key={link.key}
            >
              <span className="local-seo-link-label">{link.label}</span>
              <span className="local-seo-link-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
        <p className="local-seo-nap">
          Serving Los Angeles &amp; the San Fernando Valley — {SHOP_NAP}.
        </p>
      </div>
    </section>
  );
}
