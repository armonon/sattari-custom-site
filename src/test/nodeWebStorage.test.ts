import { expect, it } from 'vitest';

it('uses jsdom localStorage rather than Node process storage in browser tests', () => {
  expect(globalThis.localStorage).toBe(window.localStorage);
  globalThis.localStorage.setItem('__stemdeck_test_storage__', 'ok');
  expect(globalThis.localStorage.getItem('__stemdeck_test_storage__')).toBe('ok');
  globalThis.localStorage.removeItem('__stemdeck_test_storage__');
});
