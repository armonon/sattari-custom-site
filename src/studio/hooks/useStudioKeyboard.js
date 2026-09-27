import { useEffect } from 'react';
import { useLatest } from './useLatest';

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const typingIn = (target) =>
  /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
  target.isContentEditable ||
  Boolean(target.closest?.('[contenteditable]:not([contenteditable="false"])'));

const mixerKey = (event) =>
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  !event.shiftKey &&
  (event.key === 'F9' || String(event.key).toLowerCase() === 'm');

/**
 * Global shortcuts: 1-8 trigger pads, Space toggles the transport, M or F9
 * (FL Studio's mixer key) toggles the mixer dock, and in Arrange Ctrl/Cmd+Z
 * undoes (+Shift redoes). None fire while typing. The window listener is
 * bound once and always dispatches to the latest handlers.
 */
export function useStudioKeyboard({ activeView, triggerPad, toggleTransport, undo, toggleMixer }) {
  const handlers = useLatest({ activeView, triggerPad, toggleTransport, undo, toggleMixer });
  useEffect(() => {
    const onKeyDown = (event) => {
      if (typingIn(event.target) || event.repeat) return;
      const current = handlers.current;
      // A focused button or link keeps the mixer key: it does not type or activate.
      if (mixerKey(event)) {
        event.preventDefault();
        current.toggleMixer?.();
        return;
      }
      if (/^(BUTTON|A)$/.test(event.target.tagName)) return;
      const padIndex = PAD_KEYS.indexOf(event.key);
      if (padIndex >= 0) {
        event.preventDefault();
        void current.triggerPad(padIndex);
      }
      if (event.code === 'Space') {
        event.preventDefault();
        void current.toggleTransport();
      }
      // Shift turns the key into 'Z' on Windows, Linux and in Firefox.
      if (
        current.activeView === 'arranger' &&
        (event.metaKey || event.ctrlKey) &&
        String(event.key).toLowerCase() === 'z'
      ) {
        event.preventDefault();
        current.undo(event.shiftKey);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
