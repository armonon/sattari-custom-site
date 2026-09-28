import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  applyTheme,
  getStoredPreference,
  INITIAL_RENDER_THEME,
  msUntilNextThemeBoundary,
  PREFERS_DARK_QUERY,
  resolveTheme,
  storePreference,
  type ThemeMode,
  type ThemePreference,
} from '@utils/theme';

interface ThemeContextValue {
  /** What the user selected: `auto`, `day`, or `night`. */
  preference: ThemePreference;
  /** The concrete look currently applied. */
  mode: ThemeMode;
  /**
   * False until the visitor's theme has been read, after mount. Until then
   * `mode` is the placeholder the prerendered HTML was rendered with (the page
   * itself already shows the right theme through CSS), so anything that would
   * load theme-specific media from `mode` should wait for this.
   */
  ready: boolean;
  setPreference: (preference: ThemePreference) => void;
  /** Cycle auto → day → night → auto, for a single toggle control. */
  cyclePreference: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The first render must match the prerendered HTML, which cannot know this
  // visitor's choice, OS setting or clock. index.html's inline script has
  // already painted the right palette through <html data-theme>, and the CSS
  // keys off that attribute, so reading the real preference after mount
  // changes nothing on screen. `null` means "not read yet".
  const [storedPreference, setPreferenceState] = useState<ThemePreference | null>(null);
  const [mode, setMode] = useState<ThemeMode>(INITIAL_RENDER_THEME);
  const timerRef = useRef<number>();
  const preference = storedPreference ?? 'auto';
  const ready = storedPreference !== null;

  useEffect(() => {
    const stored = getStoredPreference();
    // A transition, like every update the providers make right after mount:
    // React hydrates the page inside its Suspense boundary after the rest, and
    // an urgent context change arriving first can make it throw the server
    // HTML away and render the page again. A transition waits for hydration.
    startTransition(() => {
      setPreferenceState(stored);
      setMode(resolveTheme(stored));
    });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    storePreference(next);
  }, []);

  const cyclePreference = useCallback(() => {
    // The toggle is a plain day/night switch. New visitors start on `auto`
    // (follows the system); the first tap flips to the opposite of what's shown
    // and from then on it stays a manual day ⇄ night choice.
    setPreferenceState((current) => {
      const next: ThemePreference = resolveTheme(current ?? 'auto') === 'day' ? 'night' : 'day';
      storePreference(next);
      return next;
    });
  }, []);

  useEffect(() => {
    // Until the stored choice is read, leave the pre-paint theme alone: syncing
    // 'auto' here would briefly override a visitor's explicit day/night choice.
    if (storedPreference === null) return;

    const clearTimer = () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };

    // Recompute the resolved mode and push it to the DOM.
    const sync = () => {
      const resolved = resolveTheme(preference);
      setMode(resolved);
      applyTheme(resolved);
    };

    sync();

    // Only `auto` needs to react to outside signals (OS setting, passing time).
    if (preference !== 'auto') {
      clearTimer();
      return;
    }

    // React immediately when the OS light/dark appearance changes.
    const darkQuery = window.matchMedia(PREFERS_DARK_QUERY);
    const handleOsChange = () => sync();
    darkQuery.addEventListener('change', handleOsChange);

    // Flip precisely when the clock crosses sunrise/sunset (used when the OS
    // states no preference), then reschedule.
    const scheduleBoundary = () => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        sync();
        scheduleBoundary();
      }, msUntilNextThemeBoundary());
    };

    scheduleBoundary();

    // A backgrounded tab's timer can be throttled/skipped, so re-check on return.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        sync();
        scheduleBoundary();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
      darkQuery.removeEventListener('change', handleOsChange);
    };
  }, [preference, storedPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, mode, ready, setPreference, cyclePreference }),
    [preference, mode, ready, setPreference, cyclePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
