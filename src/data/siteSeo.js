export const SITE_ORIGIN = 'https://sattarimusic.com';

export const BUSINESS = {
  name: 'Sattari Music',
  alternateName: 'SATTARI Musical Instruments',
  telephone: '+1-424-465-3020',
  phoneDisplay: '(424) 465-3020',
  phoneHref: 'tel:+14244653020',
  addressLine: '4881 Topanga Canyon Blvd #202, Woodland Hills, CA 91364',
  shopHoursNote: 'Contact the shop to confirm hours and arrange your visit.',
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
    'Musical instruments, cymbals, accessories, repairs, rentals and lessons in Woodland Hills, serving Encino, Calabasas and Los Angeles.',
};

export const PAGE_SEO = {
  home: {
    title: 'Music Store in Woodland Hills',
    description:
      'Shop instruments, cymbals, violins, guitars and accessories at Sattari Music in Woodland Hills. Repairs, rentals and lessons for Encino, Calabasas and Los Angeles.',
    url: `${SITE_ORIGIN}/`,
  },
  shop: {
    title: 'Shop Musical Instruments & Accessories',
    description:
      'Shop Sattari cymbals, drumsticks, violins, guitars, bass and practice essentials online, with local instrument support in Woodland Hills, Los Angeles.',
    url: `${SITE_ORIGIN}/shop`,
  },
  services: {
    title: 'Instrument Repair, Rentals & Lessons | Woodland Hills',
    description:
      'Request instrument repair, rentals, music lessons or rehearsal space in Woodland Hills. Local support for musicians in Encino, Calabasas and Los Angeles.',
    url: `${SITE_ORIGIN}/services`,
  },
  repair: {
    title: 'Instrument Repair | Woodland Hills & Los Angeles',
    description:
      'Guitar, violin, drum and hardware repair in Woodland Hills. Ask Sattari Music about setups, tuning and repairs near Encino and Calabasas in Los Angeles.',
    url: `${SITE_ORIGIN}/services/instrument-repair-los-angeles`,
  },
  hub: {
    title: 'Sattari Hub | Online Music Tools',
    description:
      'Explore Sattari Stem Separator, Studio and Learn: separate vocals, drums and bass, create music in your browser, and analyze songs for practice.',
    url: `${SITE_ORIGIN}/hub`,
    image: '/images/tools/studio.jpg',
  },
  separator: {
    title: 'Stem Separator & Vocal Remover Online',
    description:
      'Separate vocals, drums, bass and instruments from multiple songs in your browser. Choose your stems and download WAV files. Audio stays on your device.',
    url: `${SITE_ORIGIN}/stem-separator`,
    image: '/images/tools/separator.jpg',
  },
  studio: {
    title: 'Sattari Studio | StemDeck Browser DAW',
    description:
      'Create and remix with StemDeck in Sattari Studio. A browser DAW with deck mixing, audio recording, MIDI instruments, an arranger and WAV export.',
    url: `${SITE_ORIGIN}/studio`,
    image: '/images/tools/studio.jpg',
  },
  learn: {
    title: 'Sattari Learn | Song Key, Chords & Rhythm Practice',
    description:
      'Explore song key, chord and tempo estimates with Sattari Learn. Build piano, guitar, bass and drum practice around your own audio in the browser.',
    url: `${SITE_ORIGIN}/learn`,
    image: '/images/tools/learn.jpg',
  },
};

export const CATEGORY_SEO = {
  cymbals: {
    title: 'Handcrafted Cymbals, Hi-Hats & Splashes',
    description:
      'Shop Sattari handcrafted cymbals, hi-hats and splashes. Explore cymbal options online with musician support from our Woodland Hills, Los Angeles shop.',
  },
  sticks: {
    title: 'Drumsticks & Drumstick Bundles',
    description:
      'Shop Sattari hickory and maple drumsticks, specialty sticks and bundles for practice, rehearsals and gigs. Musician gear from Woodland Hills, California.',
  },
  essentials: {
    title: 'Drum Accessories & Practice Essentials',
    description:
      'Find practice pads, cymbal felts, bags and instrument accessories from Sattari Music. Shop online or ask our Woodland Hills team about your setup.',
  },
  violins: {
    title: 'Acoustic, Electric & Silent Violins',
    description:
      'Shop Sattari acoustic, electric and silent violins, fitted and tuned in California. Find your violin with local support in Woodland Hills, Los Angeles.',
  },
  'guitar-bass': {
    title: 'Guitars, Bass & Guitar Accessories',
    description:
      'Shop electric and acoustic guitars, bass and accessories from Sattari Music. Instruments set up in California, with local support in Woodland Hills.',
  },
  all: {
    title: 'All Instruments, Cymbals & Music Accessories',
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

export function musicToolSchema(key, features) {
  const page = PAGE_SEO[key];
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': `${page.url}#application`,
    name:
      key === 'separator'
        ? 'Sattari Stem Separator'
        : `Sattari ${key === 'studio' ? 'Studio' : 'Learn'}`,
    url: page.url,
    description: page.description,
    applicationCategory: key === 'learn' ? 'EducationalApplication' : 'MultimediaApplication',
    operatingSystem: 'Web browser',
    browserRequirements: 'JavaScript and Web Audio support required.',
    isAccessibleForFree: true,
    screenshot: absoluteUrl(`/images/tools/${key}.jpg`),
    softwareHelp: {
      '@type': 'WebPage',
      url: absoluteUrl(`/tools/${key === 'separator' ? 'stem-separator' : key}`),
    },
    featureList: features,
    publisher: { '@id': businessSchema['@id'] },
  };
}
