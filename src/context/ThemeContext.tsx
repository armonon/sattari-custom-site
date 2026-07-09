import {
  createContext,
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
  setPreference: (preference: ThemePreference) => void;
  /** Cycle auto → day → night → auto, for a single toggle control. */
  cyclePreference: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredPreference());
  const [mode, setMode] = useState<ThemeMode>(() => resolveTheme(getStoredPreference()));
  const timerRef = useRef<number>();

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    storePreference(next);
  }, []);

  const cyclePreference = useCallback(() => {
    // The toggle is a plain day/night switch. New visitors start on `auto`
    // (follows the system); the first tap flips to the opposite of what's shown
    // and from then on it stays a manual day ⇄ night choice.
    setPreferenceState((current) => {
      const next: ThemePreference = resolveTheme(current) === 'day' ? 'night' : 'day';
      storePreference(next);
      return next;
    });
  }, []);

  useEffect(() => {
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
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, mode, setPreference, cyclePreference }),
    [preference, mode, setPreference, cyclePreference]
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
