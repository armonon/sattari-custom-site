import { useCallback, useId, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { MeterProvider, createMeterStore } from '../mixer/meterStore';
import { SEND_BUSES } from '../mixer/mixerModel';
import { useMeterLoop } from '../mixer/useMeterLoop';
import DeckInsertRack from './DeckInsertRack';
import HeadphonesPanel from './HeadphonesPanel';
import { DeckStrip, MasterStrip, ReturnStrip, TrackStrip } from './MixerStrips';
import './MixerDock.css';

function Group({ label, className = '', children }) {
  return (
    <div role="group" aria-label={label} className={`sd-mixer-group ${className}`}>
      <span className="sd-mixer-group-label" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * The docked mixer under every workspace: decks, arrangement tracks, the two
 * returns, the master and headphone cue. Closed, meters only, or full. Meters
 * are sampled, and the engine's analysers connected, only while it is open.
 */
export default function MixerDock({
  dock,
  engineRef,
  decks,
  onDeckChange,
  tracks,
  onUpdateTrack,
  onCommitTrack,
  onOpenDevices,
  returns,
  onReturnChange,
  master,
  headphones,
}) {
  const [store] = useState(createMeterStore);
  const [insertsDeckId, setInsertsDeckId] = useState(null);
  const headingId = useId();
  useMeterLoop({ active: dock.open, store, engineRef });
  const compact = dock.mode === 'compact';
  const insertsDeck = compact ? null : decks.find((deck) => deck.id === insertsDeckId);
  const toggleInserts = useCallback(
    (id) => setInsertsDeckId((current) => (current === id ? null : id)),
    []
  );
  const closeInserts = useCallback(() => {
    setInsertsDeckId(null);
    document.getElementById(`mixer-inserts-${insertsDeckId}`)?.focus();
  }, [insertsDeckId]);
  const changeInserts = useCallback(
    (inserts) => onDeckChange(insertsDeckId, { inserts }),
    [insertsDeckId, onDeckChange]
  );
  if (!dock.open) return null;
  const cueOff = headphones.effectiveMode === 'off';
  return (
    <MeterProvider store={store}>
      <section
        id="studio-mixer-dock"
        ref={dock.dockRef}
        className={`sd-mixer-dock is-${dock.mode}`}
        aria-labelledby={headingId}
      >
        <header className="sd-mixer-dock-bar">
          <h2 id={headingId} ref={dock.headingRef} tabIndex={-1}>
            <SlidersHorizontal size={14} aria-hidden="true" />
            Mixer
          </h2>
          <kbd className="sd-mixer-dock-hint" title="Toggle the mixer with M or F9">
            M
          </kbd>
          <div className="sd-mixer-dock-size" role="group" aria-label="Mixer size">
            <button type="button" aria-pressed={compact} onClick={() => dock.setMode('compact')}>
              Meters
            </button>
            <button type="button" aria-pressed={!compact} onClick={() => dock.setMode('full')}>
              Full
            </button>
          </div>
          <button
            type="button"
            className="sd-mixer-dock-close"
            aria-label="Close mixer"
            title="Close mixer (M)"
            onClick={dock.hide}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </header>
        <div className="sd-mixer-dock-body">
          <Group label="Decks">
            {decks.map((deck) => (
              <DeckStrip
                key={deck.id}
                deck={deck}
                compact={compact}
                cueOff={cueOff}
                insertsOpen={insertsDeck?.id === deck.id}
                onDeckChange={onDeckChange}
                onOpenInserts={toggleInserts}
              />
            ))}
          </Group>
          {tracks.length ? (
            <Group label="Tracks" className="is-tracks">
              {tracks.map((track) => (
                <TrackStrip
                  key={track.id}
                  track={track}
                  compact={compact}
                  onUpdateTrack={onUpdateTrack}
                  onCommitTrack={onCommitTrack}
                  onOpenDevices={onOpenDevices}
                />
              ))}
            </Group>
          ) : null}
          <Group label="Returns">
            {SEND_BUSES.map((bus) => (
              <ReturnStrip
                key={bus}
                bus={bus}
                params={returns[bus]}
                compact={compact}
                onChange={onReturnChange}
              />
            ))}
          </Group>
          <Group label="Master" className="is-master">
            <MasterStrip compact={compact} {...master} />
            {compact ? null : <HeadphonesPanel headphones={headphones} />}
          </Group>
        </div>
        {insertsDeck ? (
          <DeckInsertRack deck={insertsDeck} onChange={changeInserts} onClose={closeInserts} />
        ) : null}
      </section>
    </MeterProvider>
  );
}
