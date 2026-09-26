import { useState } from 'react';
import { takeCapabilities } from '../../utils/takeCapabilities';
import { performanceControlFields, setPerformanceControl } from '../../utils/performanceControls';
import { retimePerformanceEvent } from '../../utils/performanceClock';
import { PERFORMANCE_STAGES, SUPPORT_LABELS } from '../../utils/performanceSupport';

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
  const [eventFilter, setEventFilter] = useState('all');
  const visibleEvents = capture.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => eventFilter === 'all' || event.type === eventFilter);
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
              ...('time' in updates
                ? retimePerformanceEvent({ ...event, ...updates, time: event.time }, updates.time)
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
      <section aria-label="Capture editability">
        <p>
          <strong>Editable in Arrange:</strong>{' '}
          {capabilities.editable.join(' · ') || 'No reconstructed source data identified'}
        </p>
        {capabilities.printed.length > 0 && (
          <p>
            <strong>Printed audio required:</strong> {capabilities.printed.join(' · ')}
          </p>
        )}
        {!capabilities.safety && capabilities.printed.length > 0 && (
          <p role="alert">
            No safety recording is linked. These processing details cannot be recovered from source
            clips alone.
          </p>
        )}
        <p>
          Event controls below edit replay history, not necessarily arrangement devices. Keep the
          original print as the sound reference.
        </p>
      </section>
      <details>
        <summary>Five-stage action support</summary>
        <p>
          Implementation inventory—not an audio-parity qualification. No action in this take is
          certified across all five stages.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <caption>Enabled performance actions</caption>
            <thead>
              <tr>
                <th scope="col">Action / destination</th>
                {PERFORMANCE_STAGES.map((stage) => (
                  <th key={stage} scope="col">
                    {stage}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capabilities.support.rows.map((item) => (
                <tr key={item.id}>
                  <th scope="row">
                    {item.label}
                    <small>{item.destination}</small>
                  </th>
                  {PERFORMANCE_STAGES.map((stage) => (
                    <td key={stage} title={item.limit}>
                      {SUPPORT_LABELS[item.stages[stage]]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {capabilities.support.rows.map((item) => (
          <p key={item.id}>
            <strong>{item.label}:</strong> {item.limit}
          </p>
        ))}
      </details>
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
        Building editable sources creates new muted lanes. Original events and printed audio are
        kept. Compare before replacing the safety mix.
      </p>
      {onReplay && (
        <p>
          Live-engine replay uses the original deck, stem and master processing. Printing runs in
          real time into recoverable WAV chunks. Legacy reverb, opening tails and captured pad edits
          have limitations; replay reports warnings and scheduling lateness.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <label>
        Show actions{' '}
        <select
          aria-label="Filter performance actions"
          value={eventFilter}
          onChange={(event) => {
            setEventFilter(event.target.value);
            setPage(0);
          }}
        >
          <option value="all">All actions</option>
          {[...new Set(capture.events.map((event) => event.type))].map((type) => (
            <option key={type} value={type}>
              {type.replace(/^set/, '').replace(/([a-z])([A-Z])/g, '$1 $2')}
            </option>
          ))}
        </select>
      </label>
      <ol start={page * 50 + 1}>
        {visibleEvents.slice(page * 50, (page + 1) * 50).map(({ event, index }) => {
          return (
            <li key={index} className="ae-fields">
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
              {performanceControlFields(event).length > 0 && (
                <details>
                  <summary>Edit controls</summary>
                  <div className="ae-fields">
                    {performanceControlFields(event).map((field) => (
                      <label key={field.path.join('.')}>
                        {field.name}
                        <input
                          aria-label={`Event ${index + 1} ${field.name}`}
                          type={field.type === 'boolean' ? 'checkbox' : 'number'}
                          step="any"
                          {...(field.type === 'boolean'
                            ? { checked: field.value }
                            : { value: field.value })}
                          disabled={disabled}
                          onChange={(e) => {
                            const value =
                              field.type === 'boolean' ? e.target.checked : e.target.valueAsNumber;
                            try {
                              change(index, {
                                args: setPerformanceControl(event, field.path, value),
                              });
                              setError('');
                            } catch (failure) {
                              setError(failure.message);
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </details>
              )}
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
          Page {page + 1} of {Math.max(1, Math.ceil(visibleEvents.length / 50))}
        </span>
        <button
          type="button"
          disabled={(page + 1) * 50 >= visibleEvents.length}
          onClick={() => setPage(page + 1)}
        >
          Next events
        </button>
      </div>
    </Container>
  );
}
