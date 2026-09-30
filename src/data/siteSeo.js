export const SITE_ORIGIN = 'https://sattarimusic.com';

export const BUSINESS = {
  name: 'Sattari Music',
  alternateName: 'SATTARI Musical Instruments',
  telephone: '+1-424-465-3020',
  phoneDisplay: '(424) 465-3020',
  phoneHref: 'tel:+14244653020',
  addressLine: '4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364',
  shopHoursNote: 'By appointment only. Call to arrange your visit.',
  studioHoursNote: 'Every day, 6 PM to midnight (Los Angeles time).',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '4881 Topanga Canyon Blvd #202',
    addressLocality: 'Woodland Hills',
    addressRegion: 'CA',
    postalCode: '91364',
    addressCountry: 'US',
  },
  areas: ['Woodland Hills', 'Encino', 'Calabasas', 'Los Angeles', 'San Fernando Valley'],
  directions:
    'https://www.google.com/maps/dir/?api=1&destination=4881+Topanga+Canyon+Blvd+%23202,+Woodland+Hills,+CA+91364',
};

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_ORIGIN}/`).href;
}

export function canonicalUrl(value = '/') {
  const url = new URL(value, SITE_ORIGIN);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return absoluteUrl(path);
}

export const businessSchema = {
  '@context': 'https://schema.org',
  '@type': 'MusicStore',
  '@id': `${SITE_ORIGIN}/#business`,
  name: BUSINESS.name,
  alternateName: BUSINESS.alternateName,
  url: `${SITE_ORIGIN}/`,
  telephone: BUSINESS.telephone,
  address: BUSINESS.address,
  areaServed: BUSINESS.areas,
  hasMap: BUSINESS.directions,
  logo: absoluteUrl('/sattari site/sattari logo.png'),
  image: absoluteUrl('/sattari site/sattari logo.png'),
  sameAs: ['https://www.instagram.com/sattari.music/'],
  description:
    'Appointment-only Woodland Hills music store and drum shop with cymbals, drumsticks, violins, guitars, instrument repair, rentals and lessons, serving Encino, Calabasas and Los Angeles.',
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_ORIGIN}/#website`,
  url: `${SITE_ORIGIN}/`,
  name: BUSINESS.name,
  inLanguage: 'en-US',
  publisher: { '@id': businessSchema['@id'] },
};

export const PAGE_SEO = {
  home: {
    title: 'Woodland Hills Music Store & Drum Shop',
    description:
      'Shop cymbals, drumsticks, violins and guitars at Sattari Music in Woodland Hills. Instrument repairs, lessons and rehearsal space near Encino and Calabasas.',
    url: `${SITE_ORIGIN}/`,
    image: '/images/home/sattari-instruments-hero.jpg',
    imageWidth: 1536,
    imageHeight: 1024,
  },
  about: {
    title: 'About Us | Woodland Hills Music Store',
    description:
      'Meet Sattari Music and founder Mohammad Sattari. Instruments, craftsmanship and musician support in Woodland Hills, serving Encino, Calabasas and Los Angeles.',
    url: `${SITE_ORIGIN}/about`,
  },
  shop: {
    title: 'Musical Instruments for Sale | Woodland Hills',
    description:
      'Browse cymbals, drumsticks, acoustic and electric violins, guitars and bass. Shop Sattari online or ask our Woodland Hills music store about your next instrument.',
    url: `${SITE_ORIGIN}/shop`,
  },
  services: {
    title: 'Repairs, Rentals & Music Lessons | Woodland Hills',
    description:
      'Request guitar, violin or drum repair, instrument rentals, music lessons and rehearsal space in Woodland Hills, serving Encino, Calabasas and Los Angeles.',
    url: `${SITE_ORIGIN}/services`,
  },
  repair: {
    title: 'Los Angeles Instrument Repair Shop | Woodland Hills',
    description:
      'Guitar, violin, drum and percussion repair support at Sattari Music in Woodland Hills. Describe the issue and request an assessment before bringing in your gear.',
    url: `${SITE_ORIGIN}/services/instrument-repair-los-angeles`,
  },
  hub: {
    title: 'Online Music Tools | Separate, Learn & Create',
    description:
      'Explore Sattari Stem Separator, Studio and Learn: separate vocals, drums and bass, create music in your browser, and analyze songs for practice.',
    url: `${SITE_ORIGIN}/hub`,
    image: '/images/tools/studio.jpg',
    imageWidth: 1920,
    imageHeight: 1080,
  },
  separator: {
    title: 'Free AI Stem Separator & Vocal Remover',
    description:
      'Separate vocals, drums, bass and instruments in your browser. Free batch stem separation, song key and BPM estimates, WAV downloads. No sign-in.',
    url: `${SITE_ORIGIN}/stem-separator`,
    image: '/images/tools/separator.jpg',
    imageWidth: 1440,
    imageHeight: 1131,
  },
  studio: {
    title: 'StemDeck Online | Browser Music Studio',
    description:
      'Create and remix with StemDeck in Sattari Studio. A browser DAW with deck mixing, audio recording, MIDI instruments, an arranger and WAV export.',
    url: `${SITE_ORIGIN}/studio`,
    image: '/images/tools/studio.jpg',
    imageWidth: 1920,
    imageHeight: 1080,
  },
  learn: {
    title: 'Learn Guitar, One Song at a Time | Sattari Learn',
    description:
      'Learn guitar with guided songs, chord charts, tablature, sheet music and microphone feedback. Import your own audio or score and practice one phrase at a time.',
    url: `${SITE_ORIGIN}/learn`,
    image: '/images/tools/learn-guitar.jpg',
    imageWidth: 1280,
    imageHeight: 900,
  },
};

export const CATEGORY_LOCAL_HELP = {
  cymbals: {
    title: 'Choose cymbals with local support',
    copy: 'A hi-hat, crash and splash have different jobs in a kit. Share your playing style and current setup with our Woodland Hills team before choosing your next cymbal.',
    links: [
      { label: 'Woodland Hills drum shop', to: '/woodland-hills-drum-shop' },
      { label: 'Instrument repair and tuning', to: '/services/instrument-repair-los-angeles' },
    ],
  },
  sticks: {
    title: 'Find your next pair of sticks',
    copy: 'Compare wood, tip and size on each listing. Our Woodland Hills shop can help with questions about sticks for practice, rehearsals and your current kit.',
    links: [
      { label: 'Drum gear in Woodland Hills', to: '/woodland-hills-drum-shop' },
      { label: 'Practice pads and accessories', to: '/shop/essentials' },
    ],
  },
  essentials: {
    title: 'Complete your practice setup',
    copy: 'Check pad dimensions, accessory compatibility and what is included before ordering. Need help with a part or setup issue? Send the instrument model and a description to our Woodland Hills team.',
    links: [
      { label: 'Local drum shop', to: '/woodland-hills-drum-shop' },
      { label: 'Repair and setup inquiries', to: '/services/instrument-repair-los-angeles' },
    ],
  },
  violins: {
    title: 'Violin guidance near Encino',
    copy: "Shopping for your first violin or comparing acoustic and electric models? Start with your teacher's size requirements, playing goals and budget. Our shop is in Woodland Hills and serves Encino musicians.",
    links: [
      { label: 'Choosing a violin near Encino', to: '/encino-violin-shop' },
      { label: 'Violin repair and setup', to: '/services/violin-repair-los-angeles' },
    ],
  },
  'guitar-bass': {
    title: 'Guitar and bass support in Woodland Hills',
    copy: "Compare each instrument's specifications, then ask about fit, feel or setup before arranging a visit. We also take string, tuning and playability inquiries for instruments you already own.",
    links: [
      { label: 'Guitar and bass setup', to: '/services/guitar-setup-los-angeles' },
      { label: 'Music store near Calabasas', to: '/calabasas-music-store' },
    ],
  },
  all: {
    title: 'Shop online or plan a local visit',
    copy: 'Sattari Music is based at 4881 Topanga Canyon Blvd #202 in Woodland Hills. Shop visits are by appointment only. Call to arrange your visit and confirm in-store availability.',
    links: [
      { label: 'Visit our Woodland Hills music store', to: '/woodland-hills-music-store' },
      { label: 'Repairs, rentals and lessons', to: '/services' },
    ],
  },
};

export const CATEGORY_SEO = {
  cymbals: {
    title: 'Cymbals & Hi-Hats for Sale | Woodland Hills',
    description:
      'Compare Sattari Pirouz cymbals, hi-hats, splashes and effects. Shop online with drum gear and setup support from our Woodland Hills music store.',
  },
  sticks: {
    title: 'Drumsticks & Bundles | Woodland Hills Drum Gear',
    description:
      'Shop hickory and maple drumsticks, 5A and 7A options, nylon tips and bundles. Practice and gig essentials from Sattari Music in Woodland Hills, Los Angeles.',
  },
  essentials: {
    title: 'Practice Pads & Drum Accessories | Los Angeles',
    description:
      'Find drum practice pads, cymbal felts, stick bags and percussion accessories. Browse Sattari online or ask our Woodland Hills team what fits your setup.',
  },
  // The one violins page in search results: /shop/violins-los-angeles
  // canonicalizes here.
  violins: {
    title: 'Violins for Sale | Woodland Hills, Los Angeles',
    description:
      'Compare acoustic, electric and silent violins, plus strings and rosin. Sattari Music in Woodland Hills offers violin setup and repair support near Encino.',
  },
  'guitar-bass': {
    title: 'Guitars & Bass for Sale | Woodland Hills',
    description:
      'Shop electric, steel-string and nylon-string guitars, bass and accessories. Ask Sattari in Woodland Hills about setup and repair support near Calabasas.',
  },
  all: {
    title: 'All Instruments & Accessories | Sattari Catalog',
    description:
      'Browse the complete Sattari Music catalog: cymbals, sticks, violins, guitars, bass and accessories. Shop online with support from Woodland Hills, California.',
  },
};

export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, path }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: canonicalUrl(path),
    })),
  };
}

// Describes a browser tool's page. It is deliberately a WebPage about the tool,
// not a SoftwareApplication/WebApplication: Google only accepts app markup with
// a price offer plus ratings or reviews, which a free tool page does not have
// (and ratings must never be made up), so the app markup was flagged invalid.
export function musicToolSchema(key, features) {
  const page = PAGE_SEO[key];
  const name =
    key === 'separator'
      ? 'Sattari Stem Separator'
      : `Sattari ${key === 'studio' ? 'Studio' : 'Learn'}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${page.url}#webpage`,
    url: page.url,
    name,
    description: page.description,
    isAccessibleForFree: true,
    inLanguage: 'en-US',
    isPartOf: { '@id': websiteSchema['@id'] },
    keywords: features.join(', '),
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: absoluteUrl(`/images/tools/${key}.jpg`),
    },
    about: {
      '@type': 'Thing',
      name,
      description: 'Runs in the web browser. JavaScript and Web Audio support required.',
    },
    significantLink: absoluteUrl(`/tools/${key === 'separator' ? 'stem-separator' : key}`),
    publisher: { '@id': businessSchema['@id'] },
  };
}
