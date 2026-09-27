import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLatest } from './useLatest';

/**
 * Turns a continuous control gesture into one undoable edit. While a pointer
 * or key is held, `update(changes, true)` applies each value live; releasing
 * it (or leaving the control) calls `commit()` once if anything changed.
 * A change outside a gesture, e.g. from assistive technology, is applied as a
 * normal edit with `update(changes, false)`.
 */
export function useLiveEdit(update, commit) {
  const gesture = useRef({ active: false, dirty: false });
  const latest = useLatest({ update, commit });

  const end = useCallback(() => {
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    const state = gesture.current;
    state.active = false;
    if (!state.dirty) return;
    state.dirty = false;
    latest.current.commit();
  }, [latest]);

  const begin = useCallback(() => {
    gesture.current.active = true;
  }, []);

  // The pointer may be released outside the control after dragging past it.
  const beginPointer = useCallback(() => {
    begin();
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }, [begin, end]);

  // A gesture still open when the control unmounts is committed, not lost.
  useEffect(() => end, [end]);

  const change = useCallback(
    (changes) => {
      const state = gesture.current;
      if (state.active) state.dirty = true;
      latest.current.update(changes, state.active);
    },
    [latest]
  );

  const handlers = useMemo(
    () => ({
      onPointerDown: beginPointer,
      onPointerUp: end,
      onPointerCancel: end,
      onKeyDown: begin,
      onKeyUp: end,
      onBlur: end,
    }),
    [begin, beginPointer, end]
  );

  return { change, handlers };
}
