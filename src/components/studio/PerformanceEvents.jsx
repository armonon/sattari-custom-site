import { useState } from 'react';
import { takeCapabilities } from '../../utils/takeCapabilities';

export default function PerformanceEvents({
  capture,
  disabled,
  onChange,
  onBuild,
  onReplay,
  onRender,
  onStop,
  replaying,
  expanded = false,
}) {
  const [page, setPage] = useState(0),
    [error, setError] = useState('');
  const [rebuildPads, setRebuildPads] = useState(false);
  const capabilities = takeCapabilities(capture);
  const change = (index, updates) => {
    onChange({
      ...capture,
      originalEvents: capture.originalEvents || structuredClone(capture.events),
      events: capture.events.map((event, i) =>
        i === index
          ? {
              ...event,
              ...updates,
              ...('time' in updates && event.sampleRate > 0
                ? { frame: Math.round(updates.time * event.sampleRate) }
                : {}),
            }
          : event
      ),
    });
  };
  const Container = expanded ? 'section' : 'details';
  const Heading = expanded ? 'h4' : 'summary';
  return (
    <Container>
      <Heading>
        {capture.name} · {capture.events.length} events
      </Heading>
      <p>
        <strong>{capabilities.label}</strong> · {capabilities.actions} enabled actions ·{' '}
        {capabilities.safety ? 'Safety audio linked' : 'No safety audio linked'}
      </p>
      {capabilities.editable.length > 0 && <p>Editable: {capabilities.editable.join(' · ')}</p>}
      {capabilities.limits.length > 0 && (
        <details>
          <summary>Replay limits</summary>
          <ul>
            {capabilities.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="ae-actions">
        {onReplay && (
          <button type="button" disabled={disabled} onClick={() => onReplay({ rebuildPads })}>
            Audition live-engine replay
          </button>
        )}
        {onRender && (
          <button type="button" disabled={disabled} onClick={() => onRender({ rebuildPads })}>
            Print edited performance
          </button>
        )}
        {replaying && (
          <button type="button" onClick={onStop}>
            Stop performance replay
          </button>
        )}
        <button type="button" disabled={disabled} onClick={onBuild}>
          Build editable source replay
        </button>
        <button
          type="button"
          disabled={disabled || !capture.originalEvents}
          onClick={() => onChange({ ...capture, events: structuredClone(capture.originalEvents) })}
        >
          Restore original events
        </button>
      </div>
      {onReplay && (
        <label>
          <input
            type="checkbox"
            disabled={disabled}
            checked={rebuildPads}
            onChange={(event) => setRebuildPads(event.target.checked)}
          />{' '}
          Rebuild pads from edited events (synthesized noise may differ)
        </label>
      )}
      <p>
        Replay creates new muted lanes. Original events and printed audio are kept. Compare before
        replacing the safety mix.
      </p>
      {onReplay && (
        <p>
          Live-engine replay uses the original deck, stem and master processing. Printing runs in
          real time into recoverable WAV chunks. Legacy reverb, opening tails and captured pad edits
          have limitations; replay reports warnings and scheduling lateness.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <ol start={page * 50 + 1}>
        {capture.events.slice(page * 50, (page + 1) * 50).map((event, offset) => {
          const index = page * 50 + offset;
          return (
            <li key={`${page}:${offset}`} className="ae-fields">
              <label>
                Time (s)
                <input
                  aria-label={`Event ${index + 1} time`}
                  type="number"
                  min="0"
                  max={capture.duration || 86400}
                  step=".001"
                  value={event.time}
                  disabled={disabled || event.type === 'initialState'}
                  onChange={(e) =>
                    change(index, {
                      time: Math.min(
                        capture.duration || 86400,
                        Math.max(0, Number(e.target.value) || 0)
                      ),
                    })
                  }
                />
              </label>
              <strong>{event.type}</strong>
              <label>
                <input
                  type="checkbox"
                  checked={!event.disabled}
                  disabled={disabled || event.type === 'initialState'}
                  onChange={(e) => change(index, { disabled: !e.target.checked })}
                />
                Enabled
              </label>
              <details>
                <summary>Event values</summary>
                <textarea
                  aria-label={`Event ${index + 1} arguments`}
                  key={JSON.stringify(event.args)}
                  defaultValue={JSON.stringify(event.args)}
                  disabled={disabled}
                  onBlur={(e) => {
                    try {
                      const args = JSON.parse(e.target.value);
                      if (!Array.isArray(args)) throw new Error('Arguments must be a JSON array.');
                      change(index, { args });
                      setError('');
                    } catch (failure) {
                      setError(`Event not changed: ${failure.message}`);
                    }
                  }}
                />
              </details>
            </li>
          );
        })}
      </ol>
      <div className="ae-actions">
        <button type="button" disabled={!page} onClick={() => setPage(page - 1)}>
          Previous events
        </button>
        <span>
          Page {page + 1} of {Math.max(1, Math.ceil(capture.events.length / 50))}
        </span>
        <button
          type="button"
          disabled={(page + 1) * 50 >= capture.events.length}
          onClick={() => setPage(page + 1)}
        >
          Next events
        </button>
      </div>
    </Container>
  );
}
