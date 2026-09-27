import { memo, useEffect, useMemo, useState } from 'react';
import AutomationCurve from '../../components/studio/AutomationCurve';
import { arrangementId, bounded, compRegion, resizeClip } from '../../utils/arrangementModel';
import { appendClip, removeClips, splitClipAt } from './projectEdits';

/**
 * Inspector fields that outlive the inspector itself: switching editor tabs
 * keeps the chosen automation parameter; choosing another clip resets the comp range.
 */
export function useInspectorState(selection) {
  const [target, setTarget] = useState('volume'),
    [pointTime, setPointTime] = useState(0),
    [pointValue, setPointValue] = useState(100),
    [compStart, setCompStart] = useState(null),
    [compEnd, setCompEnd] = useState(null);
  useEffect(() => {
    setCompStart(null);
    setCompEnd(null);
  }, [selection]);
  return useMemo(
    () => ({
      target,
      setTarget,
      pointTime,
      setPointTime,
      pointValue,
      setPointValue,
      compStart,
      setCompStart,
      compEnd,
      setCompEnd,
    }),
    [target, pointTime, pointValue, compStart, compEnd]
  );
}

const FIELDS = [
  ['start', 'Start (s)', 0, 86400],
  ['offset', 'Source offset (s)', 0, 86400],
  ['duration', 'Duration (s)', 0.01, 86400],
  ['gain', 'Clip gain (%)', 0, 300],
  ['fadeIn', 'Fade in (s)', 0],
  ['fadeOut', 'Fade out (s)', 0],
];

function ClipInspector({ selected, selectedTrack, busy, cursor, state, commands }) {
  const { target, pointTime, pointValue, compStart, compEnd } = state;
  const points = selected.automation[target];
  const setPoints = (next) =>
    commands.changeClip({ automation: { ...selected.automation, [target]: next } });
  const comp = () => {
    try {
      commands.edit(
        compRegion(
          commands.getProject(),
          selectedTrack.id,
          compStart ?? selected.start,
          compEnd ?? selected.start + selected.duration
        )
      );
      commands.setMessage(
        'Region copied to the comp lane. Source track muted; original audio remains untouched.'
      );
    } catch (error) {
      commands.setMessage(error.message);
    }
  };
  return (
    <section className="ae-inspector" aria-label="Clip editor">
      <h4>{selected.name}</h4>
      <details className="ae-comp-controls">
        <summary>Build a take comp</summary>
        <p>
          Choose a region from this track. It replaces that region on the matching comp lane and
          mutes this source track. Original clips stay intact; Undo restores the change.
        </p>
        <div className="ae-fields">
          <label>
            Comp start (s)
            <input
              type="number"
              min="0"
              step=".01"
              disabled={busy}
              value={compStart ?? selected.start}
              onChange={(event) => state.setCompStart(Number(event.target.value))}
            />
          </label>
          <label>
            Comp end (s)
            <input
              type="number"
              min="0"
              step=".01"
              disabled={busy}
              value={compEnd ?? selected.start + selected.duration}
              onChange={(event) => state.setCompEnd(Number(event.target.value))}
            />
          </label>
          <button type="button" disabled={busy} onClick={comp}>
            Use region in comp
          </button>
        </div>
      </details>
      {selected.kind === 'audio' && (
        <button type="button" disabled={busy} onClick={() => commands.relink(selected.assetId)}>
          Relink source audio
        </button>
      )}
      <div className="ae-actions">
        <button
          type="button"
          disabled={
            busy || cursor <= selected.start || cursor >= selected.start + selected.duration
          }
          onClick={() => commands.edit((next) => splitClipAt(next, selected.id, cursor))}
        >
          Split at playhead
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            commands.edit((next) =>
              appendClip(next, selectedTrack.id, {
                ...selected,
                patternId: undefined,
                id: arrangementId(),
                start: selected.start + selected.duration,
              })
            )
          }
        >
          Duplicate clip
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => commands.edit((next) => removeClips(next, [selected.id]))}
        >
          Delete clip
        </button>
      </div>
      <div className="ae-fields">
        {FIELDS.filter(([key]) => selected.kind === 'audio' || key !== 'offset').map(
          ([key, label, min, max = selected.duration]) => (
            <label key={key}>
              {label}
              <input
                aria-label={label}
                type="number"
                min={min}
                max={max}
                step=".01"
                value={selected[key]}
                disabled={busy}
                onChange={(event) => {
                  const value = bounded(event.target.value, min, max);
                  commands.changeClip(
                    key === 'duration' ? resizeClip(selected, value) : { [key]: value }
                  );
                }}
              />
            </label>
          )
        )}
      </div>
      <details className="ae-automation-panel">
        <summary>Automation</summary>
        <div className="ae-automation">
          <h4>Clip automation</h4>
          <AutomationCurve
            points={points}
            duration={selected.duration}
            parameter={target}
            disabled={busy}
            onChange={setPoints}
          />
          <label>
            Parameter
            <select
              value={target}
              onChange={(event) => {
                const value = event.target.value;
                state.setTarget(value);
                state.setPointValue(value === 'volume' ? 100 : value === 'pan' ? 0 : 20000);
              }}
            >
              <option value="volume">Volume (%)</option>
              <option value="pan">Pan (−1 to +1)</option>
              <option value="filter">Low-pass (Hz)</option>
            </select>
          </label>
          <label>
            Time in clip (s)
            <input
              type="number"
              min="0"
              max={selected.duration}
              step=".01"
              value={pointTime}
              onChange={(event) =>
                state.setPointTime(bounded(event.target.value, 0, selected.duration))
              }
            />
          </label>
          <label>
            Value
            <input
              type="number"
              value={pointValue}
              onChange={(event) => state.setPointValue(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const time = bounded(pointTime, 0, selected.duration),
                value =
                  target === 'pan'
                    ? bounded(pointValue, -1, 1)
                    : target === 'filter'
                      ? bounded(pointValue, 20, 20000)
                      : bounded(pointValue, 0, 300);
              setPoints(
                [
                  ...points.filter((point) => Math.abs(point.time - time) > 0.001),
                  { time, value },
                ].sort((a, b) => a.time - b.time)
              );
            }}
          >
            Set point
          </button>
          <ul>
            {points.map((point, index) => (
              <li key={index}>
                {point.time.toFixed(2)}s → {point.value}
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove automation point ${index + 1}`}
                  onClick={() => setPoints(points.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}

export default memo(ClipInspector);
