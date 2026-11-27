import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Layers, Pause, Play } from 'lucide-react';
import { bpmPage, keyPageFor } from '../../data/musicReference';
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
import { useMetronome } from './metronome';
import {
  CIRCLE,
  circlePosition,
  compatibleKeys,
  diatonicChords,
  keyDisplay,
  keyLabel,
  relativeKey,
  scaleNotes,
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
          ? `Circle of fifths: ${keyLabel(keyName)}${alternative ? `, alternative ${keyLabel(alternative)}` : ''}`
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

/** Reference tones own their audio output until stopped or the scale ends. */
function useReferenceTones() {
  const current = useRef(null);
  const [droneKey, setDroneKey] = useState(null);
  const [error, setError] = useState('');
  const stop = useCallback(() => {
    const session = current.current;
    current.current = null;
    setDroneKey(null);
    setError('');
    if (!session) return;
    clearInterval(session.watch);
    clearTimeout(session.release);
    for (const osc of session.oscillators) {
      osc.onended = null;
      try {
        osc.stop();
      } catch {
        // An oscillator can already have finished or failed before its start.
      }
    }
    if (session.audio && session.audio.state !== 'closed') {
      void session.audio.close().catch(() => {});
    }
  }, []);

  useEffect(() => {
    window.addEventListener('sattari:stop-reference', stop);
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('sattari:stop-reference', stop);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  const play = async (key, isScale) => {
    window.dispatchEvent(new Event('sattari:stop-reference'));
    window.dispatchEvent(new Event('sattari:reference-tone'));
    const session = { audio: null, oscillators: [], key: isScale ? null : key };
    current.current = session;
    const fail = () => {
      if (current.current !== session) return;
      stop();
      setError('Reference audio could not play. Check your audio output and tap the tone again.');
    };
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      const audio = new Context();
      session.audio = audio;
      let clock = audio.currentTime;
      let lastProgress = performance.now();
      let sounding = false;
      let scheduled = false;
      session.watch = setInterval(() => {
        if (current.current !== session) return;
        if (scheduled && audio.state === 'running' && audio.currentTime > clock) {
          clock = audio.currentTime;
          lastProgress = performance.now();
          if (!isScale && !sounding) {
            sounding = true;
            setDroneKey(key);
          }
        } else if (performance.now() - lastProgress >= 4000) {
          fail();
        }
      }, 125);
      if (audio.state !== 'running') await audio.resume();
      if (current.current !== session) return;
      if (isScale) {
        const notes = scaleFrequencies(key, 3);
        const start = audio.currentTime + 0.05;
        notes.forEach((frequency, index) => {
          const when = start + index * 0.32;
          const osc = audio.createOscillator();
          session.oscillators.push(osc);
          const gain = audio.createGain();
          osc.type = 'triangle';
          osc.frequency.value = frequency;
          gain.gain.setValueAtTime(0.0001, when);
          gain.gain.exponentialRampToValueAtTime(0.16, when + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
          osc.connect(gain);
          gain.connect(audio.destination);
          if (index === notes.length - 1) {
            osc.onended = () => {
              if (current.current === session) stop();
            };
          }
          osc.start(when);
          osc.stop(when + 0.32);
        });
      } else {
        const root = tonicFrequency(key, 2);
        const gain = audio.createGain();
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        gain.gain.value = 0;
        gain.gain.setTargetAtTime(0.09, audio.currentTime, 0.15);
        session.gain = gain;
        filter.connect(gain);
        gain.connect(audio.destination);
        // Root, fifth and octave fit either major or minor.
        [1, 1.5, 2].forEach((ratio, index) => {
          const osc = audio.createOscillator();
          session.oscillators.push(osc);
          osc.type = index ? 'sine' : 'triangle';
          osc.frequency.value = root * ratio;
          osc.connect(filter);
          osc.start();
        });
      }
      scheduled = true;
    } catch {
      fail();
    }
  };
  return {
    droneKey,
    error,
    toggleDrone(key) {
      const session = current.current;
      if (session?.key !== key || session.release) return play(key, false);
      if (!session.gain || !droneKey) return stop();
      // Release a sounding drone gently. Switching tracks or leaving still closes it at once.
      const at = session.audio.currentTime;
      session.gain.gain.setTargetAtTime(0, at, 0.015);
      setDroneKey(null);
      session.release = setTimeout(stop, 80);
    },
    stopDrone: stop,
    playScale: (key) => play(key, true),
  };
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
  onClickChange,
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
  const alternative = [result.key, result.alternative].find(
    (key) => key && camelot(key) !== values.camelot
  );
  const { stopDrone } = tones;
  const click = useMetronome(values.bpm);
  const stopClick = click.stop;
  // The meter at the top of the page pulses while the click runs.
  useEffect(() => {
    onClickChange?.(click.on);
    return () => onClickChange?.(false);
  }, [click.on, onClickChange]);
  const [copied, setCopied] = useState(false);
  const summary = [
    values.key && keyLabel(values.key),
    values.camelot,
    values.bpm !== null && `${formatBpm(values.bpm)} BPM`,
  ]
    .filter(Boolean)
    .join(' · ');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const notesInKey = scaleNotes(values.key);
  const chords = diatonicChords(values.key);
  const mixes = compatibleKeys(values.key);

  // A different track resets the tapper, notes field and drone.
  useEffect(() => {
    tapper.current.reset();
    setTapped({ count: 0, bpm: null });
    setNotes(row.user?.notes || '');
    stopDrone();
    stopClick();
    setCopied(false);
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
  const { toggleDrone } = tones;

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
        <div className="kb-readout-actions">
          <button type="button" className="kb-ghost" disabled={!summary} onClick={copy}>
            {copied ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Copy size={15} aria-hidden="true" />
            )}{' '}
            <span aria-live="polite">{copied ? 'Copied' : 'Copy result'}</span>
          </button>
          <button
            type="button"
            className="kb-ghost"
            disabled={!playable}
            onClick={onSeparate}
            title={playable ? 'Continue in Stem Separator' : 'Add the source file to separate it'}
          >
            <Layers size={15} aria-hidden="true" /> Separate this song
          </button>
        </div>
      </header>

      <div className="kb-readout-grid">
        <div className="kb-panel kb-key-panel">
          <div className="kb-key-main">
            <p className="kb-label">Key</p>
            {shown ? (
              <p className="kb-big" aria-label={keyLabel(values.key)}>
                {shown.tonic}
                <small>{shown.mode}</small>
              </p>
            ) : (
              <p className="kb-big is-empty">—</p>
            )}
            <p className="kb-pills">
              {values.camelot && <span className="kb-pill is-accent">{values.camelot}</span>}
              {values.keySource === 'user' ? (
                <span className="kb-pill is-user">
                  yours · detected {result.key ? keyLabel(result.key) : 'none'}
                </span>
              ) : (
                result.keyEvidence && (
                  <span className={`kb-pill is-${result.keyEvidence}`}>
                    {EVIDENCE[result.keyEvidence] || result.keyEvidence}
                  </span>
                )
              )}
              {values.key && (
                <span className="kb-pill">relative {keyLabel(relativeKey(values.key))}</span>
              )}
            </p>
          </div>
          <CircleOfFifths keyName={values.key} alternative={alternative} />
          <p className="kb-key-foot">
            {alternative ? (
              <>
                Second choice <b>{keyLabel(alternative)}</b> ({camelot(alternative)})
                {result.keyEvidence === 'tentative' && values.keySource === 'detected' && (
                  <> · a close call, so compare both by ear</>
                )}
              </>
            ) : (
              'No second choice was close enough to report.'
            )}
          </p>
          {chords.length > 0 && (
            <div className="kb-inkey">
              <div>
                <p className="kb-label">Notes in this key</p>
                <p className="kb-inkey-notes">{notesInKey.join('  ')}</p>
              </div>
              <div>
                <p className="kb-label">Chords in this key</p>
                <ul aria-label={`Chords in ${keyLabel(values.key)}`}>
                  {chords.map(({ numeral, name }) => (
                    <li key={numeral} className="kb-chord">
                      {name}
                      <small>{numeral}</small>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="kb-label">Mixes well with</p>
                <ul aria-label="Compatible keys">
                  {mixes.map(({ key, relation }) => (
                    <li key={relation} className="kb-pill">
                      <Link to={keyPageFor(key).path}>
                        {keyLabel(key)} · {camelot(key)}
                      </Link>{' '}
                      <small>({relation})</small>
                    </li>
                  ))}
                </ul>
              </div>
              <Link className="kb-more" to={keyPageFor(values.key).path}>
                More about {keyLabel(values.key)}
              </Link>
            </div>
          )}
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
          {values.bpm !== null && (
            <div className="kb-tones kb-click">
              <button type="button" aria-pressed={click.on} onClick={click.toggle}>
                {click.on ? 'Stop the click' : `Click at ${formatBpm(values.bpm)} BPM`}
              </button>
              <p className="kb-note">
                Play the song and tap along with the click. If it lands on every other beat, try
                half or double time. The click is not lined up with the song&apos;s first beat.
              </p>
              {bpmPage(values.bpm) && (
                <Link className="kb-more" to={bpmPage(values.bpm).path}>
                  Delay times and more at {formatBpm(values.bpm)} BPM
                </Link>
              )}
            </div>
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
                  Drone on the second choice ({keyLabel(alternative)})
                </button>
              )}
            </div>
          ) : null}
          {tones.error && (
            <p className="kb-note" role="alert">
              {tones.error}
            </p>
          )}
          <p className="kb-note">
            Listen for the note that feels like home at phrase endings. Compare the suggested tonics
            against the recording.
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
