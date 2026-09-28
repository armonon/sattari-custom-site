import { useTheme } from '../context/ThemeContext';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="4.2" />
    <g strokeLinecap="round">
      <line x1="12" y1="2.5" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="21.5" />
      <line x1="2.5" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="21.5" y2="12" />
      <line x1="5.1" y1="5.1" x2="6.9" y2="6.9" />
      <line x1="17.1" y1="17.1" x2="18.9" y2="18.9" />
      <line x1="5.1" y1="18.9" x2="6.9" y2="17.1" />
      <line x1="17.1" y1="6.9" x2="18.9" y2="5.1" />
    </g>
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20 14.2A8 8 0 1 1 9.8 4a6.4 6.4 0 0 0 10.2 10.2Z" />
  </svg>
);

export default function ThemeToggle() {
  const { mode, ready, cyclePreference } = useTheme();
  // `mode` is known only after mount (see ThemeContext). Until then the label
  // names both, exactly as the prerendered HTML does.
  const label = ready
    ? `Switch to ${mode === 'day' ? 'night' : 'day'} mode`
    : 'Switch between day and night mode';

  // Both icons are rendered and CSS shows the one matching <html data-theme>,
  // which is right before the app loads.
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cyclePreference}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle-icon theme-toggle-icon-day">
        <SunIcon />
      </span>
      <span className="theme-toggle-icon theme-toggle-icon-night">
        <MoonIcon />
      </span>
    </button>
  );
}
