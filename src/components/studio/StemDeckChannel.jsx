import { useRef } from 'react';
import { ChevronDown, Link2, Pause, Play, Scissors, Upload, WandSparkles } from 'lucide-react';

export const TOOL_TABS = ['CUE', 'LOOP', 'FX', 'SYNC', 'SRC'];

const STEM_IDS = ['drums', 'bass', 'music', 'vocals'];
const STEM_LABELS = ['DRUMS', 'BASS', 'MUSIC', 'VOCALS'];
const STEM_WAVE_DEFINITIONS = [
  { id: 'vocals', label: 'VOX', color: '#d4537e', offset: 9 },
  { id: 'drums', label: 'DRM', color: '#4a9eff', offset: 0 },
  { id: 'bass', label: 'BAS', color: '#4ad9c4', offset: 18 },
  { id: 'music', label: 'OTH', color: '#888780', offset: 27 },
];
const LOOP_ROLLS = ['1/4', '1/2', '1', '2', '4', '8'];
const BEAT_JUMPS = [-32, -16, -8, -4, 4, 8, 16, 32];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function Knob({ label, value, min = 0, max = 100, onChange, accent, suffix = '' }) {
  const normalized = (clamp(value, min, max) - min) / Math.max(1, max - min);
  const angle = -135 + normalized * 270;

  return (
    <label className="sd-knob" style={{ '--sd-accent': accent, '--sd-angle': `${angle}deg` }}>
      <span>{label}</span>
      <span className="sd-knob-dial">
        <i />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />
      </span>
      <output>
        {value}
        {suffix}
      </output>
    </label>
  );
}

export function VerticalFader({ label, value, min = 0, max = 100, onChange, accent }) {
  return (
    <label className="sd-vfader" style={{ '--sd-accent': accent }}>
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
      <output>{value}</output>
    </label>
  );
}

export function SegmentMeter({ level, accent, label, compact = false }) {
  const active = Math.round(clamp(level, 0, 1) * (compact ? 9 : 14));
  const count = compact ? 9 : 14;

  return (
    <div className={`sd-segment-meter${compact ? ' is-compact' : ''}`} aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <i
          key={index}
          className={`${index < active ? 'is-lit' : ''}${index > count - 3 ? ' is-hot' : index > count - 6 ? ' is-warm' : ''}`}
          style={{ '--sd-accent': accent }}
        />
      ))}
      {label ? <span>{label}</span> : null}
    </div>
  );
}

function Waveform({ deck, position, onSeek }) {
  const progress = deck.duration ? Math.min(100, (position / deck.duration) * 100) : 0;

  return (
    <button
      type="button"
      className={`sd-waveform${deck.playing ? ' is-playing' : ''}`}
      style={{ '--sd-accent': deck.accent }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        onSeek(((event.clientX - bounds.left) / bounds.width) * deck.duration);
      }}
      disabled={!deck.duration}
      aria-label={`Seek Deck ${deck.id}`}
    >
      <span className="sd-wave-grid" />
      <span className="sd-wave-bars">
        {deck.waveform.map((height, index) => (
          <i key={index} style={{ height: `${height}%` }} />
        ))}
      </span>
      <span className="sd-wave-playhead" style={{ left: `${progress}%` }} />
    </button>
  );
}

function StemWavefield({ deck, position, onSeek, onLoad, onChange }) {
  const progress = deck.duration ? Math.min(100, (position / deck.duration) * 100) : 0;

  return (
    <div className="sd-stem-wavefield">
      {STEM_WAVE_DEFINITIONS.map(({ id, label, color, offset }) => {
        const lane = deck.lanes[id];
        const ready = lane.status === 'ready' || deck.lanes.fullMix.status === 'ready';
        return (
          <section
            className={`sd-stem-wave-column${ready ? ' is-ready' : ''}`}
            style={{ '--sd-stem-color': color }}
            key={id}
          >
            <header>
              <strong>{label}</strong>
              <span>
                {lane.status === 'loading' ? 'ANALYZING' : lane.status === 'ready' ? 'STEM' : 'DSP'}
              </span>
            </header>
            <button
              type="button"
              className="sd-vertical-wave"
              onClick={(event) => {
                if (!deck.duration) {
                  onLoad(id);
                  return;
                }
                const bounds = event.currentTarget.getBoundingClientRect();
                onSeek(((event.clientY - bounds.top) / bounds.height) * deck.duration);
              }}
              aria-label={deck.duration ? `Seek ${label} stem` : `Load ${label} stem`}
            >
              <span className="sd-vertical-wave-grid" />
              <span className="sd-vertical-wave-shape">
                {Array.from({ length: 38 }, (_, index) => {
                  const peak = deck.waveform[(index * 2 + offset) % deck.waveform.length] || 10;
                  const width = Math.min(88, Math.max(8, peak * (id === 'bass' ? 0.9 : 1.45)));
                  return <i key={index} style={{ width: `${width}%` }} />;
                })}
              </span>
              <span className="sd-vertical-playhead" style={{ top: `${progress}%` }} />
            </button>
            <div className="sd-stem-wave-controls">
              <Knob
                label=""
                value={lane.level}
                onChange={(level) => onChange(id, { level })}
                accent={color}
              />
              <div>
                <button
                  type="button"
                  className={lane.muted ? 'is-active' : ''}
                  onClick={() => onChange(id, { muted: !lane.muted })}
                  disabled={!ready}
                  aria-label={`Mute ${label}`}
                  aria-pressed={lane.muted}
                >
                  M
                </button>
                <button
                  type="button"
                  className={lane.solo ? 'is-active is-solo' : ''}
                  onClick={() => onChange(id, { solo: !lane.solo })}
                  disabled={!ready}
                  aria-label={`Solo ${label}`}
                  aria-pressed={lane.solo}
                >
                  S
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CueTools({ deck, position, onSetHotCue, onDeleteHotCue, onDeckChange }) {
  return (
    <div className="sd-tool-content sd-cue-tools">
      <div className="sd-hot-cues">
        {deck.hotCues.map((cue, index) => (
          <button
            type="button"
            key={index}
            className={cue !== null ? 'is-set' : ''}
            onClick={() => onSetHotCue(index, cue === null ? position : cue)}
            onDoubleClick={() => onDeleteHotCue(index)}
            title={cue === null ? `Set hot cue ${index + 1}` : `Jump to hot cue ${index + 1}`}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="sd-marker-row">
        <button type="button" onClick={() => onDeckChange({ introEnd: position })}>
          Intro End
        </button>
        <button type="button" onClick={() => onDeckChange({ outroStart: position })}>
          Outro Start
        </button>
      </div>
    </div>
  );
}

function LoopTools({ deck, position, onDeckChange, onSetLoop, onBeatJump }) {
  return (
    <div className="sd-tool-content sd-loop-tools">
      <div className="sd-loop-main-row">
        <button type="button" onClick={() => onDeckChange({ loopStart: position })}>
          IN
        </button>
        <button
          type="button"
          onClick={() => {
            const start = deck.loopStart ?? 0;
            const end = Math.max(start + 0.1, position);
            onSetLoop(true, start, end);
          }}
        >
          OUT
        </button>
        <button
          type="button"
          className={deck.looping ? 'is-active' : ''}
          onClick={() => onSetLoop(!deck.looping, deck.loopStart ?? 0, deck.loopEnd)}
        >
          LOOP
        </button>
        <button
          type="button"
          onClick={() =>
            onSetLoop(true, deck.loopStart, deck.loopStart + (deck.loopEnd - deck.loopStart) / 2)
          }
        >
          1/2
        </button>
        <button
          type="button"
          onClick={() =>
            onSetLoop(true, deck.loopStart, deck.loopStart + (deck.loopEnd - deck.loopStart) * 2)
          }
        >
          x2
        </button>
        <button
          type="button"
          className={deck.slip ? 'is-active' : ''}
          onClick={() => onDeckChange({ slip: !deck.slip })}
        >
          Slip
        </button>
      </div>
      <div className="sd-loop-roll-row">
        {LOOP_ROLLS.map((roll) => (
          <button
            type="button"
            key={roll}
            onClick={() => onSetLoop(true, position, position, roll)}
          >
            {roll}
          </button>
        ))}
      </div>
      <div className="sd-beat-jump-row">
        {BEAT_JUMPS.map((beats) => (
          <button type="button" key={beats} onClick={() => onBeatJump(beats)}>
            {beats > 0 ? `+${beats}` : beats}
          </button>
        ))}
      </div>
    </div>
  );
}

function FxTools({ deck, onDeckChange, onStemFxChange }) {
  return (
    <div className="sd-tool-content sd-fx-tools">
      <Knob
        label="ECHO"
        value={deck.fx.echo}
        onChange={(echo) => onDeckChange({ fx: { ...deck.fx, echo } })}
        accent={deck.accent}
      />
      <Knob
        label="MACRO"
        value={deck.fx.macro}
        onChange={(macro) =>
          onDeckChange({ fx: { ...deck.fx, macro, echo: macro, reverb: macro } })
        }
        accent={deck.accent}
      />
      <div className="sd-stem-fx-grid">
        <span />
        {STEM_LABELS.map((label) => (
          <strong key={label}>{label.slice(0, 2)}</strong>
        ))}
        {['filter', 'send', 'pitch'].map((control) => (
          <div className="sd-stem-fx-row" key={control}>
            <span>{control === 'filter' ? 'F' : control === 'send' ? 'S' : 'P'}</span>
            {STEM_IDS.map((stemId) => (
              <input
                key={stemId}
                type="range"
                min={control === 'pitch' ? -12 : 0}
                max={control === 'pitch' ? 12 : 100}
                value={deck.stemFx[stemId][control]}
                onChange={(event) =>
                  onStemFxChange(stemId, { [control]: Number(event.target.value) })
                }
                aria-label={`${stemId} ${control}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncTools({ deck, onDeckChange }) {
  return (
    <div className="sd-tool-content sd-sync-tools">
      <label>
        <span>BPM</span>
        <input
          type="number"
          min="40"
          max="240"
          value={deck.bpm}
          onChange={(event) => onDeckChange({ bpm: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>BEAT</span>
        <input
          type="number"
          step="0.01"
          value={deck.beatOffset}
          onChange={(event) => onDeckChange({ beatOffset: Number(event.target.value) })}
        />
      </label>
      <label>
        <span>DOWN</span>
        <input
          type="number"
          min="1"
          max="16"
          value={deck.downbeat}
          onChange={(event) => onDeckChange({ downbeat: Number(event.target.value) })}
        />
      </label>
      <select
        value={deck.tempoInterpretation}
        onChange={(event) => onDeckChange({ tempoInterpretation: event.target.value })}
        aria-label="Tempo interpretation"
      >
        <option>Straight</option>
        <option>Half time</option>
        <option>Double time</option>
      </select>
      <select
        value={deck.syncMode}
        onChange={(event) => onDeckChange({ syncMode: event.target.value })}
        aria-label="Sync mode"
      >
        <option>BPM</option>
        <option>Beat grid</option>
        <option>Off</option>
      </select>
      <select
        value={deck.keyName}
        onChange={(event) => onDeckChange({ keyName: event.target.value })}
        aria-label="Target key"
      >
        <option>{deck.keyName}</option>
        <option>C maj</option>
        <option>A min</option>
        <option>G maj</option>
        <option>E min</option>
        <option>D min</option>
      </select>
      <button
        type="button"
        className={deck.liveKey ? 'is-active' : ''}
        onClick={() => onDeckChange({ liveKey: !deck.liveKey })}
      >
        LiveKey
      </button>
      <button
        type="button"
        className={deck.keyLock ? 'is-active' : ''}
        onClick={() => onDeckChange({ keyLock: !deck.keyLock })}
      >
        KeyLock
      </button>
    </div>
  );
}

function SourceTools({
  deck,
  onRequestLane,
  onRequestStemSet,
  onExtractMidi,
  onExtractDrums,
  onLaneChange,
}) {
  return (
    <div className="sd-tool-content sd-source-tools">
      <button type="button" onClick={() => onRequestLane('fullMix')}>
        <Upload size={12} /> Load
      </button>
      <button type="button" onClick={onRequestStemSet} disabled={!deck.duration}>
        <WandSparkles size={12} /> AI Split
      </button>
      <button type="button" onClick={() => onRequestLane('drums')}>
        Stem
      </button>
      <select
        aria-label="Stem lane"
        onChange={(event) => onRequestLane(event.target.value)}
        defaultValue="drums"
      >
        {STEM_IDS.map((stemId) => (
          <option value={stemId} key={stemId}>
            {stemId}
          </option>
        ))}
      </select>
      <Knob
        label="MIX"
        value={deck.lanes.fullMix.level}
        onChange={(level) => onLaneChange('fullMix', { level })}
        accent={deck.accent}
      />
      <button type="button" onClick={onExtractMidi} disabled={!deck.duration}>
        → MIDI
      </button>
      <button type="button" onClick={onExtractDrums} disabled={!deck.duration}>
        → DRUMS
      </button>
    </div>
  );
}

function DeckToolbox(props) {
  const { deck } = props;
  const tab = deck.activeToolTab;

  return (
    <div className="sd-deck-toolbox">
      <nav aria-label={`Deck ${deck.id} tools`}>
        {TOOL_TABS.map((label) => (
          <button
            type="button"
            key={label}
            className={tab === label ? 'is-active' : ''}
            onClick={() => props.onDeckChange({ activeToolTab: label })}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'CUE' ? <CueTools {...props} /> : null}
      {tab === 'LOOP' ? <LoopTools {...props} /> : null}
      {tab === 'FX' ? <FxTools {...props} /> : null}
      {tab === 'SYNC' ? <SyncTools {...props} /> : null}
      {tab === 'SRC' ? (
        <SourceTools
          {...props}
          onRequestLane={props.onRequestLane}
          onRequestStemSet={props.onRequestStemSet}
        />
      ) : null}
    </div>
  );
}

export function StemDeckChannel({
  deck,
  position,
  meterLevel,
  onLoadLane,
  onLoadStemSet,
  onDeckChange,
  onLaneChange,
  onTogglePlay,
  onCue,
  onSeek,
  onSetHotCue,
  onDeleteHotCue,
  onSetLoop,
  onBeatJump,
  onStemFxChange,
  onExtractMidi,
  onExtractDrums,
}) {
  const inputsRef = useRef({});
  const requestLane = (laneId) => inputsRef.current[laneId]?.click();

  return (
    <article
      className={`sd-deck${deck.playing ? ' is-playing' : ''}`}
      style={{ '--sd-accent': deck.accent }}
      aria-label={`Deck ${deck.id}`}
    >
      <header className="sd-deck-header">
        <button
          type="button"
          className="sd-deck-badge"
          onClick={() => onDeckChange({ masterDeck: true })}
          aria-label={`Use Deck ${deck.id} as sync master`}
        >
          {deck.id}
        </button>
        <button type="button" className="sd-deck-title" onClick={() => requestLane('fullMix')}>
          <span>{deck.title}</span>
          <ChevronDown size={12} />
        </button>
        <button
          type="button"
          className="sd-deck-chip"
          onClick={() => onDeckChange({ activeToolTab: 'SYNC' })}
        >
          {deck.bpm.toFixed ? deck.bpm.toFixed(1) : deck.bpm} BPM
        </button>
        <button
          type="button"
          className="sd-deck-chip"
          onClick={() => onDeckChange({ activeToolTab: 'SYNC' })}
        >
          ♩ {deck.keyName}
        </button>
      </header>

      <Waveform deck={deck} position={position} onSeek={onSeek} />

      <StemWavefield
        deck={deck}
        position={position}
        onSeek={onSeek}
        onLoad={requestLane}
        onChange={onLaneChange}
      />

      <div className="sd-deck-transport">
        <button
          type="button"
          className="sd-play-button"
          onClick={onTogglePlay}
          disabled={!deck.duration}
          aria-label={deck.playing ? `Pause Deck ${deck.id}` : `Play Deck ${deck.id}`}
        >
          {deck.playing ? <Pause size={15} /> : <Play size={15} />}
          {deck.playing ? 'PAUSE' : 'PLAY'}
        </button>
        <button type="button" onClick={onCue} disabled={!deck.duration}>
          CUE
        </button>
        <div className="sd-cf-assign" aria-label={`Deck ${deck.id} crossfader assignment`}>
          {[
            ['left', 'A'],
            ['center', 'Ctr'],
            ['right', 'B'],
          ].map(([side, label]) => (
            <button
              type="button"
              key={side}
              className={deck.cfSide === side ? 'is-active' : ''}
              onClick={() => onDeckChange({ cfSide: side })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="sd-deck-mix-band">
        <div className="sd-eq-bank">
          {['low', 'mid', 'high'].map((band) => (
            <Knob
              key={band}
              label={band.toUpperCase()}
              value={deck.eq[band]}
              onChange={(value) => onDeckChange({ eq: { ...deck.eq, [band]: value } })}
              accent={deck.accent}
            />
          ))}
          <Knob
            label="FILT"
            value={deck.filter}
            onChange={(filter) => onDeckChange({ filter })}
            accent={deck.accent}
          />
        </div>
        <VerticalFader
          label="VOL"
          value={deck.gain}
          onChange={(gain) => onDeckChange({ gain })}
          accent={deck.accent}
        />
        <VerticalFader
          label="XF"
          value={deck.fader}
          onChange={(fader) => onDeckChange({ fader })}
          accent={deck.accent}
        />
        <VerticalFader
          label="PITCH"
          value={deck.pitch}
          min={-12}
          max={12}
          onChange={(pitch) => onDeckChange({ pitch })}
          accent={deck.accent}
        />
        <SegmentMeter level={meterLevel} accent={deck.accent} label={deck.id} compact />
      </div>

      <DeckToolbox
        deck={deck}
        position={position}
        onDeckChange={onDeckChange}
        onSetHotCue={onSetHotCue}
        onDeleteHotCue={onDeleteHotCue}
        onSetLoop={onSetLoop}
        onBeatJump={onBeatJump}
        onStemFxChange={onStemFxChange}
        onLaneChange={onLaneChange}
        onRequestLane={requestLane}
        onRequestStemSet={() => inputsRef.current.stemSet?.click()}
        onExtractMidi={onExtractMidi}
        onExtractDrums={onExtractDrums}
      />

      <footer className="sd-deck-status">
        <span>
          {deck.lanes.fullMix.status === 'ready'
            ? deck.lanes.fullMix.name
            : 'AI stems: load a full mix'}
        </span>
        <span>
          <Link2 size={10} /> {deck.synced ? 'SYNCED' : deck.duration ? 'READY' : 'EMPTY'}
        </span>
      </footer>

      {Object.keys(deck.lanes).map((laneId) => (
        <input
          key={laneId}
          ref={(element) => {
            inputsRef.current[laneId] = element;
          }}
          type="file"
          accept="audio/*"
          hidden
          onChange={(event) => {
            onLoadLane(laneId, event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      ))}
      <input
        ref={(element) => {
          inputsRef.current.stemSet = element;
        }}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={(event) => {
          onLoadStemSet([...event.target.files]);
          event.target.value = '';
        }}
      />
    </article>
  );
}

export function ArrangementWave({ peaks, accent }) {
  return (
    <span className="sd-arrangement-wave" style={{ '--sd-accent': accent }}>
      {peaks.slice(0, 48).map((height, index) => (
        <i key={index} style={{ height: `${Math.max(8, height)}%` }} />
      ))}
    </span>
  );
}

export function EmptyArrangementDrop({ onDrop }) {
  return (
    <div
      className="sd-arrangement-empty"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.files?.[0]);
      }}
    >
      <Scissors size={14} /> Drop audio to create a clip
    </div>
  );
}
