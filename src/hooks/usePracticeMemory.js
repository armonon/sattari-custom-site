import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearPracticeStates,
  deletePracticeState,
  loadPracticeStates,
  savePracticeState,
} from '../utils/practiceStore';

const SAVE_DELAY = 400;

/**
 * Remembers each song's practice setup in this browser.
 *
 * ready: saved setups have been read (or storage is unavailable), so a player
 *   can mount with its initial state. get(id) → stored state or null.
 * save(id, state): debounced write; pending writes flush when the page hides.
 * Storage failures are silent: the player keeps working, it just won't remember.
 */
export default function usePracticeMemory() {
  const states = useRef(new Map());
  const pending = useRef(new Map());
  const timer = useRef(null);
  const [ready, setReady] = useState(false);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    for (const [id, state] of pending.current) savePracticeState(id, state).catch(() => {});
    pending.current.clear();
  }, []);

  useEffect(() => {
    let live = true;
    loadPracticeStates()
      .then((loaded) => {
        if (!live) return;
        // Anything changed before storage answered wins over the stored copy.
        for (const [id, state] of loaded)
          if (!states.current.has(id)) states.current.set(id, state);
      })
      .catch(() => {})
      .finally(() => live && setReady(true));
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      live = false;
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
  }, [flush]);

  const get = useCallback((id) => states.current.get(id) || null, []);
  const save = useCallback(
    (id, state) => {
      states.current.set(id, state);
      pending.current.set(id, state);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY);
    },
    [flush]
  );
  const forget = useCallback((id) => {
    states.current.delete(id);
    pending.current.delete(id);
    deletePracticeState(id).catch(() => {});
  }, []);
  const forgetAll = useCallback(() => {
    states.current.clear();
    pending.current.clear();
    clearTimeout(timer.current);
    return clearPracticeStates().catch(() => {});
  }, []);

  return { ready, get, save, forget, forgetAll };
}
