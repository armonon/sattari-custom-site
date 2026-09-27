import { Plus } from 'lucide-react';
import { StemDeckChannel } from '../../components/studio/StemDeckChannel';
import { CrossfaderOptions, SyncButtons } from './PerformTools';

const EMPTY_LANES = [
  ['VOX', '#d4537e'],
  ['DRM', '#4a9eff'],
  ['BAS', '#4ad9c4'],
  ['OTH', '#888780'],
];

function EmptyPerformance({ onAddSource, onDropTrack }) {
  return (
    <div
      className="sd-empty-performance"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = [...event.dataTransfer.files].find((item) => item.type.startsWith('audio/'));
        if (file) onDropTrack(file);
      }}
    >
      <button
        type="button"
        className="sd-empty-source-cta"
        aria-label="Add source"
        onClick={onAddSource}
      >
        <span className="sd-empty-instrument" aria-hidden="true">
          {EMPTY_LANES.map(([name, color]) => (
            <span key={name} style={{ '--lane-color': color }}>
              <b>{name}</b>
              <svg viewBox="0 0 64 140">
                <path d="M32 4 L32 25 L26 33 L38 39 L18 48 L44 56 L12 64 L50 72 L19 80 L42 89 L27 98 L35 107 L32 116 L32 136" />
              </svg>
              <i />
            </span>
          ))}
        </span>
        <em>YOUR LIVE WORKSPACE</em>
        <strong>Your next set starts here.</strong>
        <small>Drop a track, shape the stems, and capture the moment.</small>
        <span className="sd-import-action">
          <Plus size={16} /> Add Source
        </span>
        <small className="sd-import-hint">
          Mic, input, or track · Everything stays on this device
        </small>
      </button>
    </div>
  );
}

/**
 * Perform workspace: crossfader, sync and scene controls, up to two focused
 * deck channels, and `children` (the pads and effects) below them.
 */
export default function DecksView({
  decks,
  loadedDecks,
  focusedDeck,
  anyPlaying,
  crossfader,
  onCrossfader,
  crossfaderCurve,
  onCrossfaderCurve,
  crossfaderReverse,
  onCrossfaderReverse,
  onSyncAll,
  onSyncKey,
  onFocusDeck,
  onAutomix,
  deckHandlers,
  onAddSource,
  onLoadLane,
  children,
}) {
  const performanceDecks = [
    focusedDeck,
    ...loadedDecks.filter((deck) => deck.id !== focusedDeck.id),
  ].slice(0, 2);
  const coachMessage = !loadedDecks.length
    ? 'Drop a track to begin'
    : anyPlaying
      ? 'Playing'
      : 'Ready to play';

  return (
    <>
      <div className="sd-performance-coach">
        <strong>{coachMessage}</strong>
        <label className="sd-performance-crossfade">
          Crossfade
          <input
            type="range"
            aria-label="Performance crossfader"
            min="0"
            max="100"
            value={crossfader}
            onChange={(event) => onCrossfader(Number(event.target.value))}
          />
        </label>
        <CrossfaderOptions
          curve={crossfaderCurve}
          onCurve={onCrossfaderCurve}
          reverse={crossfaderReverse}
          onReverse={onCrossfaderReverse}
        />
        <SyncButtons onSyncAll={onSyncAll} onSyncKey={onSyncKey} />
        <div className="sd-scene-buttons" aria-label="Performance scenes">
          {decks.map((deck) => (
            <button
              type="button"
              key={deck.id}
              className={loadedDecks.length && focusedDeck.id === deck.id ? 'is-active' : ''}
              onClick={() => onFocusDeck(deck.id)}
            >
              {deck.id}
            </button>
          ))}
          <button
            type="button"
            className={!loadedDecks.length ? 'is-active' : ''}
            onClick={onAutomix}
          >
            Auto mix
          </button>
        </div>
      </div>
      <section className="sd-performance-stage" aria-label="Performance sources">
        {loadedDecks.length ? (
          <div className="sd-focused-deck">
            <div className="sd-decks-grid" data-deck-count={performanceDecks.length}>
              {performanceDecks.map((deck) => (
                <StemDeckChannel key={deck.id} deck={deck} {...deckHandlers[deck.id]} />
              ))}
            </div>
            <button
              type="button"
              className="sd-source-dock"
              aria-label="Add source"
              onClick={onAddSource}
            >
              <Plus size={24} />
              <strong>SOURCE</strong>
            </button>
          </div>
        ) : (
          <EmptyPerformance
            onAddSource={onAddSource}
            onDropTrack={(file) => void onLoadLane(focusedDeck.id, 'fullMix', file)}
          />
        )}
      </section>
      {children}
    </>
  );
}
