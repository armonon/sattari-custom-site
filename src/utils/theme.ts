/**
 * Time-of-day theming.
 *
 * The site ships a dark ("night") look by default. In `auto` mode this module
 * resolves the light ("day") or dark ("night") palette from the visitor's OS
 * appearance (`prefers-color-scheme`), falling back to their local clock when
 * the OS states no preference — and lets them override it with an explicit choice.
 *
 * The resolved mode is expressed as a `data-theme` attribute on <html>, which
 * the CSS in `styles-theme.css` keys off. An inline script in index.html applies
 * the same logic before first paint so there is no flash of the wrong theme.
 */

export type ThemeMode = 'day' | 'night';

/** What the user asked for. `auto` matches the OS, then the local time of day. */
export type ThemePreference = 'auto' | ThemeMode;

export const THEME_STORAGE_KEY = 'sattari-theme-pref-v1';

/** Daytime runs from 06:00 up to (but not including) 18:00 local time. */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 18;

/** The OS "dark appearance" media query, shared with ThemeContext's listener. */
export const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';
const PREFERS_LIGHT_QUERY = '(prefers-color-scheme: light)';

const THEME_COLORS: Record<ThemeMode, string> = {
  night: '#0a0a0b',
  day: '#f6f1e6',
};

/** Resolve the time-based theme for a given moment (defaults to now). */
export function getTimeBasedTheme(date: Date = new Date()): ThemeMode {
  const hour = date.getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? 'day' : 'night';
}

/**
 * The operating system's light/dark appearance, or `null` when it expresses no
 * preference (or matchMedia is unavailable).
 */
export function getOsTheme(): ThemeMode | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  if (window.matchMedia(PREFERS_DARK_QUERY).matches) return 'night';
  if (window.matchMedia(PREFERS_LIGHT_QUERY).matches) return 'day';
  return null;
}

/**
 * Turn a preference into a concrete mode. `auto` honors the OS appearance,
 * falling back to the local time of day when the OS states no preference.
 */
export function resolveTheme(preference: ThemePreference, date: Date = new Date()): ThemeMode {
  if (preference !== 'auto') return preference;
  return getOsTheme() ?? getTimeBasedTheme(date);
}

/**
 * Milliseconds until the automatic theme would next change. Used to schedule a
 * single precise re-evaluation instead of polling, so an open tab flips itself
 * when the clock crosses sunrise/sunset.
 */
export function msUntilNextThemeBoundary(date: Date = new Date()): number {
  const hour = date.getHours();
  const next = new Date(date);
  next.setMinutes(0, 0, 0);

  if (hour < DAY_START_HOUR) {
    next.setHours(DAY_START_HOUR);
  } else if (hour < DAY_END_HOUR) {
    next.setHours(DAY_END_HOUR);
  } else {
    // Past sunset — the next boundary is tomorrow's sunrise.
    next.setDate(next.getDate() + 1);
    next.setHours(DAY_START_HOUR);
  }

  // Guard against clock drift landing us on/behind "now".
  return Math.max(1000, next.getTime() - date.getTime());
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'day' || value === 'night';
}

/** Read the persisted preference, defaulting to `auto`. */
export function getStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function storePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* storage may be unavailable (private mode) — degrade silently */
  }
}

/** Apply a mode to the document: sets `data-theme` and the browser chrome color. */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[mode]);
  }
}
