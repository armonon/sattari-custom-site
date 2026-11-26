export const METRIC_EVENTS = [
  'page_view',
  'product_view',
  'product_link_click',
  'purchase_after_product_visit',
  'inquiry_link_click',
  'tuner_reference_started',
  'tuner_microphone_started',
  'tuner_repair_click',
  'tuner_shop_click',
  'cart_add',
  'cart_view',
  'checkout_started',
  'purchase_verified',
  'inquiry_sent',
  'booking_requested',
  'contact_click',
  'directions_click',
  'separator_started',
  'separator_completed',
  'separator_failed',
  'stem_download',
  'separator_cancelled',
  'stem_preview',
  'mix_exported',
  'separator_report_exported',
  'keybpm_started',
  'keybpm_completed',
  'keybpm_failed',
  'keybpm_cancelled',
  'keybpm_preview',
  'keybpm_corrected',
  'keybpm_report_exported',
  'keybpm_csv_exported',
  'continue_to_keybpm',
  'continue_to_separator',
  'continue_to_songboard',
  'feedback_opened',
  'learn_started',
  'learn_completed',
  'learn_failed',
  'practice_started',
  'practice_completed',
  'software_download',
  'studio_imported',
  'studio_exported',
];
export const METRIC_SOURCES = [
  'chatgpt',
  'perplexity',
  'claude',
  'copilot',
  'gemini',
  'google',
  'google_business_profile',
  'bing',
  'other_referral',
  'direct',
];
const tunerPages = {
  '/tuner/guitar': 'tuner-guitar',
  '/tuner/violin': 'tuner-violin',
  '/tuner/viola': 'tuner-viola',
  '/tuner/bass': 'tuner-bass',
  '/tuner/cello': 'tuner-cello',
  '/tuner/ukulele': 'tuner-ukulele',
};
const salesPages = {
  '/shop/instruments-los-angeles': 'sales-instruments-la',
  '/shop/guitars-los-angeles': 'sales-guitars-la',
  '/shop/violins-los-angeles': 'sales-violins-la',
  '/shop/drums-los-angeles': 'sales-drums-la',
  '/shop/accessories-los-angeles': 'sales-accessories-la',
  '/guitar-strings-woodland-hills': 'sales-guitar-strings',
  '/violin-strings-woodland-hills': 'sales-violin-strings',
};
const repairPages = {
  '/services/instrument-repair-los-angeles': 'repair-la',
  '/services/instrument-repair-woodland-hills': 'repair-woodland-hills',
  '/services/instrument-repair-calabasas': 'repair-calabasas',
  '/services/violin-repair-los-angeles': 'repair-violin-la',
  '/services/guitar-setup-los-angeles': 'setup-guitar-la',
  '/services/guitar-restringing-woodland-hills': 'restring-guitar',
  '/services/violin-restringing-woodland-hills': 'restring-violin',
  '/services/string-replacement-woodland-hills': 'replace-string',
};
const guidePages = {
  '/guides/how-to-separate-vocals-drums-bass': 'guide-separation',
  '/guides/practice-bass-with-isolated-stems': 'guide-bass',
  '/guides/learn-guitar-from-a-song': 'guide-guitar',
  '/guides/instrument-repairs-near-encino': 'guide-repair',
  '/guides/choose-your-first-cymbals': 'guide-cymbals',
  '/guides/remove-vocals-for-karaoke': 'guide-karaoke',
  '/guides/make-drumless-practice-tracks': 'guide-drumless',
  '/guides/find-song-key-and-bpm': 'guide-key-bpm',
  '/guides/batch-separate-audio-stems': 'guide-batch',
  '/guides/when-does-my-guitar-need-a-setup': 'guide-guitar-setup',
  '/guides/how-to-tune-a-snare-drum': 'guide-snare-tuning',
  '/guides/beginner-violin-care': 'guide-violin-care',
  '/guides/choose-a-violin-for-beginners': 'guide-violin-choice',
  '/guides/drumsticks-for-beginners': 'guide-drumsticks',
  '/guides/choose-a-practice-drum-pad': 'guide-practice-pad',
  '/guides/choose-a-beginner-acoustic-guitar': 'guide-acoustic-guitar',
  '/guides/how-to-care-for-a-guitar': 'guide-guitar-care',
  '/guides/how-to-choose-a-viola': 'guide-viola-choice',
  '/guides/violin-vs-viola': 'guide-violin-viola',
  '/guides/acoustic-vs-electric-violin': 'guide-violin-types',
  '/guides/how-to-choose-an-electric-guitar': 'guide-electric-choice',
  '/guides/how-to-choose-a-bass-guitar': 'guide-bass-choice',
  '/guides/nylon-vs-steel-string-guitar': 'guide-guitar-strings',
  '/guides/history-of-the-persian-tar': 'guide-tar-history',
  '/guides/history-of-the-guitar': 'guide-guitar-history',
  '/guides/tar-setar-and-sitar': 'guide-tar-setar-sitar',
  '/guides/instruments-of-iran': 'guide-iran-instruments',
};
export const PRODUCT_ORIGIN_PAGES = [...Object.values(salesPages), 'guide-violin-choice'];
export const METRIC_PAGES = [
  'home',
  'about',
  'shop',
  'product',
  'cart',
  'purchase',
  'services',
  'local',
  'visit',
  'hub',
  'stem-separator',
  'split',
  'key-bpm',
  'studio',
  'learn',
  'guides',
  ...Object.values(guidePages),
  'tool-details',
  'privacy',
  'downloads',
  ...Object.values(tunerPages),
  ...Object.values(salesPages),
  ...Object.values(repairPages),
];

export function metricPage(path) {
  path = path.replace(/\/+$/, '').toLowerCase() || '/';
  const specificPage =
    tunerPages[path] || salesPages[path] || repairPages[path] || guidePages[path];
  if (specificPage) return specificPage;
  if (path === '/') return 'home';
  if (path === '/cart') return 'cart';
  if (path.startsWith('/shop')) return 'shop';
  if (path.startsWith('/product/')) return 'product';
  if (path.startsWith('/services')) return 'services';
  if (
    path.endsWith('-music-store') ||
    ['/woodland-hills-drum-shop', '/encino-violin-shop'].includes(path)
  )
    return 'local';
  if (path.startsWith('/tools/')) return 'tool-details';
  // Flagship tools and their established lab URLs.
  if (path === '/studio/split') return 'split';
  if (path === '/studio/keybpm') return 'key-bpm';

  const publicPaths = [
    '/about',
    '/hub',
    '/stem-separator',
    '/studio',
    '/learn',
    '/guides',
    '/visit',
    '/privacy',
    '/downloads',
  ];
  return publicPaths.includes(path) ? path.slice(1) : null;
}

// Only bounded event IDs travel to the collector, never hrefs or query parameters.
export function internalLinkMetric(fromPath, destination) {
  const from = fromPath.replace(/\/+$/, '').toLowerCase() || '/';
  const to = destination.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const tuner = tunerPages[from] || from === '/studio/keybpm';
  if (tuner && repairPages[to]) return 'tuner_repair_click';
  if (
    tuner &&
    (to === '/shop' || to.startsWith('/shop/') || to.startsWith('/product/') || salesPages[to])
  )
    return 'tuner_shop_click';
  if (to.startsWith('/product/') && PRODUCT_ORIGIN_PAGES.includes(metricPage(from)))
    return 'product_link_click';
  if (
    from === to &&
    ['#local-inquiry', '#repair-inquiry', '#service-inquiry'].includes(destination.hash)
  )
    return 'inquiry_link_click';
  return null;
}

export function referralSource(referrer = '', search = '', origin = 'https://sattarimusic.com') {
  const campaign = new URLSearchParams(search).get('utm_source')?.toLowerCase();
  const campaigns = {
    google: 'google',
    google_business_profile: 'google_business_profile',
    gbp: 'google_business_profile',
    gmb: 'google_business_profile',
    bing: 'bing',
    chatgpt: 'chatgpt',
    'chatgpt.com': 'chatgpt',
    perplexity: 'perplexity',
    'perplexity.ai': 'perplexity',
    claude: 'claude',
    'claude.ai': 'claude',
    copilot: 'copilot',
    'copilot.microsoft.com': 'copilot',
    gemini: 'gemini',
    'gemini.google.com': 'gemini',
  };
  if (Object.hasOwn(campaigns, campaign)) return campaigns[campaign];
  if (!referrer) return 'direct';
  let url;
  try {
    url = new URL(referrer);
  } catch {
    return 'direct';
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.origin === origin) return 'direct';
  const host = url.hostname.toLowerCase();
  for (const [domain, source] of [
    ['chatgpt.com', 'chatgpt'],
    ['chat.openai.com', 'chatgpt'],
    ['perplexity.ai', 'perplexity'],
    ['claude.ai', 'claude'],
    ['copilot.microsoft.com', 'copilot'],
    ['gemini.google.com', 'gemini'],
    ['google.com', 'google'],
    ['bing.com', 'bing'],
  ]) {
    if (host === domain || host.endsWith(`.${domain}`)) return source;
  }
  return 'other_referral';
}

export function validMetric(value) {
  return Boolean(
    value &&
    Object.keys(value).length === 3 &&
    METRIC_EVENTS.includes(value.event) &&
    METRIC_PAGES.includes(value.page) &&
    METRIC_SOURCES.includes(value.source)
  );
}
