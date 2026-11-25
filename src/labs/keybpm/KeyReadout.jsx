import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Pause, Play } from 'lucide-react';
import { formatTime } from '../audio/AudioLabParts';
import {
  camelot,
  cleanCorrection,
  createTapTempo,
  effectiveValues,
  formatBpm,
  NOTES_MAX,
  tempoInterpretation,
} from './keyBpm';
import {
  CIRCLE,
  circlePosition,
  keyDisplay,
  relativeKey,
  scaleFrequencies,
  tonicFrequency,
} from './keyTheory';

const EVIDENCE = {
  supported: 'supported',
  tentative: 'tentative',
  rough: 'rough',
  insufficient: 'not enough evidence',
};

function arc(index, inner, outer) {
  const a0 = ((index - 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
  const a1 = ((index + 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
  const p = (r, a) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  return `M${p(outer, a0)}A${outer} ${outer} 0 0 1 ${p(outer, a1)}L${p(inner, a1)}A${inner} ${inner} 0 0 0 ${p(inner, a0)}Z`;
}

/** Circle of fifths with the shown key lit and the runner-up shaded. */
export function CircleOfFifths({ keyName, alternative }) {
  const main = circlePosition(keyName);
  const alt = circlePosition(alternative);
  const state = (index, ring) =>
    main?.index === index && main.ring === ring
      ? 'is-key'
      : alt?.index === index && alt.ring === ring
        ? 'is-alt'
        : '';
  const code = camelot(keyName);
  return (
    <svg
      className="kb-circle"
      viewBox="-110 -110 220 220"
      role="img"
      aria-label={
        keyName
          ? `Circle of fifths: ${keyName}${alternative ? `, alternative ${alternative}` : ''}`
          : 'Circle of fifths'
      }
    >
      {CIRCLE.map((slot) => {
        const angle = (slot.index / 12) * 2 * Math.PI - Math.PI / 2;
        return (
          <g key={slot.index}>
            <path
              className={`kb-circle-major ${state(slot.index, 'major')}`}
              d={arc(slot.index, 70, 104)}
            />
            <path
              className={`kb-circle-minor ${state(slot.index, 'minor')}`}
              d={arc(slot.index, 38, 68)}
            />
            <text
              className={`kb-circle-label ${state(slot.index, 'major')}`}
              x={Math.cos(angle) * 87}
              y={Math.sin(angle) * 87 + 4}
              textAnchor="middle"
            >
              {slot.major}
            </text>
            <text
              className={`kb-circle-label is-small ${state(slot.index, 'minor')}`}
              x={Math.cos(angle) * 53}
              y={Math.sin(angle) * 53 + 3.5}
              textAnchor="middle"
            >
              {slot.minor}
            </text>
          </g>
        );
      })}
      <text className="kb-circle-code" x="0" y="0" textAnchor="middle">
        {code || '—'}
      </text>
      <text className="kb-circle-caption" x="0" y="17" textAnchor="middle">
        CAMELOT
      </text>
    </svg>
  );
}

/** Reference tones on their own audio context: a drone and a one-octave scale. */
function useReferenceTones() {
  const context = useRef(null);
  const drone = useRef(null);
  const [droneKey, setDroneKey] = useState(null);
  const ensure = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    context.current ||= new Context();
    void context.current.resume?.();
    return context.current;
  };
  const stopDrone = useCallback(() => {
    const current = drone.current;
    drone.current = null;
    if (current) {
      const { audio, gain, oscillators } = current;
      gain.gain.setTargetAtTime(0, audio.currentTime, 0.08);
      oscillators.forEach((osc) => osc.stop(audio.currentTime + 0.5));
    }
    setDroneKey(null);
  }, []);
  const startDrone = (key) => {
    window.dispatchEvent(new Event('sattari:stop-reference'));
    window.dispatchEvent(new Event('sattari:reference-tone'));
    const audio = ensure();
    const root = tonicFrequency(key, 2);
    if (!audio || !root) return;
    const gain = audio.createGain();
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.09, audio.currentTime, 0.15);
    filter.connect(gain);
    gain.connect(audio.destination);
    // Root, fifth and octave: a neutral reference that fits major and minor.
    const oscillators = [1, 1.5, 2].map((ratio, index) => {
      const osc = audio.createOscillator();
      osc.type = index ? 'sine' : 'triangle';
      osc.frequency.value = root * ratio;
      osc.connect(filter);
      osc.start();
      return osc;
    });
    drone.current = { audio, gain, oscillators };
    setDroneKey(key);
  };
  const playScale = (key) => {
    window.dispatchEvent(new Event('sattari:stop-reference'));
    window.dispatchEvent(new Event('sattari:reference-tone'));
    const audio = ensure();
    const notes = scaleFrequencies(key, 3);
    if (!audio || !notes.length) return;
    const start = audio.currentTime + 0.05;
    notes.forEach((frequency, index) => {
      const when = start + index * 0.32;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.16, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(when);
      osc.stop(when + 0.32);
    });
  };
  useEffect(
    () => () => {
      stopDrone();
      void context.current?.close?.().catch(() => {});
    },
    [stopDrone]
  );
  useEffect(() => {
    const stop = () => {
      stopDrone();
      const current = context.current;
      context.current = null;
      void current?.close?.().catch(() => {});
    };
    window.addEventListener('sattari:stop-reference', stop);
    return () => window.removeEventListener('sattari:stop-reference', stop);
  }, [stopDrone]);
  return { droneKey, startDrone, stopDrone, playScale };
}

/**
 * The selected track as a large readout: key with its circle of fifths,
 * tempo with half/double choices, by-ear checks, tap tempo and notes.
 */
export default function KeyReadout({
  row,
  audition,
  onToggleAudition,
  onSeek,
  onCorrect,
  onSeparate,
  playable,
}) {
  const { result } = row;
  const values = effectiveValues(result, row.user);
  const shown = keyDisplay(values.key);
  const tones = useReferenceTones();
  const tapper = useRef(createTapTempo());
  const [tapped, setTapped] = useState({ count: 0, bpm: null });
  const [notes, setNotes] = useState(row.user?.notes || '');
  const isAuditioning = audition.id === row.id;
  const playing = isAuditioning && audition.playing;
  const detected = result.bpm;
  const choice = row.user?.bpm != null ? row.user.bpmChoice : 'detected';
  const alternative =
    values.keySource === 'detected'
      ? result.alternative
      : result.key && result.key !== values.key
        ? result.key
        : result.alternative;
  const { stopDrone } = tones;

  // A different track resets the tapper, notes field and drone.
  useEffect(() => {
    tapper.current.reset();
    setTapped({ count: 0, bpm: null });
    setNotes(row.user?.notes || '');
    stopDrone();
  }, [row.id, stopDrone]); // eslint-disable-line react-hooks/exhaustive-deps

  const correct = (patch) =>
    onCorrect(
      cleanCorrection({ ...(row.user || {}), ...patch, editedAt: new Date().toISOString() })
    );
  const tap = useCallback(() => {
    const bpm = tapper.current.tap();
    setTapped({ count: tapper.current.count(), bpm });
  }, []);

  // T taps the tempo anywhere on the page except while typing.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 't' && event.key !== 'T') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      tap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tap]);

  const droneOn = (key) => tones.droneKey === key;
  const toggleDrone = (key) => (droneOn(key) ? tones.stopDrone() : tones.startDrone(key));

  return (
    <section className="kb-readout" aria-labelledby="kb-readout-title">
      <header className="kb-readout-head">
        <div>
          <p className="kb-label">Selected track</p>
          <h2 id="kb-readout-title" title={row.file.name}>
            {row.file.name}
          </h2>
          <p className="kb-readout-meta">
            {formatTime(result.duration)}
            {result.rmsDb !== null && ` · ${result.rmsDb} dB RMS`}
            {row.origin?.label && row.origin.label !== row.file.name && ` · ${row.origin.label}`}
          </p>
        </div>
        <button
          type="button"
          className="kb-ghost"
          disabled={!playable}
          onClick={onSeparate}
          title={playable ? 'Continue in Stem Separator' : 'Add the source file to separate it'}
        >
          <Layers size={15} aria-hidden="true" /> Separate this song
        </button>
      </header>

      <div className="kb-readout-grid">
        <div className="kb-panel kb-key-panel">
          <div className="kb-key-main">
            <p className="kb-label">Key</p>
            {shown ? (
              <p className="kb-big" aria-label={values.key}>
                {shown.tonic}
                <small>{shown.mode}</small>
              </p>
            ) : (
              <p className="kb-big is-empty">—</p>
            )}
            <p className="kb-pills">
              {values.camelot && <span className="kb-pill is-accent">{values.camelot}</span>}
              {values.keySource === 'user' ? (
                <span className="kb-pill is-user">yours · detected {result.key || 'none'}</span>
              ) : (
                result.keyEvidence && (
                  <span className={`kb-pill is-${result.keyEvidence}`}>
                    {EVIDENCE[result.keyEvidence] || result.keyEvidence}
                  </span>
                )
              )}
              {values.key && <span className="kb-pill">relative {relativeKey(values.key)}</span>}
            </p>
          </div>
          <CircleOfFifths keyName={values.key} alternative={alternative} />
          <p className="kb-key-foot">
            {alternative ? (
              <>
                Second choice <b>{alternative}</b> ({camelot(alternative)})
                {result.keyEvidence === 'tentative' && values.keySource === 'detected' && (
                  <> · a close call, so compare both by ear</>
                )}
              </>
            ) : (
              'No second choice was close enough to report.'
            )}
          </p>
        </div>

        <div className="kb-panel kb-tempo-panel">
          <p className="kb-label">Tempo</p>
          <p className="kb-big kb-bpm">
            {values.bpm === null ? '—' : formatBpm(values.bpm)}
            <small>BPM</small>
          </p>
          <p className="kb-pills">
            {values.bpmSource !== 'detected' ? (
              <span className="kb-pill is-user">
                {values.bpmSource === 'tap'
                  ? 'tapped'
                  : values.bpmSource === 'manual'
                    ? 'typed'
                    : `${values.bpmSource} time`}{' '}
                · detected {detected ?? 'none'}
              </span>
            ) : (
              detected !== null && (
                <span className={`kb-pill is-${result.tempoEvidence}`}>
                  {EVIDENCE[result.tempoEvidence] || result.tempoEvidence}
                </span>
              )
            )}
          </p>
          {detected !== null && (
            <>
              <p className="kb-label">Which feels right?</p>
              <div className="kb-interp" role="group" aria-label="Tempo feel">
                {[
                  ['half', 'half time'],
                  ['detected', 'as detected'],
                  ['double', 'double time'],
                ].map(([option, label]) => {
                  const bpm = tempoInterpretation(detected, option);
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={choice === option}
                      disabled={bpm === null}
                      onClick={() =>
                        correct(
                          option === 'detected'
                            ? { bpm: null, bpmChoice: null }
                            : { bpm, bpmChoice: option }
                        )
                      }
                    >
                      <b>{bpm === null ? '—' : formatBpm(bpm)}</b>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="kb-readout-grid is-secondary">
        <div className="kb-panel kb-listen-panel">
          <p className="kb-label">Check it by ear</p>
          <div className="kb-listen-bar">
            <button
              type="button"
              className="kb-play"
              disabled={!playable}
              onClick={onToggleAudition}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <Pause size={20} aria-hidden="true" />
              ) : (
                <Play size={20} aria-hidden="true" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max={(isAuditioning && audition.duration) || result.duration || 1}
              step="0.01"
              value={isAuditioning ? audition.time : 0}
              disabled={!isAuditioning}
              aria-label="Position in the original audio"
              aria-valuetext={`${formatTime(isAuditioning ? audition.time : 0)} of ${formatTime(
                (isAuditioning && audition.duration) || result.duration
              )}`}
              onChange={(event) => onSeek(Number(event.target.value))}
            />
            <span className="kb-listen-time">
              {formatTime(isAuditioning ? audition.time : 0)} /{' '}
              {formatTime((isAuditioning && audition.duration) || result.duration)}
            </span>
          </div>
          {!playable && (
            <p className="kb-note">Choose the source file again to listen to this track.</p>
          )}
          {values.key ? (
            <div className="kb-tones" role="group" aria-label="Reference tones">
              <button
                type="button"
                aria-pressed={droneOn(values.key)}
                onClick={() => toggleDrone(values.key)}
              >
                Drone on {shown.tonic}
              </button>
              <button type="button" onClick={() => tones.playScale(values.key)}>
                Play the {shown.tonic} {shown.mode} scale
              </button>
              {alternative && (
                <button
                  type="button"
                  aria-pressed={droneOn(alternative)}
                  onClick={() => toggleDrone(alternative)}
                >
                  Drone on the second choice ({alternative})
                </button>
              )}
            </div>
          ) : null}
          <p className="kb-note">
            Play the song with a drone: the right key sounds settled, a wrong one clashes.
          </p>
        </div>

        <div className="kb-panel kb-tap-panel">
          <button type="button" className="kb-tap-pad" onClick={tap} aria-describedby="kb-tap-help">
            <b>{tapped.bpm ? formatBpm(tapped.bpm) : tapped.count || '—'}</b>
            <span>Tap tempo</span>
          </button>
          <p id="kb-tap-help" className="kb-note" aria-live="polite">
            {tapped.bpm
              ? `${formatBpm(tapped.bpm)} BPM from ${tapped.count} taps`
              : tapped.count
                ? `${tapped.count} tap${tapped.count === 1 ? '' : 's'} · keep going`
                : 'Tap on the beat, or press T.'}
          </p>
          <button
            type="button"
            className="kb-ghost"
            disabled={!tapped.bpm}
            onClick={() => {
              correct({ bpm: tapped.bpm, bpmChoice: 'tap' });
              tapper.current.reset();
              setTapped({ count: 0, bpm: null });
            }}
          >
            Use {tapped.bpm ? `${formatBpm(tapped.bpm)} BPM` : 'the tapped tempo'}
          </button>
        </div>
      </div>

      <form
        className="kb-panel kb-notes"
        onSubmit={(event) => {
          event.preventDefault();
          correct({ notes });
        }}
      >
        <label>
          <span className="kb-label">Your notes</span>
          <input
            value={notes}
            maxLength={NOTES_MAX}
            placeholder="Swung feel, count in 2"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <button type="submit" className="kb-ghost" disabled={notes === (row.user?.notes || '')}>
          Save note
        </button>
        <p className="kb-note">
          Notes, like your key and tempo choices, are saved with the result and included in reports
          and the CSV. Detected values are always kept beside yours.
        </p>
      </form>
    </section>
  );
}
