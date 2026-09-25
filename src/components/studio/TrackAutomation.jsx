import { useState } from 'react';
import { EFFECTS } from '../../utils/arrangementEffects';
import AutomationCurve from './AutomationCurve';

export default function TrackAutomation({ track, duration, disabled, onChange }) {
  const [selected, select] = useState('volume');
  const targets = {
    volume: { label: 'Track volume', min: 0, max: 300, value: track.gain },
    pan: { label: 'Track pan', min: -1, max: 1, value: track.pan },
  };
  for (const effect of track.effects || [])
    for (const [key, spec] of Object.entries(EFFECTS[effect.type].params))
      targets[`fx:${effect.id}:${key}`] = {
        ...spec,
        label: `${EFFECTS[effect.type].name} · ${spec.label}${effect.bypass ? ' (bypassed)' : ''}`,
        value: effect.params[key] ?? spec.value,
      };
  const target = targets[selected] ? selected : 'volume';
  const spec = targets[target],
    points = track.automation?.[target] || [];
  const change = (next) => {
    const automation = { ...track.automation, [target]: next };
    if (!next.length) delete automation[target];
    onChange(automation);
  };
  return (
    <section aria-label="Track and device automation">
      <div className="ae-fields">
        <strong>{track.name} · Timeline automation</strong>
        <select
          aria-label="Track automation parameter"
          value={target}
          onChange={(event) => select(event.target.value)}
        >
          {Object.entries(targets).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || !!points.length}
          onClick={() =>
            change([
              { time: 0, value: spec.value },
              { time: duration, value: spec.value },
            ])
          }
        >
          Add envelope
        </button>
        <button type="button" disabled={disabled || !points.length} onClick={() => change([])}>
          Clear envelope
        </button>
      </div>
      <AutomationCurve
        points={points}
        duration={duration}
        parameter={target}
        range={spec}
        disabled={disabled}
        onChange={change}
      />
      <p>
        Absolute timeline seconds · Native audio-clock playback and export. An envelope overrides
        its static control.
      </p>
    </section>
  );
}
