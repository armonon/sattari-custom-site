import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { measurementPreference, setMeasurementPreference, trackSiteEvent } from './siteMeasurement';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('window', {
    location: {
      hostname: 'sattarimusic.com',
      pathname: '/learn',
      search: '',
      origin: 'https://sattarimusic.com',
    },
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal('document', { referrer: 'https://chatgpt.com/c/private-thread?private=data' });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true }))
  );
});
afterEach(() => vi.unstubAllGlobals());
it('sends nothing before consent or after withdrawal', () => {
  trackSiteEvent('learn_completed');
  expect(fetch).not.toHaveBeenCalled();
  setMeasurementPreference(true);
  trackSiteEvent('learn_completed');
  expect(fetch).toHaveBeenCalledTimes(1);
  setMeasurementPreference(false);
  trackSiteEvent('learn_completed');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('sattari-referral-v1')).toBeNull();
});
it('sends only an allowlisted source, page group and event', () => {
  setMeasurementPreference(true);
  trackSiteEvent('learn_completed');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    source: 'chatgpt',
    page: 'learn',
    event: 'learn_completed',
  });
  expect(fetch.mock.calls[0][1]).toMatchObject({
    referrerPolicy: 'no-referrer',
    credentials: 'omit',
  });
});
it.each([{ globalPrivacyControl: true }, { doNotTrack: '1' }])(
  'honors browser privacy signal %s',
  (signal) => {
    vi.stubGlobal('navigator', signal);
    setMeasurementPreference(true);
    trackSiteEvent('learn_completed');
    expect(measurementPreference()).toBe('denied');
    expect(fetch).not.toHaveBeenCalled();
  }
);
it('does not track drafts or sensitive checkout/status pages', () => {
  setMeasurementPreference(true);
  window.location.hostname = 'draft--sattari.netlify.app';
  trackSiteEvent('page_view');
  window.location.hostname = 'sattarimusic.com';
  window.location.pathname = '/studio-booking';
  trackSiteEvent('page_view');
  expect(fetch).not.toHaveBeenCalled();
});
it('analytics failure cannot break the tool', () => {
  setMeasurementPreference(true);
  fetch.mockRejectedValue(new Error('Offline'));
  expect(() => trackSiteEvent('learn_completed')).not.toThrow();
});
