import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { callbackDelay, telemetryLabel } from '../../utils/sessionTelemetry';

// Keep meter renders out of the session/deck tree. This is a display tap only;
// closing an inspector never changes the audio graph or monitoring state.
export default function SessionOutputStatus({ getEngine, expanded, onClick }) {
  const [status, setStatus] = useState(null);
  const [delay, setDelay] = useState(null);
  useEffect(() => {
    let previous = null;
    const sample = () => {
      if (document.hidden) {
        previous = null;
        return;
      }
      const now = performance.now();
      setDelay(callbackDelay(now, previous));
      previous = now;
      setStatus(getEngine().getMasterStatus?.() || null);
    };
    const reset = () => {
      previous = null;
    };
    document.addEventListener('visibilitychange', reset);
    sample();
    const timer = setInterval(sample, 400);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [getEngine]);
  const peak = Number.isFinite(status?.peak) ? status.peak : -96;
  return (
    <button
      type="button"
      className="sd-session-output"
      aria-label="Master inspector"
      aria-expanded={expanded}
      aria-controls="session-inspector"
      title={telemetryLabel(status?.latency, delay)}
      onClick={onClick}
    >
      <Volume2 size={16} aria-hidden="true" />
      <span>Master</span>
      <meter
        aria-label="Session output peak"
        min="-60"
        max="0"
        value={Math.max(-60, Math.min(0, peak))}
      />
      <small>
        {status?.clipped
          ? 'CLIP'
          : status?.state === 'suspended'
            ? 'Paused'
            : peak > -96
              ? `${peak.toFixed(1)} dB`
              : '−∞'}
      </small>
      <small className="sd-session-health" aria-label={telemetryLabel(status?.latency, delay)}>
        UI {delay == null ? '—' : `${Math.round(delay)} ms`}
      </small>
    </button>
  );
}
