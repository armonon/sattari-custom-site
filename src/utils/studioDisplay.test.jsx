/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { COMPACT_ICONS_KEY, useCompactIcons } from './studioDisplay';

beforeEach(() => localStorage.removeItem(COMPACT_ICONS_KEY));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(COMPACT_ICONS_KEY);
});

it('defaults to symbols and remembers opting out across mounts', () => {
  const first = renderHook(useCompactIcons);
  expect(first.result.current[0]).toBe(true);
  act(() => first.result.current[1](false));
  expect(localStorage.getItem(COMPACT_ICONS_KEY)).toBe('false');
  first.unmount();
  const second = renderHook(useCompactIcons);
  expect(second.result.current[0]).toBe(false);
  act(() => second.result.current[1](true));
  expect(localStorage.getItem(COMPACT_ICONS_KEY)).toBe('true');
});

it('uses its default for invalid saved preferences', () => {
  localStorage.setItem(COMPACT_ICONS_KEY, 'broken');
  expect(renderHook(useCompactIcons).result.current[0]).toBe(true);
});

it('still toggles when local storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Blocked');
  });
  const { result } = renderHook(useCompactIcons);
  expect(result.current[0]).toBe(true);
  act(() => result.current[1](false));
  expect(result.current[0]).toBe(false);
});
