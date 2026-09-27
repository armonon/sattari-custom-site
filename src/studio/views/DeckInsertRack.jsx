import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { EFFECTS, newEffect, validateEffects } from '../../utils/arrangementEffects';

const MAX_INSERTS = 8;

/**
 * A deck's insert chain, using the arrangement rack's effect format and chain
 * styling. ArrangementRack itself is written for arrangement tracks and the
 * master bus (track routing copy, an instruments tab, track-named controls),
 * so decks get this minimal editor for the same effects.
 */
export default function DeckInsertRack({ deck, onChange, onClose }) {
  const titleId = useId();
  const heading = useRef(null);
  const [message, setMessage] = useState('');
  const effects = deck.inserts;
  const name = `Deck ${deck.id}`;

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const apply = (next) => {
    try {
      onChange(validateEffects(next));
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  };
  const update = (effectId, changes) =>
    apply(effects.map((effect) => (effect.id === effectId ? { ...effect, ...changes } : effect)));
  const move = (index, offset) => {
    const next = [...effects];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    apply(next);
  };

  return (
    <section
      role="dialog"
      aria-labelledby={titleId}
      className="sd-mixer-inserts ae-rack-chain"
      style={{ '--sd-accent': deck.accent }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        onClose();
      }}
    >
      <header className="ae-rack-chain-title">
        <strong id={titleId} ref={heading} tabIndex={-1}>
          {name} · Insert chain
        </strong>
        <span>
          {effects.length} / {MAX_INSERTS}
        </span>
        <button type="button" aria-label={`Close ${name} inserts`} onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      <p className="sd-mixer-help">
        Deck EQ and filter → inserts → echo and reverb → channel fader → sends and master. Saved
        with your project.
      </p>
      <div className="sd-mixer-inserts-add" role="group" aria-label={`Add an effect to ${name}`}>
        {Object.entries(EFFECTS).map(([type, definition]) => (
          <button
            type="button"
            key={type}
            title={definition.description}
            aria-label={`Add ${definition.name} to ${name}`}
            disabled={effects.length >= MAX_INSERTS}
            onClick={() => apply([...effects, newEffect(type)])}
          >
            + {definition.name.replace(/^Sattari /, '')}
          </button>
        ))}
      </div>
      {!effects.length && (
        <div className="ae-rack-empty">
          <p>No inserts yet. Effects added here process this deck before its fader.</p>
        </div>
      )}
      <ol aria-label={`${name} insert effects`}>
        {effects.map((effect, index) => {
          const definition = EFFECTS[effect.type];
          const slot = `${name} insert ${index + 1}`;
          return (
            <li key={effect.id} className={effect.bypass ? 'is-bypassed' : ''}>
              <div className="ae-rack-device-heading">
                <div className="ae-rack-device-title">
                  <span>{index + 1}</span>
                  <strong>{definition.name}</strong>
                </div>
                <button
                  type="button"
                  aria-label={`Bypass ${slot}`}
                  aria-pressed={effect.bypass}
                  onClick={() => update(effect.id, { bypass: !effect.bypass })}
                >
                  {effect.bypass ? 'Bypassed' : 'On'}
                </button>
                <button
                  type="button"
                  aria-label={`Move ${slot} earlier`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${slot} later`}
                  disabled={index === effects.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${slot}`}
                  onClick={() => apply(effects.filter((item) => item.id !== effect.id))}
                >
                  Remove
                </button>
              </div>
              <div className="ae-rack-parameters">
                {Object.entries(definition.params).map(([param, spec]) => {
                  const value = effect.params[param] ?? spec.value;
                  return (
                    <label key={param}>
                      <span>
                        {spec.label}{' '}
                        <output>
                          {Number(value.toFixed(3))}
                          {spec.unit}
                        </output>
                      </span>
                      <input
                        type="range"
                        aria-label={`${slot} ${spec.label}`}
                        min={spec.min}
                        max={spec.max}
                        step={spec.step}
                        value={value}
                        onDoubleClick={() =>
                          update(effect.id, { params: { ...effect.params, [param]: spec.value } })
                        }
                        onChange={(event) =>
                          update(effect.id, {
                            params: { ...effect.params, [param]: Number(event.target.value) },
                          })
                        }
                      />
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
