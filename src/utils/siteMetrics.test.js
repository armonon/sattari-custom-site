import { describe, expect, it } from 'vitest';
import { internalLinkMetric, metricPage, referralSource, validMetric } from './siteMetrics';
import { musicGuides } from '../data/musicGuides';

describe('privacy-bounded metrics', () => {
  it.each([
    ['https://chatgpt.com/c/private-thread', '', 'chatgpt'],
    ['https://www.perplexity.ai/search/private-query', '', 'perplexity'],
    ['https://claude.ai/chat/private', '', 'claude'],
    ['https://copilot.microsoft.com/', '', 'copilot'],
    ['https://gemini.google.com/', '', 'gemini'],
    ['https://google.com/search?q=private', '', 'google'],
    ['', '?utm_source=chatgpt.com', 'chatgpt'],
    ['', '?utm_source=perplexity.ai', 'perplexity'],
    ['', '?utm_source=CLAUDE.AI', 'claude'],
    ['', '?utm_source=copilot.microsoft.com', 'copilot'],
    ['', '?utm_source=gemini.google.com', 'gemini'],
    ['', '?utm_source=chatgpt.com.attacker.test', 'direct'],
    ['https://chatgpt.com.attacker.test/', '', 'other_referral'],
    ['https://sattarimusic.com/learn', '', 'direct'],
    ['', '?email=private@example.com', 'direct'],
  ])('classifies only source labels: %s', (url, search, expected) => {
    expect(referralSource(url, search)).toBe(expected);
  });
  it('does not measure private pages or arbitrary filenames', () => {
    expect(metricPage('/studio-booking')).toBeNull();
    expect(metricPage('/checkout/success')).toBeNull();
    expect(metricPage('/private-song.wav')).toBeNull();
    expect(metricPage('/product/a-specific-product')).toBe('product');
    expect(metricPage('/studio/split')).toBe('split');
    expect(metricPage('/studio/keybpm')).toBe('key-bpm');
    expect(metricPage('/stem-separator')).toBe('stem-separator');
    for (const event of ['mix_exported', 'keybpm_corrected', 'continue_to_separator'])
      expect(validMetric({ source: 'direct', page: 'key-bpm', event })).toBe(true);
  });
  it('recognizes every published guide using only coarse allowlisted page groups', () => {
    const groups = musicGuides.map((guide) => metricPage(`/guides/${guide.slug}`));
    expect(new Set(groups).size).toBe(musicGuides.length);
    for (const page of groups) {
      expect(page).toMatch(/^guide-/);
      expect(validMetric({ source: 'chatgpt', page, event: 'page_view' })).toBe(true);
    }
    expect(metricPage('/guides/private-filename.wav')).toBeNull();
    expect(metricPage('/about')).toBe('about');
    expect(metricPage('/woodland-hills-drum-shop')).toBe('local');
    expect(metricPage('/encino-violin-shop')).toBe('local');
  });
  it('rejects extra fields and unknown values', () => {
    const metric = { source: 'chatgpt', page: 'learn', event: 'learn_completed' };
    expect(validMetric(metric)).toBe(true);
    expect(validMetric({ ...metric, filename: 'private.wav' })).toBe(false);
    expect(validMetric({ ...metric, source: 'https://chatgpt.com' })).toBe(false);
    expect(validMetric(null)).toBe(false);
  });
  it.each(['practice_started', 'practice_completed', 'software_download'])(
    'accepts the coarse %s event without musical or file data',
    (event) => {
      const metric = {
        source: 'direct',
        page: event === 'software_download' ? 'downloads' : 'learn',
        event,
      };
      expect(validMetric(metric)).toBe(true);
      expect(validMetric({ ...metric, score: 80 })).toBe(false);
      expect(validMetric({ ...metric, filename: 'my-song.wav' })).toBe(false);
    }
  );
});

it('groups commercial pages and Google campaign tags without retaining queries', () => {
  expect(metricPage('/guitar-strings-woodland-hills')).toBe('sales-guitar-strings');
  expect(metricPage('/violin-strings-woodland-hills')).toBe('sales-violin-strings');
  expect(metricPage('/cart')).toBe('cart');
  expect(
    referralSource('', '?utm_source=google_business_profile&utm_medium=organic&private=omit')
  ).toBe('google_business_profile');
  expect(validMetric({ event: 'purchase_verified', page: 'purchase', source: 'google' })).toBe(
    true
  );
  expect(
    validMetric({
      event: 'purchase_verified',
      page: 'purchase',
      source: 'google',
      session: 'private',
    })
  ).toBe(false);
});

it('registers every dedicated tuner with only the published instrument labels', () => {
  for (const slug of ['guitar', 'violin', 'viola', 'bass', 'cello', 'ukulele']) {
    const page = metricPage('/tuner/' + slug + '/');
    expect(page).toBe('tuner-' + slug);
    expect(
      validMetric({ event: 'tuner_reference_started', page, source: 'google_business_profile' })
    ).toBe(true);
  }
  expect(metricPage('/tuner/unknown-song.mp3')).toBeNull();
  expect(metricPage('/tuner-guitar')).toBeNull();
  expect(referralSource('', '?utm_source=gmb')).toBe('google_business_profile');
});

it.each([
  ['/tuner/guitar', '/services/guitar-restringing-woodland-hills', 'tuner_repair_click'],
  ['/studio/keybpm', '/shop', 'tuner_shop_click'],
  ['/tuner/bass', '/product/five-string-bass-guitar', 'tuner_shop_click'],
  ['/tuner/bass', '/guides/practice-bass-with-isolated-stems', null],
  ['/shop/guitars-los-angeles', '/product/five-string-bass-guitar', 'product_link_click'],
  [
    '/guides/choose-a-violin-for-beginners',
    '/product/brescia-acoustic-violin',
    'product_link_click',
  ],
  ['/shop/guitars-los-angeles', '/shop/guitars-los-angeles#local-inquiry', 'inquiry_link_click'],
  ['/shop/guitars-los-angeles', '/services/instrument-repair-los-angeles#repair-inquiry', null],
])('maps %s → %s to a bounded action', (source, href, event) => {
  expect(internalLinkMetric(source, new URL(href, 'https://sattarimusic.com'))).toBe(event);
});
