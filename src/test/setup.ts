import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { format } from 'node:util';

// React warnings fail the test that caused them: an update outside act(), a
// missing key, an unknown DOM prop or a hydration mismatch is either a real bug
// or a state change the test never waited for. A test that expects one spies
// on console.error itself. Functions under test log failures as one-line JSON
// (server/log.js); tests assert those where they matter, so they are not
// printed. Everything else a component logs is printed.
const REACT_WARNING = /^Warning: |not wrapped in act\(|Hydration failed/;
const STRUCTURED_LOG = /^\{"type":"/;
const printError = console.error.bind(console);
let reactWarnings: string[] = [];
console.error = (...args: unknown[]) => {
  const message = format(...args);
  if (REACT_WARNING.test(message)) reactWarnings.push(message.split('\n')[0]);
  else if (!STRUCTURED_LOG.test(message)) printError(...args);
};

afterEach(() => {
  cleanup();
  const warnings = reactWarnings;
  reactWarnings = [];
  if (warnings.length) throw new Error(`React warned during this test:\n${warnings.join('\n')}`);
});

// jsdom has no media playback and reports every call as "not implemented".
// Tests that care about play/pause spy on these.
if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => {};
  HTMLMediaElement.prototype.load = () => {};
}
// Nor scrolling: tests that check it stub window.scrollTo (vi.stubGlobal).
if (typeof window !== 'undefined') window.scrollTo = () => {};

// Mock window.matchMedia
if (typeof window !== 'undefined')
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
