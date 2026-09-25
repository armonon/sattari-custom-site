import { afterEach, expect, it, vi } from 'vitest';
import { loadStudioSession, saveStudioSession, SESSION_KEY } from './audioProjectStore';
afterEach(() => vi.unstubAllGlobals());
it('refuses to overwrite a session changed by another tab', () => {
  const items = new Map();
  const storage = {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
  vi.stubGlobal('localStorage', storage);
  expect(loadStudioSession()).toBeNull();
  saveStudioSession({ decks: [], sessionName: 'Our edits' });
  const other = JSON.stringify({
    schema: 'SattariStudio.session.v2',
    decks: [],
    sessionName: 'Other tab edits',
  });
  storage.setItem(SESSION_KEY, other);
  expect(() => saveStudioSession({ decks: [], sessionName: 'Would overwrite' })).toThrow(
    'Another Studio tab'
  );
  expect(storage.getItem(SESSION_KEY)).toBe(other);
  expect(loadStudioSession().sessionName).toBe('Other tab edits');
  expect(() => saveStudioSession({ decks: [], sessionName: 'Restored session' })).not.toThrow();
});
