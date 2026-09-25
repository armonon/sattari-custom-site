import { describe, expect, it } from 'vitest';
import { metricPage, referralSource, validMetric } from './siteMetrics';

describe('privacy-bounded metrics', () => {
  it.each([
    ['https://chatgpt.com/c/private-thread', '', 'chatgpt'],
    ['https://www.perplexity.ai/search/private-query', '', 'perplexity'],
    ['https://claude.ai/chat/private', '', 'claude'],
    ['https://copilot.microsoft.com/', '', 'copilot'],
    ['https://gemini.google.com/', '', 'gemini'],
    ['https://google.com/search?q=private', '', 'google'],
    ['', '?utm_source=chatgpt.com', 'chatgpt'],
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
  it('rejects extra fields and unknown values', () => {
    const metric = { source: 'chatgpt', page: 'learn', event: 'learn_completed' };
    expect(validMetric(metric)).toBe(true);
    expect(validMetric({ ...metric, filename: 'private.wav' })).toBe(false);
    expect(validMetric({ ...metric, source: 'https://chatgpt.com' })).toBe(false);
    expect(validMetric(null)).toBe(false);
  });
});
