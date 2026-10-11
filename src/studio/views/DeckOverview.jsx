import { useRef } from 'react';
import { Pause, Play, SlidersHorizontal, Upload } from 'lucide-react';
import { Waveform } from '../../components/studio/StemDeckChannel';
import { useTransport, useDeckPosition } from '../transport/transportStore';
import './DeckOverview.css';

const STEMS = [
  ['vocals', 'Vocals'],
  ['drums', 'Drums'],
  ['bass', 'Bass'],
  ['music', 'Music'],
];
const time = (seconds) =>
  `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, '0')}`;
function Position({ deck }) {
  const position = useDeckPosition(deck.id);
  return (
    <div className="sd-overview-time">
      <span>{time(position)}</span>
      <span>{time(deck.duration)}</span>
    </div>
  );
}
/** Uses the same deck and audio commands as the detailed channel. No alternate mixer state. */
export function OverviewDeck({ deck, handlers, onDetails }) {
  const input = useRef(null),
    laneTarget = useRef('fullMix');
  const transport = useTransport();
  const load = (lane) => {
    laneTarget.current = lane;
    input.current?.click();
  };
  return (
    <article
      className="sd-overview-deck"
      aria-label={`Deck ${deck.id} overview`}
      style={{ '--deck-color': deck.accent }}
    >
      <header>
        <strong className="sd-overview-letter">{deck.id}</strong>
        <div>
          <h3>{deck.duration ? deck.title : 'Add a track'}</h3>
          <span>{deck.duration ? `${deck.bpm} BPM` : 'Audio or prepared stems'}</span>
        </div>
        <button type="button" aria-label={`Open Deck ${deck.id} controls`} onClick={onDetails}>
          <SlidersHorizontal size={17} />
        </button>
      </header>
      <div className="sd-overview-play">
        <button
          type="button"
          disabled={!deck.duration}
          aria-label={`${deck.playing ? 'Pause' : 'Play'} Deck ${deck.id}`}
          onClick={handlers.onTogglePlay}
        >
          {deck.playing ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <Waveform
          deck={deck}
          getPosition={() => transport.getPosition(deck.id)}
          onSeek={handlers.onSeek}
        />
        <button
          type="button"
          aria-label={`Load track into Deck ${deck.id}`}
          onClick={() => load('fullMix')}
        >
          <Upload size={16} />
        </button>
      </div>
      <Position deck={deck} />
      <label className="sd-overview-gain">
        Deck level
        <input
          type="range"
          aria-label={`Deck ${deck.id} level`}
          min="0"
          max="100"
          value={deck.gain}
          disabled={!deck.duration}
          onChange={(e) => handlers.onDeckChange({ gain: Number(e.target.value) })}
        />
        <output>{deck.gain}%</output>
      </label>
      <div className="sd-overview-stems">
        {STEMS.map(([id, label]) => {
          const lane = deck.lanes[id],
            ready = lane.status === 'ready';
          return (
            <section key={id} aria-label={`${label} stem`}>
              <button
                className="sd-overview-stem-name"
                type="button"
                title={`Load ${label.toLowerCase()} stem`}
                onClick={() => load(id)}
              >
                {label}
              </button>
              <input
                type="range"
                aria-label={`Deck ${deck.id} ${label} level`}
                min="0"
                max="100"
                value={lane.level}
                disabled={!ready}
                onChange={(e) => handlers.onLaneChange(id, { level: Number(e.target.value) })}
              />
              <output>
                {!ready
                  ? '—'
                  : lane.muted || lane.level === 0
                    ? '−∞'
                    : `${(20 * Math.log10(lane.level / 100)).toFixed(1)} dB`}
              </output>
              <div className="sd-overview-lane-buttons">
                <button
                  type="button"
                  disabled={!ready}
                  aria-label={`Mute Deck ${deck.id} ${label}`}
                  aria-pressed={lane.muted}
                  onClick={() => handlers.onLaneChange(id, { muted: !lane.muted })}
                >
                  M
                </button>
                <button
                  type="button"
                  disabled={!ready}
                  aria-label={`Solo Deck ${deck.id} ${label}`}
                  aria-pressed={lane.solo}
                  onClick={() => handlers.onLaneChange(id, { solo: !lane.solo })}
                >
                  S
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept="audio/*"
        aria-label={`Load Deck ${deck.id} audio`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handlers.onLoadLane(laneTarget.current, file);
        }}
      />
    </article>
  );
}
export default function DeckOverview({ decks, deckHandlers, onDetails }) {
  return (
    <div className="sd-deck-overview-grid" aria-label="Four-deck overview">
      {decks.map((deck) => (
        <OverviewDeck
          key={deck.id}
          deck={deck}
          handlers={deckHandlers[deck.id]}
          onDetails={() => onDetails(deck.id)}
        />
      ))}
    </div>
  );
}
