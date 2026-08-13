import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Free, zero-cost guided assistant: a small client-side decision tree that
 * routes visitors to the right shop category or service page. No AI model,
 * no API calls, no ongoing cost -- just button choices mapped to routes.
 */

type Option = { label: string; description?: string } & ({ next: StepKey } | { to: string });

type StepKey = 'root' | 'shop' | 'services' | 'unsure';

interface Step {
  question: string;
  options: Option[];
}

const STEPS: Record<StepKey, Step> = {
  root: {
    question: 'What brings you here today?',
    options: [
      { label: 'Shop instruments & gear', next: 'shop' },
      {
        label: 'Get something repaired',
        description: 'Drums, guitars, violins, and more',
        to: '/services/instrument-repair-los-angeles',
      },
      { label: 'Lessons, rentals, rehearsal, or studio time', next: 'services' },
      { label: "I'm not sure yet", next: 'unsure' },
    ],
  },
  shop: {
    question: 'What are you shopping for?',
    options: [
      { label: 'Cymbals', to: '/shop/cymbals' },
      { label: 'Drumsticks', to: '/shop/sticks' },
      { label: 'Practice essentials & accessories', to: '/shop/essentials' },
      { label: 'Violins', to: '/shop/violins' },
      { label: 'Guitar & bass', to: '/shop/guitar-bass' },
      { label: 'Show me everything', to: '/shop/all' },
    ],
  },
  services: {
    question: 'What do you need?',
    options: [
      { label: 'Music lessons or classes', to: '/services/music-lessons-los-angeles' },
      { label: 'Instrument rentals', to: '/services/instrument-rentals-los-angeles' },
      { label: 'Rehearsal space', to: '/services/rehearsal-space-los-angeles' },
      {
        label: 'Recording / rental studio time',
        to: '/services/recording-studio-rental-los-angeles',
      },
      { label: 'See everything', to: '/services' },
    ],
  },
  unsure: {
    question: 'No problem -- here are two easy starting points.',
    options: [
      { label: 'Browse the full shop', to: '/shop/all' },
      { label: 'See all local services', to: '/services' },
    ],
  },
};

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.2 3.6a.6.6 0 0 1-1-.46V16h-.3A2.5 2.5 0 0 1 1 13.5v0" />
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H9l-4.2 3.6a.6.6 0 0 1-1-.46V16H3.5A2.5 2.5 0 0 1 1 13.5v-8A2.5 2.5 0 0 1 3.5 3" />
    </svg>
  );
}

export default function ShopAssistant() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<StepKey[]>(['root']);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const stepKey = history[history.length - 1];
  const step = STEPS[stepKey];

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [open, stepKey]);

  function handleOpen() {
    setHistory(['root']);
    setOpen(true);
  }

  function handleChoice(option: Option) {
    if ('next' in option) {
      setHistory((prev) => [...prev, option.next]);
      return;
    }
    setOpen(false);
    navigate(option.to);
  }

  function handleBack() {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  return (
    <div className="shop-assistant">
      {open && (
        <div
          className="shop-assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={headingId}
          ref={panelRef}
        >
          <div className="shop-assistant-header">
            <div>
              <p className="shop-assistant-eyebrow">Shop Assistant</p>
              <h2 id={headingId}>{step.question}</h2>
            </div>
            <button
              type="button"
              className="shop-assistant-close"
              aria-label="Close shop assistant"
              onClick={() => setOpen(false)}
            >
              &times;
            </button>
          </div>

          <div className="shop-assistant-options">
            {step.options.map((option) => (
              <button
                type="button"
                key={option.label}
                className="shop-assistant-option"
                onClick={() => handleChoice(option)}
              >
                <span>
                  <span className="shop-assistant-option-label">{option.label}</span>
                  {option.description && (
                    <span className="shop-assistant-option-desc">{option.description}</span>
                  )}
                </span>
                <span className="shop-assistant-option-arrow" aria-hidden="true">
                  &rarr;
                </span>
              </button>
            ))}
          </div>

          {history.length > 1 && (
            <button type="button" className="shop-assistant-back" onClick={handleBack}>
              &larr; Back
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className="shop-assistant-fab"
        aria-label={
          open ? 'Close shop assistant' : 'Open shop assistant: find a product or service'
        }
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : handleOpen())}
      >
        <ChatIcon />
        <span className="shop-assistant-fab-label">Help me find something</span>
      </button>
    </div>
  );
}
