import { Link } from 'react-router-dom';
import ServiceInquiryForm from './ServiceInquiryForm';
import ServicePlanningDetails from './ServicePlanningDetails';
import OptimizedProductImage from './OptimizedProductImage';
import { useInventory } from '../context/InventoryContext';
import { formatPriceRange } from '../data/catalog';
import { SEO, StructuredData } from '../utils/seo';
import { BUSINESS, businessSchema } from '../data/siteSeo';
import type { Product } from '../types';
import './LocalSeoPage.css';

type PageKey =
  | 'music-store'
  | 'instruments'
  | 'accessories'
  | 'instrument-rentals'
  | 'rehearsal-space'
  | 'recording-studio'
  | 'music-lessons'
  | 'woodland-hills'
  | 'calabasas'
  | 'encino'
  | 'repair-woodland-hills'
  | 'repair-calabasas'
  | 'drums'
  | 'violins'
  | 'guitars'
  | 'woodland-drums'
  | 'encino-violins'
  | 'violin-repair'
  | 'guitar-setup'
  | 'guitar-strings'
  | 'violin-strings'
  | 'guitar-restringing'
  | 'violin-restringing'
  | 'string-replacement';

interface LocalSeoPageProps {
  pageKey: PageKey;
}

export const localSeoPages = {
  'music-store': {
    eyebrow: 'Los Angeles music store',
    title: 'A Los Angeles music store in Woodland Hills',
    seoTitle: 'Los Angeles Music Store | Instruments & Repair',
    description:
      'Find instruments, cymbals, guitars, violins and local music services at Sattari Music in Woodland Hills, serving Los Angeles and the San Fernando Valley.',
    url: 'https://sattarimusic.com/los-angeles-music-store',
    schemaType: 'MusicStore',
    schemaName: 'Sattari Music Store',
    intro:
      'Shop cymbals, drumsticks, violins, guitars and bass from Sattari Music in Woodland Hills. For Los Angeles musicians planning a visit, we also take inquiries for instrument repairs, rentals, lessons and rehearsal space. Confirm the instrument, service and visit time with our team first.',
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
        a: 'Sattari Music is based in Woodland Hills and serves Los Angeles and the greater San Fernando Valley. Shop visits are by appointment only. Call to arrange a visit or start your request online.',
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
    title: 'Musical instruments for sale in Los Angeles',
    seoTitle: 'Instruments for Sale in Los Angeles',
    description:
      'Browse guitars, bass, violins, cymbals and percussion from Sattari Music in Woodland Hills. Shop online or ask about instrument availability in Los Angeles.',
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
    catalogHeading: 'Compare instruments for sale',
    productIds: [
      'steel-string-acoustic-guitar',
      'flame-stratocaster-electric-guitar',
      'five-string-bass-guitar',
      'brescia-acoustic-violin',
      'chiara-wooden-electric-violin',
      'sattari-darbuka',
      'sattari-hand-crafted-hi-hat',
      'pirouz-series-cymbals',
    ],
    primaryCta: { label: 'Shop current catalog', to: '/shop' },
    secondaryCta: { label: 'Ask about an instrument', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Instruments Los Angeles SEO page',
    faqs: [
      {
        q: 'What instruments does Sattari carry?',
        a: 'The catalog includes cymbals, drumsticks, practice pads, darbuka, violins, guitars and bass. Full drum kits and other unlisted instruments need an availability inquiry; they are not guaranteed stock.',
      },
      {
        q: 'Can you help me source a specific or rare instrument?',
        a: 'Send the model, budget and timing. We can discuss whether sourcing or an alternative is possible before you make plans.',
      },
      {
        q: 'Do you help students and beginners choose gear?',
        a: 'Absolutely. Tell us your level and goals and we’ll point you to gear that fits, along with setup, lessons, or rental options if they’d help.',
      },
    ],
  },
  accessories: {
    eyebrow: 'Music accessories in Los Angeles',
    title: 'Music accessories and drum essentials',
    seoTitle: 'Music Accessories & Drum Essentials | Los Angeles',
    description:
      'Find drumsticks, practice pads, cymbal felts and instrument accessories in Los Angeles. Shop Sattari online or contact our Woodland Hills music store.',
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
    title: 'Instrument and gear rentals in Woodland Hills',
    seoTitle: 'Instrument Rentals | Woodland Hills, Los Angeles',
    description:
      'Need instruments or drum gear for a gig, class or rehearsal? Request local rentals from Sattari Music in Woodland Hills. Availability confirmed before booking.',
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
        q: 'How do I arrange a rental?',
        a: 'Tell us the gear, size, dates and purpose. Confirm the available equipment, rental period, total price, deposit and collection/return terms before committing.',
      },
      {
        q: 'Do you rent for one-off events or single sessions?',
        a: 'Yes. Short-term rentals for a single session or event are welcome, with support if the gear needs to be performance-ready.',
      },
    ],
  },
  'rehearsal-space': {
    eyebrow: 'Rehearsal space in Los Angeles',
    title: 'Rehearsal space in Woodland Hills',
    seoTitle: 'Rehearsal Space | Woodland Hills, Los Angeles',
    description:
      'Call about rehearsal space in Woodland Hills: $25 per hour or $60 for four hours. Confirm dates, equipment and arrangements with Sattari before your visit.',
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
    primaryCta: { label: 'Arrange rehearsal time', href: '#local-inquiry' },
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
        a: 'Call (424) 465-3020 with your preferred date, time, session length and group size. Online booking is not open yet. Confirm availability and arrangements with the shop. Published rates are $25 per hour or $60 for four hours.',
      },
      {
        q: 'Can I also get gear or studio time through the same request?',
        a: 'Yes. Rehearsal, rental studio time, gear, rentals, and repairs all connect through the same local hub.',
      },
    ],
  },
  'recording-studio': {
    eyebrow: 'Rental studio in Los Angeles',
    title: 'Studio rental in Woodland Hills',
    seoTitle: 'Recording Studio Rental | Woodland Hills',
    description:
      'Call about studio rental in Woodland Hills for recording, content or teaching. Published rates: $25 per hour or $60 for four hours. Confirm equipment and availability.',
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
    primaryCta: { label: 'Arrange studio time', href: '#local-inquiry' },
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
        a: 'Call (424) 465-3020 with your date, session length and recording needs. Online booking is not open yet. Confirm the equipment, any engineer support, availability and payment arrangements. Published rates are $25 per hour or $60 for four hours.',
      },
      {
        q: 'Do you support teaching and content, not just recording?',
        a: 'Yes. The space suits lessons, classes, and content work as well as music recording.',
      },
    ],
  },
  'music-lessons': {
    eyebrow: 'Music teachers and classes in Los Angeles',
    title: 'Music lessons and classes in Woodland Hills',
    seoTitle: 'Music Lessons near Encino & Calabasas',
    description:
      'Ask about music lessons and classes in Woodland Hills, serving Encino, Calabasas and Los Angeles. Match your instrument, experience and goals with local guidance.',
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
  'woodland-hills': {
    eyebrow: 'Woodland Hills music store',
    title: 'Visit our Woodland Hills music store',
    seoTitle: 'Visit Our Woodland Hills Music Store',
    description:
      'Plan a visit to Sattari Music at 4881 Topanga Canyon Blvd #202 in Woodland Hills. Browse drum gear, violins and guitars, or ask about repairs and lessons.',
    url: 'https://sattarimusic.com/woodland-hills-music-store',
    schemaType: 'MusicStore',
    schemaName: 'Sattari Music — Woodland Hills',
    intro:
      'Our shop is at 4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364. Start with the current catalog for cymbals, drumsticks, violins, guitars and bass, or tell us what needs repairing. Shop visits are by appointment only. Call to arrange your visit and confirm availability.',
    highlights: ['Instruments', 'Drum gear', 'Violins', 'Guitars', 'Repairs', 'Lessons'],
    offerings: [
      'Instrument and gear sales for players across Woodland Hills and the Valley',
      'Repairs, setup, and tuning for drums, strings, guitars, and more',
      'Rentals, rehearsal space, and studio time for local musicians',
      'Teachers and classes for students, hobbyists, and working players',
    ],
    goodFor: [
      'Woodland Hills players who want a real local shop, not just online',
      'Getting an instrument repaired or set up close to home',
      'Families and students starting music in the West Valley',
      'Musicians who want gear, repair, and lessons in one place',
    ],
    primaryCta: { label: 'Shop instruments & gear', to: '/shop' },
    secondaryCta: { label: 'Visit or ask us', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Woodland Hills music store SEO page',
    faqs: [
      {
        q: 'Where is your Woodland Hills location?',
        a: 'Sattari Music is at 4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364, serving Woodland Hills and the surrounding San Fernando Valley.',
      },
      {
        q: 'What can I buy or do at the Woodland Hills shop?',
        a: 'Buy instruments and gear, get repairs and setups, arrange rentals, book rehearsal or studio time, and connect with teachers — all locally.',
      },
      {
        q: 'Do you help beginners and students in Woodland Hills?',
        a: 'Yes. Tell us your goals and we’ll help with the right starter instrument, lessons, and anything you need to get going.',
      },
    ],
  },
  calabasas: {
    eyebrow: 'Music store serving Calabasas',
    title: 'Music gear and instrument support near Calabasas',
    seoTitle: 'Music Store near Calabasas | Guitars & Drum Gear',
    description:
      'Looking for a music store near Calabasas? Shop instruments, cymbals, guitars and violins at Sattari Music in Woodland Hills, with repairs and lesson inquiries.',
    url: 'https://sattarimusic.com/calabasas-music-store',
    schemaType: 'MusicStore',
    schemaName: 'Sattari Music — near Calabasas',
    intro:
      'Buying a first guitar, replacing drumsticks, or arranging an instrument setup? Sattari serves Calabasas from our Woodland Hills shop. Compare the online catalog, tell us the model or service you need, and confirm a visit before bringing an instrument. We do not have a separate Calabasas storefront.',
    highlights: ['Instruments', 'Drum gear', 'Violins', 'Guitars', 'Repairs', 'Lessons'],
    offerings: [
      'Instrument and gear sales for Calabasas-area players and families',
      'Repairs, tuning, and setup for drums, strings, guitars, and more',
      'Rentals, rehearsal space, and studio time close to home',
      'Teachers and classes for students and working musicians',
    ],
    goodFor: [
      'Calabasas players who want a nearby shop instead of a long drive',
      'Students and parents starting lessons or buying a first instrument',
      'Getting gear repaired or set up without shipping it away',
      'Musicians who want sales, service, and lessons in one place',
    ],
    primaryCta: { label: 'Shop instruments & gear', to: '/shop' },
    secondaryCta: { label: 'Ask about visiting', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Calabasas music store SEO page',
    faqs: [
      {
        q: 'Where is the shop for Calabasas customers?',
        a: `Our location is ${BUSINESS.addressLine}. Use the directions link for your route and call to arrange a visit; travel time depends on your starting point and traffic.`,
      },
      {
        q: 'Do you serve Calabasas musicians?',
        a: 'Yes. Players from Calabasas and across the West Valley come in for gear, repairs, rentals, lessons, and studio time.',
      },
      {
        q: 'Can I get an instrument repaired if I live in Calabasas?',
        a: 'Absolutely. Bring it to the Woodland Hills shop, or send a request first and we’ll tell you what to expect.',
      },
    ],
  },
  encino: {
    eyebrow: 'Music store serving Encino',
    title: 'A music store serving Encino musicians',
    seoTitle: 'Music Store near Encino | Instruments & Repairs',
    description:
      'Looking for a music store near Encino? Visit Sattari Music in Woodland Hills for instruments, cymbals, guitars, violins, repair support and lesson inquiries.',
    url: 'https://sattarimusic.com/encino-music-store',
    schemaType: 'MusicStore',
    schemaName: 'Sattari Music',
    intro:
      'Shopping for a first instrument, replacing sticks before a rehearsal, or sorting out a guitar buzz? Encino musicians can browse Sattari online and contact our Woodland Hills shop about the instrument, repair or lesson they need. We are at 4881 Topanga Canyon Blvd #202, not an Encino storefront.',
    highlights: ['Cymbals', 'Guitars & bass', 'Violins', 'Repairs', 'Lessons', 'Rentals'],
    offerings: [
      'Compare acoustic, electric and silent violins, guitars and bass in the online catalog',
      'Choose handcrafted cymbals, drumsticks and practice accessories for your setup',
      'Send repair symptoms and instrument details before bringing gear from Encino',
      'Ask about lesson, rehearsal and rental availability before making plans',
    ],
    goodFor: [
      'Encino students and parents comparing starter instruments and lesson options',
      'Players planning a guitar, violin, drum or hardware repair visit',
      'Drummers building a practice setup or replacing cymbals and sticks',
      'Musicians who want to confirm gear availability with a person before traveling',
    ],
    primaryCta: { label: 'Browse instruments', to: '/shop' },
    secondaryCta: { label: 'Ask before visiting', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Encino music store page',
    faqs: [
      {
        q: 'Is Sattari Music located in Encino?',
        a: 'Our shop is in Woodland Hills at 4881 Topanga Canyon Blvd #202, CA 91364. We serve Encino musicians from that location and through our online catalog.',
      },
      {
        q: 'What should I send before a repair visit from Encino?',
        a: 'Include the instrument, model if known, what is wrong, and when you need it. We will reply about the next step, what to bring, and whether photos would help.',
      },
      {
        q: 'Can I check an instrument or lesson is available before visiting?',
        a: 'Yes. Call (424) 465-3020 or use the inquiry form with the instrument or lesson you need. Confirm availability and visit arrangements with us before traveling.',
      },
    ],
  },
  'repair-woodland-hills': {
    eyebrow: 'Instrument repair in Woodland Hills',
    title: 'Instrument repair in Woodland Hills',
    seoTitle: 'Instrument Repair in Woodland Hills',
    description:
      'Request guitar and violin setup, drum repair, tuning and hardware troubleshooting at Sattari Music in Woodland Hills. Tell us what needs attention.',
    url: 'https://sattarimusic.com/services/instrument-repair-woodland-hills',
    schemaType: 'Service',
    schemaName: 'Sattari Music Instrument Repair — Woodland Hills',
    intro:
      'When something needs fixing, Sattari handles instrument repair right in Woodland Hills — drums and percussion, guitars, violins, hardware, and setup — with careful, honest work and a real person to talk it through.',
    highlights: [
      'Drum repair',
      'Guitar setup',
      'Violin setup',
      'Hardware',
      'Tuning',
      'Troubleshooting',
    ],
    offerings: [
      'Repair and setup for drums, percussion, guitars, violins, and gear',
      'Hardware, pedal, tuning, and tone troubleshooting',
      'Careful handling for vintage, rare, and sentimental instruments',
      'Honest guidance on repair vs. replace before any work starts',
    ],
    goodFor: [
      'Woodland Hills players who need a fix before a session or show',
      'Drummers and percussionists with hardware or setup issues',
      'String and guitar players needing setup, tuning, or repair',
      'Anyone with a rare or sentimental instrument to protect',
    ],
    primaryCta: { label: 'Request a repair', href: '#local-inquiry' },
    secondaryCta: { label: 'See all services', to: '/services' },
    formService: 'repairs',
    formSource: 'Instrument repair Woodland Hills SEO page',
    faqs: [
      {
        q: 'What instruments do you repair in Woodland Hills?',
        a: 'Drums and percussion, guitars, violins, hardware, and a range of musician gear. Ask about anything specific.',
      },
      {
        q: 'How do I start a repair?',
        a: 'Send a request describing the instrument and the issue and we’ll respond with next steps and what to expect.',
      },
      {
        q: 'Do you work on rare or vintage instruments?',
        a: 'Yes, with extra care. Tell us about the piece and we’ll handle it thoughtfully.',
      },
    ],
  },
  'repair-calabasas': {
    eyebrow: 'Instrument repair near Calabasas',
    title: 'Instrument repair near Calabasas',
    seoTitle: 'Instrument Repair near Calabasas',
    description:
      'Need instrument repair near Calabasas? Ask Sattari Music in Woodland Hills about guitars, violins, drums, hardware and tuning before bringing in your gear.',
    url: 'https://sattarimusic.com/services/instrument-repair-calabasas',
    schemaType: 'Service',
    schemaName: 'Sattari Music Instrument Repair — near Calabasas',
    intro:
      'Bring your repair question to our Woodland Hills team before planning a trip from Calabasas. Describe the guitar, violin, drum or hardware issue and your deadline. We can discuss assessment, possible parts and the next step; repair scope and timing depend on the instrument.',
    highlights: [
      'Drum repair',
      'Guitar setup',
      'Violin setup',
      'Hardware',
      'Tuning',
      'Troubleshooting',
    ],
    offerings: [
      'Repair and setup for drums, percussion, guitars, violins, and gear',
      'Hardware, tuning, and tone troubleshooting for local players',
      'Thoughtful handling for vintage, rare, and sentimental instruments',
      'Clear repair-vs-replace guidance before you commit',
    ],
    goodFor: [
      'Calabasas players who need a nearby repair option',
      'Drummers with hardware, pedal, or setup issues',
      'String and guitar players needing setup or repair',
      'Rare or sentimental instruments that need careful hands',
    ],
    primaryCta: { label: 'Request a repair', href: '#local-inquiry' },
    secondaryCta: { label: 'See all services', to: '/services' },
    formService: 'repairs',
    formSource: 'Instrument repair Calabasas SEO page',
    faqs: [
      {
        q: 'Where do I bring an instrument for repair from Calabasas?',
        a: `Contact Sattari at ${BUSINESS.phoneDisplay} to arrange a visit to ${BUSINESS.addressLine}. We serve Calabasas from this Woodland Hills location.`,
      },
      {
        q: 'What can you repair?',
        a: 'Drums and percussion, guitars, violins, hardware, and musician gear. Ask about anything specific.',
      },
      {
        q: 'Can you tell me the cost before starting?',
        a: 'Yes. Send a request with the details and we’ll give honest guidance before any work begins.',
      },
    ],
  },
  drums: {
    eyebrow: 'Drum gear in Los Angeles',
    title: 'Cymbals, drumsticks and drum gear in Los Angeles',
    seoTitle: 'Los Angeles Drum Gear | Cymbals, Sticks & Pads',
    description:
      'Handcrafted cymbals, hi-hats, splashes, drumsticks and practice pads for Los Angeles drummers. Shop Sattari Music online or ask our Woodland Hills team.',
    url: 'https://sattarimusic.com/shop/drums-los-angeles',
    schemaType: 'Store',
    schemaName: 'Sattari Drum Gear',
    intro:
      'Sattari is built by drummers, for drummers: handcrafted cymbals, hi-hats, and splashes, premium drumsticks, practice pads, felts, and the essentials that keep your kit ready — plus local repair and setup support.',
    highlights: ['Cymbals', 'Hi-hats', 'Splashes', 'Sticks', 'Practice pads', 'Felts'],
    offerings: [
      'Handcrafted Sattari cymbals, hi-hats, and effect cymbals',
      'Premium hickory and maple drumsticks, plus bundles',
      'Practice pads, cymbal felts, and daily-use drum essentials',
      'Local repair, setup, and hardware support for your kit',
    ],
    goodFor: [
      'Drummers looking for handcrafted cymbals with real character',
      'Students and gigging players restocking sticks and essentials',
      'Anyone who wants drum gear with local support behind it',
      'Players who also need repairs, felts, or hardware help',
    ],
    primaryCta: { label: 'Shop cymbals', to: '/shop/cymbals' },
    secondaryCta: { label: 'Shop sticks & essentials', to: '/shop/sticks' },
    catalogHeading: 'Cymbals, hand percussion and practice gear',
    productIds: [
      'sattari-darbuka',
      'pirouz-series-cymbals',
      'pirouz-series-splash',
      'sattari-hand-crafted-hi-hat',
      'sattari-effect-cymbal',
      'classic-american-hickory-a5',
      'sattari-practice-pad-12',
      'sattari-practice-pad-8',
    ],
    formService: 'instrument-sales',
    formSource: 'Drums Los Angeles SEO page',
    faqs: [
      {
        q: 'What drum gear does Sattari make?',
        a: 'Handcrafted cymbals, hi-hats, splashes, and effect cymbals, plus drumsticks, practice pads, and felts.',
      },
      {
        q: 'Do you sell full drum kits?',
        a: 'The focus is handcrafted cymbals, sticks, and essentials rather than full kits — ask us if you’re looking for something specific.',
      },
      {
        q: 'Can you help with cymbal or hardware repair?',
        a: 'Send details of the cymbal or hardware problem. We can discuss assessment and setup support; whether damage can be repaired depends on the piece and condition.',
      },
    ],
  },
  violins: {
    eyebrow: 'Violins in Los Angeles',
    title: 'Acoustic, electric and silent violins',
    seoTitle: 'Violins for Sale in Los Angeles',
    description:
      'Compare acoustic, electric and silent Sattari violins, fitted and tuned in California. Shop online with violin setup and repair support in Woodland Hills.',
    url: 'https://sattarimusic.com/shop/violins-los-angeles',
    // Same violins, same buyers as the /shop/violins category page, which also
    // lists the products; send search engines there and keep this page out of
    // the sitemap.
    canonicalUrl: 'https://sattarimusic.com/shop/violins',
    schemaType: 'Store',
    schemaName: 'Sattari Violins',
    intro:
      'SATTARI violins are hand-carved, shaped, and finished with fine varnishes — acoustic, electric, and silent models, individually fitted and tuned in California, with local setup, repair, and teacher support.',
    highlights: [
      'Acoustic',
      'Electric',
      'Silent',
      'Hand-carved',
      'Fitted & tuned',
      'California setup',
    ],
    offerings: [
      'Handcrafted acoustic, electric, and silent SATTARI violins',
      'Individually fitted and tuned before they reach you',
      'Local setup, string, and repair support for your instrument',
      'Teacher and lesson connections for new and returning players',
    ],
    goodFor: [
      'Students and players looking for a quality violin locally',
      'Musicians who want acoustic, electric, or silent options',
      'Anyone who wants a fitted, tuned instrument, not a boxed guess',
      'Players who also need setup, repair, or lessons',
    ],
    primaryCta: { label: 'Shop violins', to: '/shop/violins' },
    secondaryCta: { label: 'Ask about a violin', href: '#local-inquiry' },
    catalogHeading: 'Compare acoustic and electric violins',
    productIds: [
      'brescia-acoustic-violin',
      'cremona-handmade-acoustic-violin',
      'chiara-wooden-electric-violin',
      'miami-electric-violin',
      'matilde-electric-violin',
    ],
    formService: 'instrument-sales',
    formSource: 'Violins Los Angeles SEO page',
    faqs: [
      {
        q: 'What kinds of violins does Sattari offer?',
        a: 'Handcrafted acoustic, electric, and silent violins, each fitted and tuned in California.',
      },
      {
        q: 'Are the violins good for beginners?',
        a: 'Yes. Tell us the player’s level and goals and we’ll recommend the right fit, plus lessons if useful.',
      },
      {
        q: 'Do you help with violin setup or repair?',
        a: 'Yes, Sattari offers local setup, string, and repair support for violins.',
      },
    ],
  },
  guitars: {
    eyebrow: 'Guitars & bass in Los Angeles',
    title: 'Guitars and bass in Los Angeles',
    seoTitle: 'Los Angeles Guitars & Bass | Sales & Setup',
    description:
      'Find electric guitars, acoustic guitars and bass at Sattari Music in Woodland Hills. Shop online or ask about setup, strings and repair support in Los Angeles.',
    url: 'https://sattarimusic.com/shop/guitars-los-angeles',
    schemaType: 'Store',
    schemaName: 'Sattari Guitars & Bass',
    intro:
      'Electric and acoustic guitars and bass, set up and ready to play and shipped from California — backed by local accessories, setup, string, and repair support so your instrument stays gig-ready.',
    highlights: ['Electric', 'Acoustic', 'Bass', 'Set up ready', 'Accessories', 'Repairs'],
    offerings: [
      'Electric and acoustic guitars and bass for players and students',
      'Instruments set up and ready to play before they ship',
      'Strings, accessories, and setup essentials to keep you ready',
      'Local setup, string, and repair support when you need it',
    ],
    goodFor: [
      'Players looking for guitars or bass locally in the Valley',
      'Students and beginners who want a ready-to-play instrument',
      'Musicians who also need accessories, setup, or repairs',
      'Anyone who wants a real person behind the purchase',
    ],
    primaryCta: { label: 'Shop guitar & bass', to: '/shop/guitar-bass' },
    catalogHeading: 'Electric, acoustic and bass guitars for sale',
    productIds: [
      'flame-stratocaster-electric-guitar',
      'steel-string-acoustic-guitar',
      'classic-nylon-string-guitar',
      'five-string-bass-guitar',
    ],
    secondaryCta: { label: 'Ask about a guitar', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Guitars Los Angeles SEO page',
    faqs: [
      {
        q: 'What guitars does Sattari carry?',
        a: 'Electric and acoustic guitars and bass, with more available by request.',
      },
      {
        q: 'Are the instruments set up before I get them?',
        a: 'Yes. Guitars and bass are set up and ready to play, and shipped from California.',
      },
      {
        q: 'Can you help with strings, setup, or repair?',
        a: 'Yes, Sattari offers local accessories, setup, and repair support.',
      },
    ],
  },
  'woodland-drums': {
    eyebrow: 'Woodland Hills drum shop',
    title: 'Drum gear in Woodland Hills',
    seoTitle: 'Woodland Hills Drum Shop | Cymbals, Sticks & Pads',
    description:
      'Shop Sattari cymbals, hi-hats, drumsticks and practice pads in Woodland Hills. Compare drum gear online and ask about tuning, hardware and repair support.',
    url: 'https://sattarimusic.com/woodland-hills-drum-shop',
    schemaType: 'Store',
    schemaName: 'Sattari Music Drum Shop',
    image: '/sattari site/cymbal.png',
    intro:
      'Build a practice setup or replace a piece of your kit with cymbals, sticks and accessories from Sattari Music. Our Woodland Hills drum shop focuses on these essentials, with local drum tuning and repair inquiries handled by the same team. Confirm availability and visit arrangements before traveling.',
    highlights: ['Cymbals', 'Hi-hats', 'Drumsticks', 'Practice pads', 'Drum tuning', 'Hardware'],
    offerings: [
      'Pirouz cymbals, hi-hats, splashes and effect cymbals',
      'Hickory and maple sticks, nylon-tip options and drumstick bundles',
      'Practice pads, cymbal felts, stick bags and darbuka',
      'Requests for drum tuning, pedal troubleshooting and hardware assessment',
    ],
    goodFor: [
      'A first practice setup with sticks and a pad, before buying a full kit',
      'Replacing a cymbal while keeping your existing stands and setup in mind',
      'Restocking sticks and small accessories before a rehearsal',
      'Combining a gear question with a local repair or tuning request',
    ],
    details: [
      {
        title: 'Start with your practice space',
        copy: 'For practice away from a kit, compare the 8-inch and 12-inch pads and choose sticks that feel comfortable. Tell us where you practice and what you already own so we can discuss a practical starting setup.',
      },
      {
        title: 'Choose a cymbal for its job',
        copy: 'Compare hi-hats for timekeeping, crashes for accents, and splashes or effects for an additional sound. Note your current cymbal sizes, the music you play and your budget when asking about a replacement.',
      },
      {
        title: 'Bring a useful repair description',
        copy: 'For rattles, unstable stands or a pedal issue, include the make, model and what changed. Ask about inspection before bringing a full kit; a photo or the affected part may be the best starting point.',
      },
    ],
    productIds: [
      'pirouz-series-cymbals',
      'sattari-hand-crafted-hi-hat',
      'classic-american-hickory-a5',
      'sattari-practice-pad-8',
    ],
    primaryCta: { label: 'Shop cymbals', to: '/shop/cymbals' },
    secondaryCta: { label: 'Ask about drum gear', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Woodland Hills drum shop',
    faqs: [
      {
        q: 'Where is the Woodland Hills drum shop?',
        a: `Sattari Music is at ${BUSINESS.addressLine}. Call ${BUSINESS.phoneDisplay} to check gear availability and arrange your visit.`,
      },
      {
        q: 'Do you sell complete drum kits?',
        a: 'The online catalog focuses on cymbals, sticks, practice pads and accessories, plus percussion. Contact us about a complete kit or unlisted drum; availability is not guaranteed.',
      },
      {
        q: 'Can I request drum tuning or hardware repair?',
        a: 'Yes. Send the instrument or part, symptoms and your deadline through the repair inquiry. The scope, parts and timing need confirmation before work is scheduled.',
      },
    ],
  },
  'encino-violins': {
    eyebrow: 'Violin shop serving Encino',
    title: 'Find your next violin near Encino',
    seoTitle: 'Violin Shop near Encino | Sales & Setup',
    description:
      'Compare acoustic, electric and silent violins near Encino. Sattari Music in Woodland Hills offers instrument guidance, strings and violin setup inquiries.',
    url: 'https://sattarimusic.com/encino-violin-shop',
    schemaType: 'Store',
    schemaName: 'Sattari Music Violin Guidance for Encino',
    image: '/sattari site/violins/brescia-acoustic.jpg',
    intro:
      "For Encino players choosing a first violin or moving to an electric instrument, Sattari offers acoustic, electric and silent options through our Woodland Hills shop. Compare models here, then share the player's experience, teacher recommendations and budget. Our location is in Woodland Hills, not Encino.",
    highlights: [
      'Acoustic violins',
      'Electric violins',
      'Silent options',
      'Strings',
      'Rosin',
      'Setup',
    ],
    offerings: [
      'Acoustic violin options including Cremona and Brescia',
      'Electric and silent models including Chiara, Miami and Matilde',
      'Violin strings, rosin and pickup accessories in the current catalog',
      'Local setup and repair inquiries, with teacher availability confirmed separately',
    ],
    goodFor: [
      "Parents checking a teacher's size and setup recommendations before buying",
      'Returning players comparing a new instrument with repairing an existing violin',
      'Players asking what an electric violin needs for amplification or headphone use',
      'Encino musicians arranging a shop visit and checking a particular model first',
    ],
    details: [
      {
        title: 'A first violin: confirm the requirements',
        copy: "Bring the player's size recommendation from their teacher, experience level and budget. Ask what comes with the particular model, what accessories you need, and whether it is available before making the trip.",
      },
      {
        title: 'Acoustic, electric or silent?',
        copy: "Compare each product's specifications and intended use. For electric or silent models, check the connections and required listening equipment rather than assuming every model includes headphone monitoring or the same accessories.",
      },
      {
        title: 'Already have a violin?',
        copy: 'Tell us about tuning, string, bridge or playability concerns before deciding to replace it. The repair inquiry lets the team discuss assessment and whether a shop visit is needed; it is not an online diagnosis.',
      },
    ],
    productIds: [
      'brescia-acoustic-violin',
      'cremona-handmade-acoustic-violin',
      'chiara-wooden-electric-violin',
    ],
    primaryCta: { label: 'Compare violins', to: '/shop/violins' },
    secondaryCta: { label: 'Ask about a violin', href: '#local-inquiry' },
    formService: 'instrument-sales',
    formSource: 'Violin shop serving Encino',
    faqs: [
      {
        q: 'Is your violin shop in Encino?',
        a: `No. Sattari Music serves Encino from ${BUSINESS.addressLine}. Contact the shop before visiting to confirm the model and visit arrangements.`,
      },
      {
        q: 'Can you help me choose a beginner violin?',
        a: "Send the player's experience, budget and teacher's size recommendation. We can discuss current models and accessories; confirm the correct size before purchasing.",
      },
      {
        q: 'Can Encino customers request violin repair or setup?',
        a: 'Yes. Use the violin repair inquiry with the instrument, symptoms and timing. Assessment and any work take place through our Woodland Hills team, subject to confirmation.',
      },
    ],
  },
  'violin-repair': {
    eyebrow: 'Violin repair and setup',
    title: 'Violin repair and setup in Woodland Hills',
    seoTitle: 'Violin Repair Los Angeles | Woodland Hills',
    description:
      'Request violin repair, string and setup support in Woodland Hills, serving Encino and Los Angeles. Describe tuning or playability issues before a shop visit.',
    url: 'https://sattarimusic.com/services/violin-repair-los-angeles',
    schemaType: 'Service',
    schemaName: 'Sattari Music Violin Repair and Setup',
    image: '/sattari site/violins/brescia-acoustic.jpg',
    intro:
      'If your violin has tuning, string, bridge or playability problems, start with a repair inquiry. Sattari Music supports violin players in Woodland Hills and nearby Encino, Calabasas and Los Angeles. We confirm the assessment and possible work before arranging service.',
    highlights: ['Violin setup', 'Strings', 'Tuning concerns', 'Bridge questions', 'Playability'],
    offerings: [
      'Assessment requests for tuning stability, noise and playability',
      "Violin string and setup support based on the instrument's condition",
      'Questions about acoustic, electric and silent violin setups',
      'Repair-versus-replacement discussion for an existing instrument',
    ],
    goodFor: [
      'A student whose instrument feels difficult to play',
      'A returning player checking a violin that has been stored',
      'A musician hearing a new buzz or noticing unstable tuning',
      'Owners of sentimental instruments who want to discuss handling first',
    ],
    details: [
      {
        title: 'What to include in your request',
        copy: 'Share the violin model or label if known, when the issue started, whether strings or setup recently changed, and any performance or lesson deadline. The team can request photos when replying.',
      },
      {
        title: 'Assessment comes before a quote',
        copy: 'The cause and scope of a repair cannot be confirmed from a symptom alone. Ask about inspection, parts, cost and timing before authorizing work. Specialized restoration and unlisted services require a separate discussion.',
      },
      {
        title: 'Plan your visit from Encino or Calabasas',
        copy: `All local requests go to our Woodland Hills location at ${BUSINESS.addressLine}. Confirm the appointment and what to bring before leaving home.`,
      },
    ],
    primaryCta: { label: 'Request violin assessment', href: '#local-inquiry' },
    secondaryCta: { label: 'Compare violin options', to: '/shop/violins' },
    formService: 'repairs',
    formSource: 'Violin repair and setup page',
    faqs: [
      {
        q: 'Where can I request violin repair near Encino?',
        a: `Contact Sattari Music at ${BUSINESS.phoneDisplay}. Our shop is at ${BUSINESS.addressLine}, serving Encino and the surrounding area.`,
      },
      {
        q: 'Can you quote a violin repair online?',
        a: 'You can begin the conversation online, but a confirmed quote may require photos or an in-person assessment. Include your instrument and symptoms in the request.',
      },
      {
        q: 'Is same-day violin repair guaranteed?',
        a: "No. Scope, parts, scheduling and the instrument's condition determine timing. Tell us your deadline so the team can confirm whether it is practical.",
      },
      {
        q: 'Can I ask about replacing violin strings without booking a repair?',
        a: 'Yes. For strings alone, check the violin strings listing and confirm the instrument size and string-end fit. If you want help fitting them, include the violin size and any tuning or bridge concerns in your inquiry so the team can confirm the work and quote first.',
      },
    ],
  },
  'guitar-setup': {
    eyebrow: 'Guitar and bass setup',
    title: 'Guitar setup and repair in Woodland Hills',
    seoTitle: 'Guitar Setup Los Angeles | Woodland Hills',
    description:
      'Ask about guitar and bass setup, string changes, buzzing and tuning issues in Woodland Hills. Sattari serves Calabasas, Encino and Los Angeles musicians.',
    url: 'https://sattarimusic.com/services/guitar-setup-los-angeles',
    schemaType: 'Service',
    schemaName: 'Sattari Music Guitar and Bass Setup',
    image: '/sattari site/guitars/flame-stratocaster.jpg',
    intro:
      'Strings that feel uncomfortable, a new buzz or tuning problems can get in the way of practice. Tell the Sattari team about your guitar or bass and how you play. Our Woodland Hills shop handles setup and repair inquiries for local players, including musicians from Encino and Calabasas.',
    highlights: ['Guitar setup', 'Bass setup', 'Strings', 'Tuning', 'Buzzing', 'Playability'],
    offerings: [
      'Setup inquiries for electric, acoustic and nylon-string guitars and bass',
      'String, tuning, hardware and playability assessments',
      'Questions about string feel, action and tuning along the neck',
      'Repair or replacement guidance after reviewing the instrument',
    ],
    goodFor: [
      'A first guitar that is uncomfortable to practice on',
      'Players changing string type, tuning or playing style',
      'A guitar or bass developing a buzz or tuning issue',
      'Musicians planning a setup before rehearsal or recording',
    ],
    details: [
      {
        title: 'Describe the problem in playing terms',
        copy: 'Tell us which strings or frets are affected, whether the issue is new, and whether it happens plugged in or unplugged. Include the model, usual tuning and any recent changes.',
      },
      {
        title: 'Match the setup to your playing',
        copy: 'Share your usual string gauge if known, preferred tuning and how the instrument feels now. The team can discuss an assessment rather than assuming one setup suits every player.',
      },
      {
        title: 'Check scope and timing first',
        copy: 'Structural damage, electrical work and specialist repairs need individual confirmation. Include your deadline and ask about costs and any required parts before scheduling the work.',
      },
    ],
    primaryCta: { label: 'Request guitar or bass setup', href: '#local-inquiry' },
    secondaryCta: { label: 'Shop guitars & bass', to: '/shop/guitar-bass' },
    formService: 'repairs',
    formSource: 'Guitar and bass setup page',
    faqs: [
      {
        q: 'Do you accept bass setup inquiries as well as guitars?',
        a: 'Yes. Include the instrument type, model, tuning and the issue in your request. Scope and availability are confirmed by the Woodland Hills team.',
      },
      {
        q: 'Can you tell what causes a guitar buzz from a message?',
        a: 'A message helps us plan the next step, but an inspection may be needed to identify the cause. Describe where and when you hear the buzz rather than assuming a particular repair.',
      },
      {
        q: 'Where do Calabasas customers bring a guitar for setup?',
        a: `Arrange a visit to ${BUSINESS.addressLine}. Call ${BUSINESS.phoneDisplay} or send the inquiry before bringing your instrument.`,
      },
      {
        q: 'Do I need a full setup when I replace guitar strings?',
        a: 'That depends on the instrument and what is changing. Describe your current strings, preferred gauge and tuning, and any buzzing or difficult action. Ask for string replacement and any additional setup work to be quoted clearly before you approve the service.',
      },
    ],
  },
  'guitar-strings': {
    eyebrow: 'Guitar strings in Woodland Hills',
    title: 'Find guitar strings in Woodland Hills',
    seoTitle: 'Guitar Strings in Woodland Hills',
    description:
      'Ask Sattari Music about electric, acoustic and classical guitar strings in Woodland Hills. Confirm compatible gauges, availability and restringing before visiting.',
    url: 'https://sattarimusic.com/guitar-strings-woodland-hills',
    schemaType: 'WebPage',
    schemaName: 'Guitar Strings at Sattari Music in Woodland Hills',
    image: '/sattari site/guitars/flame-stratocaster.jpg',
    intro:
      'Check electric, acoustic or classical guitar string availability before visiting our Woodland Hills shop. Tell us the set you want or ask us to help identify it. We’ll confirm the pack price and a pickup appointment, or quote installation separately if you want the strings fitted.',
    highlights: ['Electric guitar', 'Acoustic guitar', 'Classical guitar', 'Gauge', 'Tuning'],
    offerings: [
      'Availability inquiries for electric and acoustic guitar strings',
      'Classical guitar string questions with material and instrument fit checked first',
      'Help identifying the information needed to choose a replacement set',
      'A separate inquiry for fitting strings or assessing setup concerns',
    ],
    goodFor: [
      'Replacing worn strings with a familiar type and gauge',
      'A beginner choosing strings for an electric or acoustic guitar',
      'Players changing tuning who want to discuss string choice and setup',
      'Local musicians checking a particular set before arranging pickup',
    ],
    details: [
      {
        title: 'Electric guitar strings: start with your current set',
        copy: 'Share the guitar model, number of strings and the gauge printed on the package if you have it. Include whether you want the same feel or a change, and mention a locking or floating bridge. A preferred brand or model is useful for an availability check; no specific brand, gauge or set is guaranteed in stock.',
      },
      {
        title: 'Acoustic and classical guitars need the right string type',
        copy: 'Identify whether your acoustic guitar is designed for steel strings or nylon strings. Classical guitars generally use nylon-string sets; do not substitute steel strings on a guitar designed for nylon. If you are unsure, send the make and model or a photo of the existing string packaging before choosing replacements.',
      },
      {
        title: 'Match gauge to your instrument and tuning',
        copy: 'Gauge describes string thickness. Tell us your normal tuning, playing style and what feels uncomfortable about your current strings. A different gauge or tuning can change tension and may call for a setup assessment. Check the instrument maker’s recommendations rather than choosing a set solely because its label says light or medium.',
      },
      {
        title: 'Buying strings and having them fitted are separate requests',
        copy: 'Let us know whether you want strings to fit yourself or help replacing them. For a purchase, confirm the exact set, price and pickup arrangements. For restringing, also ask about labor, appointment availability and whether any setup work is proposed. Your inquiry does not reserve stock or book a service.',
      },
    ],
    primaryCta: { label: 'Check pack price and pickup', href: '#local-inquiry' },
    secondaryCta: {
      label: 'Request guitar restringing',
      to: '/services/guitar-restringing-woodland-hills',
    },
    formService: 'accessories',
    formSource: 'Guitar strings Woodland Hills',
    inquiryCopy:
      'The brand and gauge printed on your old packet help us find a match. If you no longer have it, tell us the guitar model and how you tune it.',
    faqs: [
      {
        q: 'Where can I buy guitar strings in Woodland Hills?',
        a: `Ask Sattari Music about available strings at ${BUSINESS.addressLine}. Call ${BUSINESS.phoneDisplay} or use the inquiry form to confirm the set and price, then arrange an appointment before visiting.`,
      },
      {
        q: 'Do you have electric guitar strings and acoustic guitar strings in stock?',
        a: 'Send the string type, gauge and preferred brand or model. Availability is confirmed by the team; this page does not represent a live list of guitar string stock. Ask about a suitable alternative if your requested set is unavailable.',
      },
      {
        q: 'Can I use the same strings on an electric, acoustic and classical guitar?',
        a: 'Choose strings for the instrument they are designed for. Electric, steel-string acoustic and classical nylon-string sets are different choices. Confirm the guitar model and manufacturer guidance before changing type, and do not fit steel strings to a guitar designed for nylon.',
      },
      {
        q: 'What gauge of guitar strings should I choose?',
        a: 'Start with the current set and the guitar maker’s recommendations. Include your tuning, playing style and whether you want a different feel. If you change gauge or tuning, ask whether the guitar also needs a setup assessment.',
      },
      {
        q: 'Can I ask Sattari to replace my guitar strings?',
        a: 'Yes. Use the guitar restringing inquiry with your instrument details. The team will confirm compatible strings, service scope, the quote and an appointment before work is arranged.',
      },
    ],
  },
  'violin-strings': {
    eyebrow: 'Violin strings in Woodland Hills',
    title: 'Violin strings for sale in Woodland Hills',
    seoTitle: 'Violin Strings for Sale in Woodland Hills',
    description:
      'Explore violin strings specified for 4/4 and 3/4 violins with ball ends. Check current stock and replacement support with Sattari Music in Woodland Hills.',
    url: 'https://sattarimusic.com/violin-strings-woodland-hills',
    schemaType: 'WebPage',
    schemaName: 'Violin Strings at Sattari Music in Woodland Hills',
    image: '/sattari site/violins/violin-strings.jpg',
    intro:
      'Sattari’s violin string specifications list fit for 4/4 and 3/4 violins with ball ends. Confirm fit, pricing and current availability before ordering or arranging pickup. Our Woodland Hills team also takes inquiries about string replacement and violin setup; visits are by appointment.',
    highlights: ['Violin strings', '4/4 fit listed', '3/4 fit listed', 'Ball ends', 'Replacement'],
    offerings: [
      'Violin string purchase inquiries, with availability confirmed before ordering',
      'Listed fit for 4/4 and 3/4 violins, with ball-end strings',
      'Questions about the correct instrument size and string-end compatibility',
      'Separate inquiries for string fitting, tuning concerns and violin setup',
    ],
    goodFor: [
      'Students checking a teacher’s replacement-string requirements',
      'Players comparing their existing strings with the listed specifications',
      'Parents confirming violin size before buying a replacement',
      'Musicians asking whether a string issue also needs an assessment',
    ],
    details: [
      {
        title: 'Check the violin size before ordering',
        copy: 'Confirm the instrument size from its paperwork, teacher or maker. The current listing names 4/4 and 3/4 fit; it does not establish compatibility with every fractional-size violin. For a smaller instrument or uncertain size, ask before purchasing and include the model or label if known.',
      },
      {
        title: 'Match ball ends to your existing fitting',
        copy: 'Our listed violin strings have ball ends. Check the requirements of the tailpiece and fine tuners, including the E-string fitting. If you have a loop-end requirement or cannot identify the fitting, contact us before ordering rather than assuming the listed set will fit.',
      },
      {
        title: 'Bring any teacher or player requirements',
        copy: 'Include a requested brand, material or tension if your teacher has specified one. Those details are not stated in this listing and should be confirmed with the team. Tell us whether you need a complete replacement or a particular string so we can confirm what is available.',
      },
      {
        title: 'Ask about installation or a recurring problem',
        copy: 'If you want help fitting strings, describe the violin and any tuning, bridge or playability concerns. Repeated breakage or tuning trouble may require assessment beyond buying a replacement. Confirm the service, cost and appointment before bringing the instrument to the shop.',
      },
    ],
    productIds: ['violin-strings'],
    primaryCta: { label: 'Shop violin strings', to: '/product/violin-strings' },
    secondaryCta: { label: 'Ask about fit or replacement', href: '#local-inquiry' },
    formService: 'accessories',
    formSource: 'Violin strings Woodland Hills',
    inquiryCopy:
      'Include the violin size, model if known, string-end requirements and any teacher recommendations. Tell us whether you want strings only or help fitting them.',
    faqs: [
      {
        q: 'What violin strings does Sattari sell?',
        a: 'Sattari’s listed violin string specifications name fit for 4/4 and 3/4 violins and ball ends. Confirm current product details, pricing and availability before ordering. Ask about brand, material or tension if those details matter for your instrument or teacher’s requirements.',
      },
      {
        q: 'Will these strings fit a smaller student violin?',
        a: 'Do not assume that they will. The listing names 4/4 and 3/4 violins. Confirm the student’s instrument size and ask about compatible options for other sizes before buying.',
      },
      {
        q: 'Are ball-end and loop-end violin strings interchangeable?',
        a: 'The string end must suit the instrument’s fitting. This listing specifies ball ends. Check the tailpiece or fine tuner requirements, particularly for the E string, and ask the team if your instrument needs a loop end.',
      },
      {
        q: 'Can I request violin string replacement in Woodland Hills?',
        a: 'Yes. Send the violin size and any tuning or setup concerns. String fitting and additional work need confirmation and a quote before an appointment; purchasing strings does not include installation.',
      },
      {
        q: 'Can I collect violin strings at the shop?',
        a: `Contact Sattari Music at ${BUSINESS.phoneDisplay} to confirm current in-store availability and pickup arrangements at ${BUSINESS.addressLine}. Shop visits are by appointment only.`,
      },
    ],
  },
  'guitar-restringing': {
    eyebrow: 'Guitar restringing in Woodland Hills',
    title: 'Guitar string replacement in Woodland Hills',
    seoTitle: 'Guitar Restringing & String Replacement, Woodland Hills | Sattari',
    description:
      'Request electric or acoustic guitar restringing in Woodland Hills. Confirm strings, labor, setup needs, a quote and an appointment with Sattari Music.',
    url: 'https://sattarimusic.com/services/guitar-restringing-woodland-hills',
    schemaType: 'Service',
    schemaName: 'Sattari Music Guitar Restringing Inquiries',
    image: '/sattari site/guitars/flame-stratocaster.jpg',
    intro:
      'Need to replace the strings on an electric or acoustic guitar? Send Sattari Music the model, string type and usual tuning to start a restringing inquiry. Our Woodland Hills team will confirm compatible strings, the proposed work, a quote and an appointment. Mention buzzing, tuning trouble or difficult action so those concerns can be assessed separately.',
    highlights: ['String replacement', 'Electric guitar', 'Acoustic guitar', 'Quote first'],
    offerings: [
      'Electric and acoustic guitar string replacement inquiries',
      'Compatibility and string availability checks before scheduling',
      'A clear discussion of strings, labor and any additional setup work',
      'Appointment requests with timing confirmed by the Woodland Hills team',
    ],
    goodFor: [
      'Players replacing worn or broken strings before the next practice',
      'Beginners who want to ask for help fitting a replacement set',
      'Musicians changing gauge or tuning who need to discuss setup',
      'Owners of guitars with unusual bridges or stringing requirements',
    ],
    details: [
      {
        title: '1. Describe the guitar and the replacement you need',
        copy: 'Include the make and model, number of strings, current gauge if known, desired tuning and your deadline. Tell us whether the guitar is electric, steel-string acoustic or nylon-string classical. Mention a locking tremolo, floating bridge, twelve-string instrument or other unusual requirements so the team can confirm whether it can accept the job.',
      },
      {
        title: '2. Confirm compatible strings and the quote',
        copy: 'Ask which strings are available, what the labor includes and whether you can supply your own set. Confirm the price of strings and labor, any proposed assessment or setup charges, and the expected turnaround before approving work. We do not publish a universal restringing price because the instrument and agreed scope matter.',
      },
      {
        title: '3. Arrange your appointment and collection',
        copy: `Shop visits are by appointment at ${BUSINESS.addressLine}. Wait for the team to confirm the time, what to bring and collection arrangements. An online inquiry is not a booking, and same-day completion is not guaranteed.`,
      },
      {
        title: 'When a string change becomes a setup or repair question',
        copy: 'A restringing request covers the agreed string replacement work. Persistent buzzing, high action, notes sounding out of tune along the neck, repeated breakage or damaged parts can need further assessment. Describe those symptoms when you inquire; a full setup, fret work, electronics or structural repair is not automatically included.',
      },
    ],
    primaryCta: { label: 'Request a restringing quote', href: '#local-inquiry' },
    secondaryCta: { label: 'Find guitar strings', to: '/guitar-strings-woodland-hills' },
    formService: 'repairs',
    formSource: 'Guitar restringing Woodland Hills',
    inquiryCopy:
      'Include your guitar model, string type and gauge if known, preferred tuning and deadline. Mention any buzzing, repeated string breakage or unusual bridge so the team can confirm scope and quote.',
    faqs: [
      {
        q: 'How much does it cost to replace guitar strings?',
        a: 'Request a quote for your instrument. Confirm the replacement strings, labor and any proposed setup or assessment charges before you approve the work. There is no single price published here for every guitar and service scope.',
      },
      {
        q: 'Can I request electric guitar or acoustic guitar restringing?',
        a: 'Yes. Include the guitar make and model, number of strings and current string type. For a classical guitar, locking bridge, twelve-string guitar or other particular requirements, ask the team to confirm compatibility and service availability before scheduling.',
      },
      {
        q: 'Does restringing include a complete guitar setup?',
        a: 'A string replacement inquiry does not automatically include a full setup or repair. Ask what is included in the quote. If you are changing gauge or tuning, or have action, buzzing or intonation concerns, request an assessment of those issues as well.',
      },
      {
        q: 'Can I bring my own guitar strings?',
        a: 'Tell the team the exact set you plan to bring and your guitar model. Confirm compatibility, whether customer-supplied strings can be used, and the labor quote before arranging your appointment.',
      },
      {
        q: 'Can you replace my guitar strings while I wait?',
        a: 'Ask about timing when you request the quote. Availability, instrument condition and the agreed work determine turnaround. Shop visits are by appointment, and an inquiry does not guarantee same-day or while-you-wait service.',
      },
    ],
  },
  'violin-restringing': {
    eyebrow: 'Violin restringing in Woodland Hills',
    title: 'Violin restringing and string replacement in Woodland Hills',
    seoTitle: 'Violin Restringing & String Replacement, Woodland Hills | Sattari',
    description:
      'Ask Sattari Music about violin string replacement, fitting and tuning concerns in Woodland Hills. Confirm violin size, string ends, quote and appointment.',
    url: 'https://sattarimusic.com/services/violin-restringing-woodland-hills',
    schemaType: 'Service',
    schemaName: 'Violin string replacement inquiries at Sattari Music',
    image: '/sattari site/violins/violin-strings.jpg',
    intro:
      'A worn set, a broken E string or a string that will not settle can interrupt practice. Tell Sattari Music your violin size, which string needs attention and any teacher requirements. Our Woodland Hills team will confirm the proposed string fitting, compatible replacements, price and appointment before you bring the instrument in.',
    highlights: [
      'Violin strings',
      'Single-string inquiries',
      'Fit checked first',
      'By appointment',
    ],
    offerings: [
      'Inquiries about replacing one violin string or a full set',
      'Violin size, ball-end or loop-end fitting and teacher requirements discussed before ordering',
      'Separate assessment requests for slipping pegs, bridge concerns or repeated breakage',
      'A quote and appointment confirmed by the shop before work',
    ],
    goodFor: [
      'Parents arranging a student violin string replacement',
      'Players checking a broken E, A, D or G string',
      'Musicians replacing worn strings ahead of practice',
      'Owners whose recurring tuning problem needs assessment',
    ],
    details: [
      {
        title: 'One broken string or a complete set?',
        copy: 'Name the affected string and describe when it broke. A single replacement may be the right inquiry when the other strings are usable; an older or uneven set can be discussed as a whole. The team needs to check compatible options and availability. No particular brand, tension or single-string stock is promised here.',
      },
      {
        title: 'Size and string ends matter',
        copy: 'Include the violin size and a photo or name of the previous set when available. The current Sattari string listing specifies 4/4 and 3/4 fit with ball ends. A violin requiring a loop-end E string, a different fractional size or a teacher-specified set needs a separate compatibility check.',
      },
      {
        title: 'Tell us about bridge, peg or tuning concerns',
        copy: 'If the bridge is leaning, a peg keeps slipping or the same string repeatedly breaks, describe that before requesting a routine string change. Do not force a stuck peg or assume a tuner reading explains the cause. Fitting strings and diagnosing a recurring problem can involve different work; confirm scope before approving it.',
      },
      {
        title: 'Confirm the quote and appointment',
        copy: 'Ask about string cost, labor, whether customer-supplied strings can be used and expected collection time. Confirm any additional assessment charges first. Visits to 4881 Topanga Canyon Blvd #202 are by appointment; an inquiry does not reserve stock or guarantee same-day service.',
      },
    ],
    productIds: ['violin-strings'],
    primaryCta: {
      label: 'Ask about violin restringing',
      href: '#local-inquiry',
    },
    secondaryCta: {
      label: 'Compare violin strings',
      to: '/violin-strings-woodland-hills',
    },
    formService: 'repairs',
    formSource: 'Violin restringing Woodland Hills',
    inquiryCopy:
      'Include violin size, the affected string, ball or loop ends if known, the existing set or teacher request, and your deadline. Mention bridge or peg concerns and repeated breakage.',
    faqs: [
      {
        q: 'Can I ask for just one broken violin string to be replaced?',
        a: 'Yes. Identify the affected string and violin size. The team will confirm whether a compatible single string is available and whether fitting or assessment is appropriate before quoting.',
      },
      {
        q: 'Does a violin string change include a setup?',
        a: 'Not automatically. Ask what the string fitting quote includes, and describe bridge, peg, action or recurring tuning concerns separately so the team can discuss any assessment.',
      },
      {
        q: 'How much is violin restringing?',
        a: 'Request a quote for the actual strings and work. Confirm string cost, labor, any extra assessment and turnaround before agreeing. There is no universal service price published here.',
      },
      {
        q: 'Can I use the online tuner after a string change?',
        a: 'The combined tuner has a violin preset for G3, D4, A4 and E5 with concert A at 440 Hz by default. Tune one note at a time and follow your teacher’s guidance. A pitch reading does not diagnose bridge, peg or string damage.',
      },
    ],
  },
  'string-replacement': {
    eyebrow: 'Broken-string help in Woodland Hills',
    title: 'Broken instrument string? Plan the right replacement',
    seoTitle: 'Broken Guitar or Violin String? Woodland Hills',
    description:
      'Get help planning a broken guitar, bass or violin string replacement. Describe the instrument, string and symptoms; confirm compatible parts and service with Sattari.',
    url: 'https://sattarimusic.com/services/string-replacement-woodland-hills',
    schemaType: 'WebPage',
    schemaName: 'Instrument string replacement planning at Sattari Music',
    image: '/sattari site/violins/violin-strings.jpg',
    intro:
      'A snapped string and a tuning problem are different starting points. This page helps you prepare a useful replacement inquiry: which instrument and string, what happened, and whether the issue has happened before. Sattari Music in Woodland Hills will confirm compatible strings, service scope and appointment availability for your particular instrument.',
    highlights: [
      'Broken string',
      'Guitar and bass questions',
      'Violin string help',
      'Quote before work',
    ],
    offerings: [
      'Help routing a string purchase, guitar restringing or violin string-fitting inquiry',
      'Compatibility questions for instrument type, scale length, gauge and string ends',
      'Assessment inquiries for repeated breakage, slipping or buzzing',
      'Separate confirmation of accepted work, price and timing',
    ],
    goodFor: [
      'A guitar string breaks before the next practice',
      'A violin student needs to identify a replacement string',
      'A bass player is unsure which scale length or set to request',
      'A player wants to distinguish string replacement from a setup inquiry',
    ],
    details: [
      {
        title: 'Identify the instrument and string',
        copy: 'For a guitar or bass, include make, model, number of strings, usual tuning and gauge if known. For bass, include scale length or model and whether it has four or five strings. For a violin, include size, the affected string and end fitting. Do not assume one set fits every instrument.',
      },
      {
        title: 'Describe how and where it broke',
        copy: 'Say whether the string broke while tuning or playing, whether it has happened repeatedly, and whether the break was near the bridge, nut or tuning post. These observations help the team decide what to assess; they are not enough for an online diagnosis. Avoid forcing a peg or tightening damaged hardware.',
      },
      {
        title: 'String change, tuning or setup?',
        copy: 'Replacing a string is not the same as correcting intonation, buzzing, high action, slipping pegs or damaged parts. Changing gauge or tuning can also affect setup. Describe those symptoms so the proposed work can be confirmed separately instead of assuming a fresh set will solve everything.',
      },
      {
        title: 'Check availability before making a trip',
        copy: 'Confirm the exact replacement or compatible alternatives, string and labor prices, whether your own strings can be fitted, and appointment and collection times. Bass models, unusual bridges and fractional violins require specific confirmation. No walk-in, emergency or same-day availability is guaranteed.',
      },
    ],
    primaryCta: {
      label: 'Describe your string problem',
      href: '#local-inquiry',
    },
    secondaryCta: {
      label: 'Guitar restringing details',
      to: '/services/guitar-restringing-woodland-hills',
    },
    formService: 'repairs',
    formSource: 'Broken instrument string Woodland Hills',
    inquiryCopy:
      'Tell us the instrument model or violin size, affected string, usual tuning, where and when it broke, whether this is recurring, and when you need the instrument.',
    faqs: [
      {
        q: 'Can I replace one string instead of the whole set?',
        a: 'Ask about a matching individual string and the condition of the existing set. Availability, compatibility and your preference determine the options. A whole set is not automatically required or automatically included.',
      },
      {
        q: 'Can I ask about bass restringing?',
        a: 'Send the bass model, scale length, number of strings, gauge and tuning. The shop must confirm compatible stock, whether it can accept the particular work, labor and timing before scheduling.',
      },
      {
        q: 'Why does the same string keep breaking?',
        a: 'There can be several causes. Record where the break occurs and the circumstances, then request an assessment. A website or tuner cannot establish the cause from the symptom alone.',
      },
      {
        q: 'Will tuning fix a broken string?',
        a: 'No. A broken string needs an appropriate replacement. Once the instrument is ready, use a single-note tuner to check pitch. Recurring slipping, buzzing or tuning trouble should be described in your service inquiry.',
      },
    ],
  },
} as const;

const pages = localSeoPages;

const ORIGIN = 'https://sattarimusic.com';
const SHOP_NAP = `${BUSINESS.name}, ${BUSINESS.addressLine}`;

const toPath = (url: string) => url.replace(ORIGIN, '');

// The URL search engines should index for a page: its own, unless the page
// defers to another one.
function canonicalUrlFor(pageKey: PageKey): string {
  const page = pages[pageKey];
  return 'canonicalUrl' in page ? page.canonicalUrl : page.url;
}

const RELATED_PAGES: Record<PageKey, PageKey[]> = {
  'music-store': ['woodland-hills', 'woodland-drums', 'encino-violins', 'guitar-setup'],
  instruments: ['woodland-drums', 'encino-violins', 'guitars', 'instrument-rentals'],
  accessories: ['woodland-drums', 'guitar-strings', 'violin-strings', 'guitar-restringing'],
  'instrument-rentals': ['rehearsal-space', 'recording-studio', 'instruments', 'music-lessons'],
  'rehearsal-space': ['recording-studio', 'instrument-rentals', 'music-lessons', 'woodland-drums'],
  'recording-studio': ['rehearsal-space', 'instrument-rentals', 'guitar-setup', 'woodland-drums'],
  'music-lessons': ['encino-violins', 'woodland-drums', 'guitars', 'rehearsal-space'],
  'woodland-hills': ['woodland-drums', 'repair-woodland-hills', 'encino-violins', 'music-lessons'],
  calabasas: ['guitar-setup', 'repair-calabasas', 'woodland-drums', 'music-lessons'],
  encino: ['encino-violins', 'violin-repair', 'guitar-setup', 'music-lessons'],
  'repair-woodland-hills': [
    'violin-repair',
    'guitar-setup',
    'woodland-drums',
    'instrument-rentals',
  ],
  'repair-calabasas': ['guitar-setup', 'violin-repair', 'calabasas', 'instrument-rentals'],
  drums: ['woodland-drums', 'accessories', 'repair-woodland-hills', 'rehearsal-space'],
  violins: ['encino-violins', 'violin-strings', 'violin-repair', 'music-lessons'],
  guitars: ['guitar-strings', 'guitar-restringing', 'guitar-setup', 'music-lessons'],
  'woodland-drums': ['drums', 'accessories', 'repair-woodland-hills', 'rehearsal-space'],
  'encino-violins': ['violins', 'violin-strings', 'violin-repair', 'music-lessons'],
  'violin-repair': ['violin-restringing', 'violin-strings', 'string-replacement', 'violins'],
  'guitar-setup': ['guitar-strings', 'guitar-restringing', 'guitars', 'repair-calabasas'],
  'guitar-strings': ['guitar-restringing', 'guitar-setup', 'guitars', 'violin-strings'],
  'violin-strings': ['violin-restringing', 'violin-repair', 'violins', 'guitar-strings'],
  'violin-restringing': ['violin-strings', 'violin-repair', 'string-replacement', 'violins'],
  'string-replacement': [
    'guitar-restringing',
    'violin-restringing',
    'guitar-setup',
    'violin-strings',
  ],
  'guitar-restringing': [
    'guitar-strings',
    'guitar-setup',
    'string-replacement',
    'violin-restringing',
  ],
};

// Home → (Shop | Services) → current — drives both the breadcrumb UI and schema.
function getBreadcrumbs(pageKey: PageKey): { label: string; to?: string }[] {
  const page = pages[pageKey];
  const path = toPath(page.url);
  const crumbs: { label: string; to?: string }[] = [{ label: 'Home', to: '/' }];
  if (path.startsWith('/shop') || ['guitar-strings', 'violin-strings'].includes(pageKey))
    crumbs.push({ label: 'Shop', to: '/shop' });
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
  const { products, isSoldOut } = useInventory() as {
    products: Product[];
    isSoldOut: (product: Product) => boolean;
  };
  const productIds: readonly string[] = 'productIds' in page ? page.productIds : [];
  const featuredProducts = products.filter((product) => productIds.includes(product.slug));
  const primaryProductPath =
    'to' in page.primaryCta && page.primaryCta.to.startsWith('/product/')
      ? page.primaryCta.to
      : null;
  const primaryCta =
    primaryProductPath &&
    !products.some((product) => primaryProductPath === `/product/${product.slug}`)
      ? { label: 'Ask about availability', href: '#local-inquiry' }
      : page.primaryCta;
  const breadcrumbs = getBreadcrumbs(pageKey);
  const isSpace = pageKey === 'rehearsal-space' || pageKey === 'recording-studio';

  return (
    <section className="section page-header-offset services-shell local-seo-shell">
      <SEO
        title={page.seoTitle}
        description={page.description}
        url={canonicalUrlFor(pageKey)}
        image={'image' in page ? page.image : undefined}
      />
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': page.schemaType === 'Service' ? 'Service' : 'WebPage',
          name: page.schemaName,
          description: page.description,
          url: canonicalUrlFor(pageKey),
          ...(page.schemaType === 'Service'
            ? { areaServed: BUSINESS.areas, provider: { '@id': businessSchema['@id'] } }
            : { about: { '@id': businessSchema['@id'] } }),
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
            item: crumb.to ? `${ORIGIN}${crumb.to}` : canonicalUrlFor(pageKey),
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
            <CtaLink cta={primaryCta} className="button button-solid" />
            <CtaLink cta={page.secondaryCta} className="button button-outline" />
          </div>
          {pageKey === 'guitar-restringing' && (
            <p className="restring-quote-note">
              Ask for the price of the string set, installation labor and any setup work separately.
              Bringing your own strings? Include the brand and gauge so we can confirm fit and
              labor.
            </p>
          )}
        </div>

        <div className="repair-callout-card">
          <p className="card-kicker">Our Woodland Hills shop</p>
          <h2>Talk to Sattari Music</h2>
          <address>{BUSINESS.addressLine}</address>
          <p>{BUSINESS.shopHoursNote}</p>
          {isSpace && <p>Studio hours: {BUSINESS.studioHoursNote}</p>}
          <div className="local-contact-links">
            <a href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>
            <a href={BUSINESS.directions} target="_blank" rel="noopener noreferrer">
              Get directions
            </a>
          </div>
          <div className="repair-mini-stats" aria-label="Local service highlights">
            {page.highlights.map((highlight) => (
              <span key={highlight}>{highlight}</span>
            ))}
          </div>
        </div>
      </div>

      {featuredProducts.length > 0 && (
        <section className="container local-catalog" aria-labelledby="local-catalog-title">
          <div className="section-header narrow">
            <h2 id="local-catalog-title">
              {'catalogHeading' in page ? page.catalogHeading : 'Explore the instruments and gear'}
            </h2>
            <p>
              Check each listing for specifications and options. Contact us to confirm in-store
              availability before visiting.
            </p>
          </div>
          <div className="local-product-grid">
            {featuredProducts.map((product) => (
              <Link className="local-product" to={`/product/${product.slug}`} key={product.slug}>
                <OptimizedProductImage
                  src={product.image || product.sizes?.find((size) => size.image)?.image}
                  alt={product.name}
                  className="local-product-image"
                  sizes="(max-width: 600px) 50vw, 25vw"
                />
                <h3>{product.name}</h3>
                <p>{formatPriceRange(product)}</p>
                {isSoldOut(product) && <span className="local-product-stock">Out of stock</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {'details' in page && (
        <section className="container local-advice" aria-label="Planning your visit or request">
          {page.details.map((detail) => (
            <div key={detail.title}>
              <h2>{detail.title}</h2>
              <p>{detail.copy}</p>
            </div>
          ))}
        </section>
      )}

      {isSpace && (
        <div className="container service-form-shell" id="local-inquiry">
          <div className="service-form-copy section-header narrow">
            <p className="eyebrow">Studio &amp; rehearsal bookings</p>
            <h2>Your next session starts here.</h2>
            <p>
              $25 per hour or $60 for four hours. Call with your preferred date and equipment needs
              to confirm availability and arrangements.
            </p>
          </div>
          <ServiceInquiryForm initialService={page.formService} source={page.formSource} />
        </div>
      )}

      <div className="container">
        <ServicePlanningDetails service={page.formService} />
      </div>

      <div className="container repair-grid">
        <article className="info-card repair-info-card">
          <p className="card-kicker">What Sattari offers</p>
          <h2>Services and options</h2>
          <ul className="service-list repair-list">
            {page.offerings.map((offering) => (
              <li key={offering}>{offering}</li>
            ))}
          </ul>
        </article>

        <article className="info-card repair-info-card">
          <p className="card-kicker">Good fit for</p>
          <h2>Find the right support</h2>
          <ul className="service-list repair-list">
            {page.goodFor.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </div>

      {[
        'guitar-restringing',
        'violin-restringing',
        'string-replacement',
        'violin-strings',
        'guitar-strings',
      ].includes(pageKey) && (
        <aside className="container local-seo-details">
          <h2>Ready to tune and practice?</h2>
          <p>
            {pageKey.startsWith('violin') ? (
              <>
                Check each open string with the <Link to="/tuner/violin">online violin tuner</Link>.
              </>
            ) : pageKey.startsWith('guitar') ? (
              <>
                Check the new strings in standard tuning or drop D with the{' '}
                <Link to="/tuner/guitar">online guitar tuner</Link>.
              </>
            ) : (
              <>
                Check the pitch of a replacement string with the{' '}
                <Link to="/tuner/guitar">guitar tuner</Link>,{' '}
                <Link to="/tuner/bass">bass tuner</Link>, or{' '}
                <Link to="/tuner/violin">violin tuner</Link>.
              </>
            )}{' '}
            You can also <Link to="/studio/keybpm#scales">practice scales</Link> or{' '}
            <Link to="/studio/keybpm#song-key">find a song’s key and tempo</Link>.
          </p>
        </aside>
      )}
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

      {!isSpace && (
        <div className="container service-form-shell" id="local-inquiry">
          <div className="service-form-copy section-header narrow">
            <p className="eyebrow">Start the conversation</p>
            <h2>
              {pageKey === 'guitar-strings' ? 'Check a string pack' : 'Ask the Woodland Hills team'}
            </h2>
            <p>
              {'inquiryCopy' in page
                ? page.inquiryCopy
                : 'Share the instrument, accessory, class, rental, studio, rehearsal, or repair request and any timing details that matter.'}
            </p>
          </div>
          <ServiceInquiryForm
            initialService={page.formService}
            source={page.formSource}
            guitarStringInquiry={pageKey === 'guitar-strings'}
          />
        </div>
      )}

      <div className="container local-seo-crosslinks">
        <div className="section-header narrow">
          <p className="eyebrow">Keep exploring</p>
          <h2>Related gear and local support</h2>
        </div>
        <div className="local-seo-link-grid">
          {RELATED_PAGES[pageKey].map((key) => (
            <Link
              className="local-seo-link-card interactive-card-link"
              to={toPath(canonicalUrlFor(key))}
              key={key}
            >
              <span className="local-seo-link-label">{pages[key].eyebrow}</span>
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
