import { useRef } from 'react';
import { Plus } from 'lucide-react';
import { StudioPanel } from '../../components/studio/StudioPanel';
import './MixerDock.css';

const CROSSFADER_CURVES = ['Smooth', 'Sharp', 'Linear'];

function padPosition(event) {
  const box = event.currentTarget.getBoundingClientRect();
  return [
    ((event.clientX - box.left) / box.width) * 100,
    ((event.clientY - box.top) / box.height) * 100,
  ];
}

export function PadStrip({ pads, activePad, onTrigger, onLoad, onGain }) {
  const inputs = useRef([]);
  return (
    <section className="sd-pad-strip" aria-label="Performance pads">
      <header>
        <span>PERFORMANCE PADS</span>
        <strong>BANK A</strong>
      </header>
      <div className="sd-pads">
        {pads.map((pad, index) => (
          <div
            className="sd-pad-cell"
            key={`${index}-${pad.name}`}
            style={{ '--sd-accent': pad.accent }}
          >
            <button
              type="button"
              className={activePad === index ? 'is-hit' : ''}
              onClick={() => onTrigger(index)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{pad.name}</strong>
            </button>
            <div>
              <button
                type="button"
                onClick={() => inputs.current[index]?.click()}
                aria-label={`Load Pad ${index + 1}`}
              >
                <Plus size={11} />
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={pad.gain}
                onChange={(event) => onGain(index, Number(event.target.value))}
                aria-label={`Pad ${index + 1} gain`}
              />
            </div>
            <input
              ref={(element) => {
                inputs.current[index] = element;
              }}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => {
                void onLoad(index, event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Echo (X) and space (Y) for every deck at once. */
export function GlobalFxPad({ position, onChange }) {
  return (
    <div className="sd-global-fx-module">
      <span className="sd-module-title">GLOBAL FX</span>
      <button
        type="button"
        className="sd-xy-pad"
        aria-label="Global effects XY pad"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          onChange(...padPosition(event));
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          onChange(...padPosition(event));
        }}
      >
        <i style={{ left: `${position.x}%`, top: `${position.y}%` }} />
        <span>ECHO</span>
        <span>SPACE</span>
      </button>
    </div>
  );
}

/** Perform's collapsible bank of pads and the global XY effects pad. */
export function PadsAndFx({ pads, activePad, onTrigger, onLoad, onGain, fx, onFx }) {
  return (
    <StudioPanel
      panelId="perform-pads-fx"
      label="Pads & FX"
      className="sd-pads-fx"
      aria-label="Pads and effects"
    >
      <div className="sd-pads-fx-body">
        <PadStrip
          pads={pads}
          activePad={activePad}
          onTrigger={onTrigger}
          onLoad={onLoad}
          onGain={onGain}
        />
        <GlobalFxPad position={fx} onChange={onFx} />
      </div>
    </StudioPanel>
  );
}

export function CrossfaderOptions({ curve, onCurve, reverse, onReverse }) {
  return (
    <div className="sd-performance-xf-options" role="group" aria-label="Crossfader options">
      <select
        value={curve}
        onChange={(event) => onCurve(event.target.value)}
        aria-label="Crossfader curve"
      >
        {CROSSFADER_CURVES.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <button
        type="button"
        className={reverse ? 'is-active' : ''}
        aria-pressed={reverse}
        title="Reverse crossfader"
        onClick={() => onReverse((value) => !value)}
      >
        REV
      </button>
    </div>
  );
}

export function SyncButtons({ onSyncAll, onSyncKey }) {
  return (
    <div className="sd-performance-sync" role="group" aria-label="Deck sync">
      <button
        type="button"
        onClick={onSyncAll}
        title="Align every loaded deck to the sync master's tempo"
      >
        Sync all
      </button>
      <button type="button" onClick={onSyncKey} title="Match loaded decks to one key">
        Key sync
      </button>
    </div>
  );
}
