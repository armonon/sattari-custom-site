import { describe, expect, it } from 'vitest';
import { metricPage, referralSource, validMetric } from './siteMetrics';
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
});
