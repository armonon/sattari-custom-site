import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatest } from '../hooks/useLatest';

export const MIXER_DOCK_KEY = 'stemdeck-mixer-dock-v1';
export const NARROW_DOCK_WIDTH = 900;
export const DOCK_MODES = ['compact', 'full'];
/** The removed Mix tab; a view request for it opens Perform with the dock. */
export const LEGACY_MIXER_VIEW = 'mixer';

const defaultMode = () =>
  typeof window !== 'undefined' && window.innerWidth <= NARROW_DOCK_WIDTH ? 'compact' : 'full';

// Until a size is chosen, the dock opens compact on narrow screens and full otherwise.
function readDock() {
  let saved = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(MIXER_DOCK_KEY) || 'null');
  } catch {
    // Private or blocked storage: start closed with the screen's default size.
  }
  const chosen = DOCK_MODES.includes(saved?.mode) ? saved.mode : null;
  return { open: saved?.open === true, mode: chosen || defaultMode(), chosen: Boolean(chosen) };
}

/**
 * The docked mixer's state: closed, compact or full, remembered on this
 * device. Opening from the keyboard moves focus to the dock heading; closing
 * while focus is inside the dock returns it to where it was before opening.
 */
export function useMixerDock() {
  const [dock, setDock] = useState(readDock);
  const latest = useLatest(dock);
  const dockRef = useRef(null);
  const headingRef = useRef(null);
  const toggleRef = useRef(null);
  const opener = useRef(null);
  const focusOnOpen = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MIXER_DOCK_KEY,
        JSON.stringify({ open: dock.open, mode: dock.chosen ? dock.mode : null })
      );
    } catch {
      // The dock still works for this visit without storage.
    }
  }, [dock]);

  useEffect(() => {
    if (!dock.open || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    headingRef.current?.focus();
  }, [dock.open]);

  const show = useCallback(
    ({ focus = false } = {}) => {
      if (focus) {
        if (!dockRef.current?.contains(document.activeElement))
          opener.current = document.activeElement;
        if (latest.current.open) headingRef.current?.focus();
        else focusOnOpen.current = true;
      }
      setDock((current) =>
        current.open
          ? current
          : { ...current, open: true, mode: current.chosen ? current.mode : defaultMode() }
      );
    },
    [latest]
  );

  const hide = useCallback(() => {
    const root = dockRef.current;
    if (root?.contains(document.activeElement)) {
      const previous = opener.current;
      const target =
        previous?.isConnected && previous !== document.body && !root.contains(previous)
          ? previous
          : toggleRef.current;
      target?.focus();
    }
    opener.current = null;
    focusOnOpen.current = false;
    setDock((current) => (current.open ? { ...current, open: false } : current));
  }, []);

  const toggle = useCallback(
    (options) => (latest.current.open ? hide() : show(options)),
    [hide, latest, show]
  );

  const setMode = useCallback(
    (mode) => setDock((current) => ({ ...current, mode, chosen: true })),
    []
  );

  return {
    open: dock.open,
    mode: dock.mode,
    state: dock.open ? dock.mode : 'closed',
    show,
    hide,
    toggle,
    setMode,
    dockRef,
    headingRef,
    toggleRef,
  };
}

/** The workspace view; the removed Mix tab maps to Perform with the dock open. */
export function useWorkspaceView(showDock, initialView = 'decks') {
  const [view, setView] = useState(() =>
    initialView === LEGACY_MIXER_VIEW ? 'decks' : initialView
  );
  const legacyStart = useRef(initialView === LEGACY_MIXER_VIEW);
  useEffect(() => {
    if (!legacyStart.current) return;
    legacyStart.current = false;
    showDock();
  }, [showDock]);
  const changeView = useCallback(
    (next) => {
      if (next !== LEGACY_MIXER_VIEW) {
        setView(next);
        return;
      }
      showDock();
      setView('decks');
    },
    [showDock]
  );
  return [view, changeView];
}
