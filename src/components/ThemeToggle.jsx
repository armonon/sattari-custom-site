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

const LABELS = {
  auto: 'Auto (matches your system)',
  day: 'Day mode',
  night: 'Night mode',
};

const NEXT = {
  auto: 'day',
  day: 'night',
  night: 'auto',
};

export default function ThemeToggle() {
  const { preference, mode, cyclePreference } = useTheme();
  const isAuto = preference === 'auto';

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle-${mode}${isAuto ? ' theme-toggle-auto' : ''}`}
      onClick={cyclePreference}
      aria-label={`Theme: ${LABELS[preference]}. Activate for ${LABELS[NEXT[preference]]}.`}
      title={LABELS[preference]}
    >
      <span className="theme-toggle-icon">{mode === 'day' ? <SunIcon /> : <MoonIcon />}</span>
      {isAuto && (
        <span className="theme-toggle-badge" aria-hidden="true">
          AUTO
        </span>
      )}
    </button>
  );
}
