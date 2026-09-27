import { memo } from 'react';
import { Headphones } from 'lucide-react';
import { Knob, VerticalFader } from '../../components/studio/StemDeckChannel';
import { useLiveEdit } from '../hooks/useLiveEdit';
import { DELAY_DIVISIONS, RETURN_NAMES, SEND_BUSES, normalizeSends } from '../mixer/mixerModel';
import { ChannelMeter, GainReduction } from './ChannelMeter';

const TRACK_ACCENT = '#9bd8ca';
const MASTER_ACCENT = '#edf0f4';
export const RETURN_ACCENTS = { a: '#7fb6ff', b: '#c49bff' };
const ASSIST_TARGETS = ['Streaming -14', 'Club -9', 'Broadcast -16'];

function trackType(track) {
  if (track.offline) return 'Offline · enable in Arrange';
  if (track.role === 'reference') return 'Safety reference';
  return track.kind === 'midi' ? 'Instrument' : 'Audio';
}

function Toggle({ pressed, label, onClick, className = '', title, children }) {
  return (
    <button
      type="button"
      className={`${className}${pressed ? ' is-active' : ''}`}
      aria-pressed={pressed}
      aria-label={label}
      title={title || label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Compact dock: one channel as its name and a horizontal meter. */
function MeterChip({ channel, name, detail, label, accent, children }) {
  return (
    <section
      role="group"
      className="sd-mixer-chip"
      aria-label={label}
      style={{ '--sd-accent': accent }}
    >
      <header>
        <strong title={name}>{name}</strong>
        {detail ? <span>{detail}</span> : null}
      </header>
      <ChannelMeter channel={channel} label={`${label} level`} orientation="horizontal" />
      {children}
    </section>
  );
}

export const DeckStrip = memo(function DeckStrip({
  deck,
  compact,
  cueOff,
  insertsOpen,
  onDeckChange,
  onOpenInserts,
}) {
  const name = `Deck ${deck.id}`;
  if (compact)
    return (
      <MeterChip
        channel={`deck:${deck.id}`}
        name={deck.id}
        detail={deck.muted ? 'Muted' : deck.cue ? 'Cue' : ''}
        label={`${name} channel`}
        accent={deck.accent}
      />
    );
  const change = (updates) => onDeckChange(deck.id, updates);
  return (
    <section
      role="group"
      className="sd-mixer-strip is-deck"
      aria-label={`${name} channel`}
      style={{ '--sd-accent': deck.accent }}
    >
      <header className="sd-mixer-strip-name">
        <strong>{deck.id}</strong>
        <span title={deck.title}>{deck.title}</span>
      </header>
      <button
        type="button"
        id={`mixer-inserts-${deck.id}`}
        className="sd-mixer-insert"
        aria-haspopup="dialog"
        aria-expanded={insertsOpen}
        aria-label={`${name} inserts, ${deck.inserts.length} of 8`}
        onClick={() => onOpenInserts(deck.id)}
      >
        <span>FX</span>
        <strong>{deck.inserts.length ? `${deck.inserts.length} inserts` : 'Insert'}</strong>
      </button>
      <div className="sd-mixer-sends">
        {SEND_BUSES.map((bus) => (
          <Knob
            key={bus}
            label={`SEND ${bus.toUpperCase()}`}
            ariaLabel={`${name} send ${bus.toUpperCase()} (${RETURN_NAMES[bus]})`}
            value={deck.sends[bus]}
            onChange={(value) => change({ sends: { ...deck.sends, [bus]: value } })}
            accent={deck.accent}
          />
        ))}
      </div>
      <div className="sd-mixer-level">
        <VerticalFader
          label="CH"
          ariaLabel={`${name} channel fader`}
          value={deck.fader}
          onChange={(fader) => change({ fader })}
          accent={deck.accent}
        />
        <ChannelMeter channel={`deck:${deck.id}`} label={`${name} level`} />
      </div>
      <div className="sd-mixer-strip-buttons">
        <Toggle
          className="sd-mixer-mute"
          pressed={deck.muted}
          label={`Mute deck ${deck.id}`}
          onClick={() => change({ muted: !deck.muted })}
        >
          M
        </Toggle>
        <Toggle
          className="sd-mixer-solo"
          pressed={deck.solo}
          label={`Solo deck ${deck.id}`}
          onClick={() => change({ solo: !deck.solo })}
        >
          S
        </Toggle>
        <Toggle
          className="sd-mixer-cue"
          pressed={deck.cue}
          label={`Cue deck ${deck.id} in headphones`}
          title={
            cueOff
              ? `Cue deck ${deck.id}. Headphone cue is off: choose Split or Outputs 3–4.`
              : `Cue deck ${deck.id} in headphones`
          }
          onClick={() => change({ cue: !deck.cue })}
        >
          <Headphones size={12} aria-hidden="true" />
        </Toggle>
      </div>
    </section>
  );
});

/**
 * One arrangement track. Fader, pan and send drags apply live and are
 * committed as a single undo step when released.
 */
export const TrackStrip = memo(function TrackStrip({
  track,
  compact,
  onUpdateTrack,
  onCommitTrack,
  onOpenDevices,
}) {
  const update = (changes, live) => onUpdateTrack(track.id, changes, live);
  const gain = useLiveEdit(update, onCommitTrack);
  const pan = useLiveEdit(update, onCommitTrack);
  const sendA = useLiveEdit(update, onCommitTrack);
  const sendB = useLiveEdit(update, onCommitTrack);
  const accent = track.color || TRACK_ACCENT;
  if (compact)
    return (
      <MeterChip
        channel={`track:${track.id}`}
        name={track.name}
        detail={track.muted ? 'Muted' : track.offline ? 'Offline' : ''}
        label={`${track.name} channel`}
        accent={accent}
      />
    );
  const sendEdits = { a: sendA, b: sendB };
  const sends = normalizeSends(track.sends);
  const effects = track.effects?.length || 0;
  return (
    <section
      role="group"
      className="sd-mixer-strip is-track"
      aria-label={`${track.name} channel`}
      style={{ '--sd-accent': accent }}
    >
      <header className="sd-mixer-strip-name">
        <strong title={track.name}>{track.name}</strong>
        <span>{trackType(track)}</span>
      </header>
      <button
        type="button"
        className="sd-mixer-insert"
        aria-label={`Open devices for ${track.name} in Arrange, ${effects} effects`}
        onClick={() => onOpenDevices(track.id)}
      >
        <span>FX</span>
        <strong>{effects ? `${effects} devices` : 'Devices'}</strong>
      </button>
      <div className="sd-mixer-sends is-track">
        {SEND_BUSES.map((bus) => (
          <Knob
            key={bus}
            label={`SND ${bus.toUpperCase()}`}
            ariaLabel={`${track.name} send ${bus.toUpperCase()} (${RETURN_NAMES[bus]})`}
            value={sends[bus]}
            onChange={(value) => sendEdits[bus].change({ sends: { ...sends, [bus]: value } })}
            inputProps={sendEdits[bus].handlers}
            accent={accent}
          />
        ))}
        <Knob
          label="PAN"
          ariaLabel={`${track.name} pan`}
          value={track.pan}
          min={-1}
          max={1}
          step={0.01}
          onChange={(value) => pan.change({ pan: value })}
          inputProps={pan.handlers}
          accent={accent}
        />
      </div>
      <div className="sd-mixer-level">
        <VerticalFader
          label="GAIN"
          ariaLabel={`${track.name} gain`}
          value={track.gain}
          max={300}
          accent={accent}
          onChange={(value) => gain.change({ gain: value })}
          inputProps={gain.handlers}
        />
        <ChannelMeter channel={`track:${track.id}`} label={`${track.name} level`} />
      </div>
      <div className="sd-mixer-strip-buttons">
        <Toggle
          className="sd-mixer-mute"
          pressed={!!track.muted}
          label={`Mute track ${track.name}`}
          onClick={() => onUpdateTrack(track.id, { muted: !track.muted })}
        >
          M
        </Toggle>
        <Toggle
          className="sd-mixer-solo"
          pressed={!!track.solo}
          label={`Solo track ${track.name}`}
          onClick={() => onUpdateTrack(track.id, { solo: !track.solo })}
        >
          S
        </Toggle>
      </div>
    </section>
  );
});

function ReverbControls({ params, change, accent }) {
  return (
    <>
      <Knob
        label="SIZE"
        ariaLabel="Reverb size"
        value={params.size}
        onChange={(size) => change({ size })}
        accent={accent}
      />
      <Knob
        label="DECAY"
        ariaLabel="Reverb decay in seconds"
        value={params.decay}
        min={0.3}
        max={10}
        step={0.1}
        suffix="s"
        onChange={(decay) => change({ decay })}
        accent={accent}
      />
      <Knob
        label="PRE"
        ariaLabel="Reverb pre-delay in milliseconds"
        value={params.preDelay}
        max={200}
        suffix="ms"
        onChange={(preDelay) => change({ preDelay })}
        accent={accent}
      />
      <Knob
        label="TONE"
        ariaLabel="Reverb tone, dark to bright"
        value={params.tone}
        onChange={(tone) => change({ tone })}
        accent={accent}
      />
    </>
  );
}

function DelayControls({ params, change, accent }) {
  return (
    <>
      <label className="sd-mixer-division">
        <span>DIV</span>
        <select
          aria-label="Delay division"
          value={params.division}
          onChange={(event) => change({ division: event.target.value })}
        >
          {DELAY_DIVISIONS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <Knob
        label="FDBK"
        ariaLabel="Delay feedback"
        value={params.feedback}
        max={90}
        suffix="%"
        onChange={(feedback) => change({ feedback })}
        accent={accent}
      />
      <Knob
        label="TONE"
        ariaLabel="Delay tone, dark to bright"
        value={params.tone}
        onChange={(tone) => change({ tone })}
        accent={accent}
      />
    </>
  );
}

export const ReturnStrip = memo(function ReturnStrip({ bus, params, compact, onChange }) {
  const name = `Return ${bus.toUpperCase()} ${RETURN_NAMES[bus]}`;
  const accent = RETURN_ACCENTS[bus];
  if (compact)
    return (
      <MeterChip
        channel={`return:${bus}`}
        name={bus.toUpperCase()}
        detail={params.muted ? 'Muted' : RETURN_NAMES[bus]}
        label={`${name} channel`}
        accent={accent}
      />
    );
  const change = (changes) => onChange(bus, changes);
  const Controls = bus === 'a' ? ReverbControls : DelayControls;
  return (
    <section
      role="group"
      className="sd-mixer-strip is-return"
      aria-label={`${name} channel`}
      style={{ '--sd-accent': accent }}
    >
      <header className="sd-mixer-strip-name">
        <strong>{bus.toUpperCase()}</strong>
        <span>{RETURN_NAMES[bus]}</span>
      </header>
      <div className="sd-mixer-return-controls">
        <Controls params={params} change={change} accent={accent} />
      </div>
      <div className="sd-mixer-level">
        <VerticalFader
          label="LEVEL"
          ariaLabel={`${name} level`}
          value={params.level}
          onChange={(level) => change({ level })}
          accent={accent}
        />
        <ChannelMeter channel={`return:${bus}`} label={`${name} meter`} />
      </div>
      <div className="sd-mixer-strip-buttons">
        <Toggle
          className="sd-mixer-mute"
          pressed={params.muted}
          label={`Mute return ${bus.toUpperCase()}`}
          onClick={() => change({ muted: !params.muted })}
        >
          M
        </Toggle>
        {bus === 'b' ? (
          <Toggle
            className="sd-mixer-pingpong"
            pressed={params.pingPong}
            label="Ping-pong delay"
            onClick={() => change({ pingPong: !params.pingPong })}
          >
            PING
          </Toggle>
        ) : null}
      </div>
    </section>
  );
});

/** Master bus: level, limiter, master assist, tempo tools and the program meter. */
export const MasterStrip = memo(function MasterStrip({
  compact,
  level,
  limiter,
  assist,
  assistMode,
  bpm,
  keyLocked,
  onLevel,
  onLimiter,
  onAssist,
  onAssistMode,
  onTapTempo,
  onToggleKeyLock,
}) {
  if (compact)
    return (
      <MeterChip channel="master" name="MASTER" label="Master channel" accent={MASTER_ACCENT}>
        <GainReduction />
      </MeterChip>
    );
  return (
    <section
      role="group"
      className="sd-mixer-strip is-master"
      aria-label="Master channel"
      style={{ '--sd-accent': MASTER_ACCENT }}
    >
      <header className="sd-mixer-strip-name">
        <strong>MASTER</strong>
        <GainReduction />
      </header>
      <div className="sd-mixer-master-controls">
        <Toggle
          className="sd-mixer-limit"
          pressed={limiter}
          label="Master limiter"
          onClick={() => onLimiter((value) => !value)}
        >
          LIMIT
        </Toggle>
        <Toggle
          className="sd-mixer-assist"
          pressed={assist}
          label="Master assist"
          onClick={() => onAssist((value) => !value)}
        >
          ASSIST
        </Toggle>
        <select
          aria-label="Master assist target"
          value={assistMode}
          onChange={(event) => onAssistMode(event.target.value)}
        >
          {ASSIST_TARGETS.map((target) => (
            <option key={target}>{target}</option>
          ))}
        </select>
      </div>
      <div className="sd-mixer-level">
        <VerticalFader
          label="OUT"
          ariaLabel="Master level"
          value={level}
          onChange={onLevel}
          accent={MASTER_ACCENT}
        />
        <ChannelMeter channel="master" label="Program level" />
      </div>
      <div className="sd-mixer-tempo" role="group" aria-label="Tempo">
        <span>
          <small>BPM</small>
          <strong>{bpm.toFixed(1)}</strong>
        </span>
        <button type="button" onClick={onTapTempo} title="Tap to set the project tempo">
          TAP
        </button>
        <Toggle
          className="sd-mixer-keylock"
          pressed={keyLocked}
          label="Key lock all decks"
          onClick={onToggleKeyLock}
        >
          KEY LOCK
        </Toggle>
      </div>
    </section>
  );
});
