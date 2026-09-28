export const METRIC_EVENTS = [
  'page_view',
  'inquiry_sent',
  'booking_requested',
  'contact_click',
  'directions_click',
  'separator_started',
  'separator_completed',
  'separator_failed',
  'stem_download',
  'learn_started',
  'learn_completed',
  'learn_failed',
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
  'bing',
  'other_referral',
  'direct',
];
export const METRIC_PAGES = [
  'home',
  'about',
  'shop',
  'product',
  'services',
  'local',
  'visit',
  'hub',
  'stem-separator',
  'studio',
  'learn',
  'guides',
  'guide-separation',
  'guide-bass',
  'guide-repair',
  'guide-cymbals',
  'guide-karaoke',
  'guide-drumless',
  'guide-key-bpm',
  'guide-batch',
  'tool-details',
  'privacy',
  'downloads',
];

export function metricPage(path) {
  if (path === '/') return 'home';
  if (path.startsWith('/shop')) return 'shop';
  if (path.startsWith('/product/')) return 'product';
  if (path.startsWith('/services')) return 'services';
  if (
    path.endsWith('-music-store') ||
    ['/woodland-hills-drum-shop', '/encino-violin-shop'].includes(path)
  )
    return 'local';
  if (path.startsWith('/tools/')) return 'tool-details';
  const guides = {
    '/guides/how-to-separate-vocals-drums-bass': 'guide-separation',
    '/guides/practice-bass-with-isolated-stems': 'guide-bass',
    '/guides/instrument-repairs-near-encino': 'guide-repair',
    '/guides/choose-your-first-cymbals': 'guide-cymbals',
    '/guides/remove-vocals-for-karaoke': 'guide-karaoke',
    '/guides/make-drumless-practice-tracks': 'guide-drumless',
    '/guides/find-song-key-and-bpm': 'guide-key-bpm',
    '/guides/batch-separate-audio-stems': 'guide-batch',
  };
  return guides[path] || (METRIC_PAGES.includes(path.slice(1)) ? path.slice(1) : null);
}

export function referralSource(referrer = '', search = '', origin = 'https://sattarimusic.com') {
  const campaign = new URLSearchParams(search).get('utm_source')?.toLowerCase();
  const campaigns = {
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
