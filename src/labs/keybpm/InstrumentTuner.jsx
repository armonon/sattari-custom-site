import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { keyParts } from './keyBpm';
import {
  INSTRUMENTS,
  SCALES,
  PITCH_NAMES,
  noteLabel,
  noteFrequency,
  centsFrom,
  scaleNotes,
} from './instrumentTheory';
import useInstrumentTuner from './useInstrumentTuner';
import './instrumentTuner.css';

export default function InstrumentTuner({ songKey, onBeforeListen = () => {} }) {
  const tuner = useInstrumentTuner();
  const [instrument, setInstrument] = useState('guitar');
  const [target, setTarget] = useState(0);
  const [reference, setReference] = useState(440);
  const [root, setRoot] = useState(0);
  const [scale, setScale] = useState('major');
  const [octave, setOctave] = useState(3);
  const [toneError, setToneError] = useState('');
  // 'note' or 'scale' while a reference is sounding, so Stop shows only then.
  const [sounding, setSounding] = useState('');
  const tones = useRef(null);
  const toneGeneration = useRef(0);
  const stopTones = () => {
    toneGeneration.current++;
    const context = tones.current;
    tones.current = null;
    setSounding('');
    void context?.close().catch(() => {});
  };
  useEffect(() => {
    const stop = () => stopTones();
    const visibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('sattari:stop-reference', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('sattari:stop-reference', stop);
      document.removeEventListener('visibilitychange', visibility);
      stop();
    };
  }, []);
  const play = async (notes) => {
    tuner.stop();
    onBeforeListen();
    window.dispatchEvent(new Event('sattari:stop-reference'));
    window.dispatchEvent(new Event('sattari:reference-tone'));
    setToneError('');
    const token = toneGeneration.current;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context)
        throw new Error(
          'Reference audio is unavailable in this browser. The note names remain available.'
        );
      const context = new Context();
      tones.current = context;
      await context.resume();
      if (token !== toneGeneration.current) return;
      setSounding(notes.length > 1 ? 'scale' : 'note');
      notes.forEach((midi, i) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const when = context.currentTime + 0.03 + i * 0.42;
        oscillator.type = 'sine';
        oscillator.frequency.value = noteFrequency(midi, reference);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(0.12, when + 0.025);
        gain.gain.linearRampToValueAtTime(0, when + 0.38);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(when);
        oscillator.stop(when + 0.4);
        if (i === notes.length - 1)
          oscillator.onended = () => {
            if (tones.current === context) stopTones();
          };
      });
    } catch (cause) {
      stopTones();
      setToneError(cause.message || 'Reference audio could not start.');
    }
  };
  const profile = INSTRUMENTS[instrument];
  const targetMidi = profile.notes[target];
  const nearest = tuner.pitch
    ? Math.round(69 + 12 * Math.log2(tuner.pitch.frequency / reference))
    : null;
  const comparison = targetMidi ?? nearest;
  const cents =
    tuner.pitch && comparison != null
      ? centsFrom(tuner.pitch.frequency, comparison, reference)
      : null;
  const scaleMidi = scaleNotes(root, scale, octave);
  const detected = keyParts(songKey);
  return (
    <section className="instrument-lab" id="live-tuner" aria-labelledby="live-tuner-heading">
      <div className="instrument-lab-heading">
        <div>
          <p className="alab-eyebrow">PLAY ONE NOTE AT A TIME</p>
          <h2 id="live-tuner-heading">Live instrument tuner</h2>
        </div>
        <span className="alab-alpha">Beta</span>
      </div>
      <p>
        Tune a guitar, bass, violin, viola, cello or ukulele with your microphone. Choose an open
        string, pluck or bow it alone, and bring the meter toward the center. Chromatic mode follows
        any single note.
      </p>
      <div className="instrument-controls">
        <label>
          Instrument
          <select
            value={instrument}
            onChange={(e) => {
              setInstrument(e.target.value);
              setTarget(0);
            }}
          >
            {Object.entries(INSTRUMENTS).map(([id, item]) => (
              <option key={id} value={id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Concert A
          <select value={reference} onChange={(e) => setReference(Number(e.target.value))}>
            {[432, 440, 441, 442, 443].map((hz) => (
              <option key={hz} value={hz}>
                {hz} Hz
              </option>
            ))}
          </select>
        </label>
      </div>
      {profile.notes.length > 0 && (
        <div className="instrument-strings" role="group" aria-label="Choose a string">
          {profile.notes.map((midi, i) => (
            <button
              className="alab-text-button"
              type="button"
              key={`${instrument}-${i}`}
              aria-pressed={target === i}
              onClick={() => setTarget(i)}
            >
              {noteLabel(midi)}
              <small>{noteFrequency(midi, reference).toFixed(1)} Hz</small>
            </button>
          ))}
        </div>
      )}
      <div className="instrument-readout">
        <span>
          {tuner.status === 'listening' ? 'MICROPHONE ON' : 'MICROPHONE OFF'}
          {targetMidi != null ? ` · TARGET ${noteLabel(targetMidi)}` : ' · CHROMATIC'}
        </span>
        <strong>{nearest != null ? noteLabel(nearest) : '—'}</strong>
        <p>
          {cents == null
            ? 'Start the tuner, then play a sustained single note.'
            : `${Math.abs(cents) <= 5 ? 'In tune' : cents < 0 ? 'Flat · raise the pitch gently' : 'Sharp · lower the pitch gently'} · ${cents > 0 ? '+' : ''}${Math.round(cents)} cents · ${tuner.pitch.frequency.toFixed(1)} Hz`}
        </p>
        <div
          className="instrument-meter"
          role="meter"
          aria-label="Tuning offset in cents"
          aria-valuemin={-50}
          aria-valuemax={50}
          aria-valuenow={cents == null ? 0 : Math.max(-50, Math.min(50, Math.round(cents)))}
          aria-valuetext={
            cents == null
              ? 'No pitch detected'
              : `${Math.round(cents)} cents from ${noteLabel(comparison)}`
          }
        >
          <span>♭</span>
          <i
            style={{ left: `${50 + (cents == null ? 0 : Math.max(-50, Math.min(50, cents)))}%` }}
          />
          <b />
          <span>♯</span>
        </div>
        <div className="instrument-actions">
          <button
            type="button"
            className="alab-button"
            onClick={() => {
              if (tuner.status === 'listening' || tuner.status === 'requesting') tuner.stop();
              else {
                onBeforeListen();
                window.dispatchEvent(new Event('sattari:stop-reference'));
                void tuner.start();
              }
            }}
          >
            {tuner.status === 'listening'
              ? 'Stop microphone'
              : tuner.status === 'requesting'
                ? 'Cancel microphone request'
                : 'Start live tuner'}
          </button>
          {targetMidi != null && (
            <button
              type="button"
              className="alab-text-button"
              onClick={() => void play([targetMidi])}
            >
              Hear {noteLabel(targetMidi)}
            </button>
          )}
          {sounding === 'note' && (
            <button type="button" className="alab-text-button" onClick={stopTones}>
              Stop reference sound
            </button>
          )}
        </div>
      </div>
      {tuner.error && (
        <p role="alert" className="alab-error">
          {tuner.error}
        </p>
      )}
      {toneError && (
        <p role="alert" className="alab-error">
          {toneError}
        </p>
      )}
      <p className="instrument-note">
        Microphone access starts only when you ask. Live tuner audio is not recorded, saved or
        uploaded. Stop other music while tuning. Low bass notes and noisy rooms can be harder for
        phone microphones; check octave and string choice. A centered meter checks pitch, not the
        condition of your instrument.
      </p>
      <div className="instrument-scales" id="scales">
        <h2>Scales to play and hear</h2>
        <p>
          Choose a root and scale, then hear a reference or practice each note on your instrument.
          Note labels use sharps; equivalent flat names describe the same pitches.
        </p>
        {detected && (
          <button
            className="alab-text-button"
            type="button"
            onClick={() => {
              setRoot(detected.root);
              setScale(detected.minor ? 'minor' : 'major');
            }}
          >
            Use song key: {songKey}
          </button>
        )}
        <div className="instrument-controls">
          <label>
            Scale root
            <select value={root} onChange={(e) => setRoot(Number(e.target.value))}>
              {PITCH_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scale type
            <select value={scale} onChange={(e) => setScale(e.target.value)}>
              {Object.entries(SCALES).map(([id, item]) => (
                <option key={id} value={id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Starting octave
            <select value={octave} onChange={(e) => setOctave(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="instrument-scale-notes" aria-label="Scale notes">
          {scaleMidi.map((midi, i) => (
            <button
              className="alab-text-button"
              type="button"
              key={i}
              onClick={() => void play([midi])}
            >
              {noteLabel(midi)}
              <small>Note {i + 1}</small>
            </button>
          ))}
        </div>
        <div className="instrument-actions">
          <button type="button" className="alab-button" onClick={() => void play(scaleMidi)}>
            Play {PITCH_NAMES[root]} {SCALES[scale].name.toLowerCase()} scale
          </button>
          {sounding === 'scale' && (
            <button type="button" className="alab-text-button" onClick={stopTones}>
              Stop scale
            </button>
          )}
        </div>
      </div>
      <aside className="instrument-service">
        <h3>Fresh strings, then tune up</h3>
        <p>
          A broken string, repeated slipping or buzzing may need attention beyond tuning. Our
          Woodland Hills shop takes string replacement and setup inquiries by appointment.
        </p>
        <div>
          <Link to="/services/guitar-restringing-woodland-hills">Guitar restringing</Link>
          <Link to="/services/violin-restringing-woodland-hills">Violin restringing</Link>
          <Link to="/services/string-replacement-woodland-hills">Broken-string help</Link>
        </div>
      </aside>
    </section>
  );
}
