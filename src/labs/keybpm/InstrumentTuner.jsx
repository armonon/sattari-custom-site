import { Mic, Play, Square, Volume2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keyParts } from './keyBpm';
import { musicalAccidentals, SCALE_TONICS } from '../../utils/noteSpelling';
import {
  INSTRUMENTS,
  SCALES,
  noteLabel,
  noteFrequency,
  centsFrom,
  spelledScale,
} from './instrumentTheory';
import useInstrumentTuner from './useInstrumentTuner';
import useTunerReference from './useTunerReference';
import './instrumentTuner.css';

export default function InstrumentTuner({ songKey, onBeforeListen = () => {} }) {
  const tuner = useInstrumentTuner();
  const [instrument, setInstrument] = useState('guitar');
  const [target, setTarget] = useState(0);
  const [reference, setReference] = useState(440);
  const [root, setRoot] = useState('C');
  const [scale, setScale] = useState('major');
  const [octave, setOctave] = useState(3);
  const profile = INSTRUMENTS[instrument];
  const targetMidi = profile.notes[target];
  const {
    referenceOn,
    startingAudio,
    playReference,
    toggleReference,
    play,
    stopTones,
    sounding,
    toneError,
  } = useTunerReference(targetMidi, reference, onBeforeListen);
  const nearest = tuner.pitch
    ? Math.round(69 + 12 * Math.log2(tuner.pitch.frequency / reference))
    : null;
  const comparison = targetMidi ?? nearest;
  const cents =
    tuner.pitch && comparison != null
      ? centsFrom(tuner.pitch.frequency, comparison, reference)
      : null;
  const scalePitches = spelledScale(root, scale, octave);
  const rootOptions = SCALE_TONICS.includes(root) ? SCALE_TONICS : [...SCALE_TONICS, root];
  const detected = keyParts(songKey);
  const listening = tuner.status === 'listening';
  const requesting = tuner.status === 'requesting';
  const displayMidi = listening ? nearest : targetMidi;
  const displayFrequency = listening
    ? tuner.pitch?.frequency
    : targetMidi != null
      ? noteFrequency(targetMidi, reference)
      : null;
  const offset = cents == null ? null : Math.round(cents);
  const micLabel = listening
    ? 'Stop microphone'
    : requesting
      ? 'Cancel microphone request'
      : 'Start live tuner';
  const inTune = cents != null && Math.abs(cents) <= 5;
  const checkString = targetMidi != null && nearest != null && Math.abs(nearest - targetMidi) >= 3;
  return (
    <section className="instrument-lab" id="live-tuner" aria-labelledby="live-tuner-heading">
      <header className="instrument-lab-heading">
        <h2 id="live-tuner-heading">Live instrument tuner</h2>
        <p>Tap a string to hear it, or start the microphone to measure the note you play.</p>
      </header>
      <div className="instrument-console">
        <div className="instrument-setup">
          <div className="instrument-controls instrument-preset">
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
          {targetMidi != null ? (
            <>
              <div role="group" aria-label="Choose a string">
                <p className="instrument-field-label">Open strings</p>
                <div className="instrument-strings">
                  {profile.notes.map((midi, i) => (
                    <button
                      type="button"
                      key={`${instrument}-${i}`}
                      aria-pressed={target === i}
                      onClick={() => {
                        setTarget(i);
                        if (!listening && !requesting) playReference(midi);
                      }}
                    >
                      <strong>
                        {noteLabel(midi)}
                        {(instrument === 'guitar' || instrument === 'drop-d') &&
                          (midi === 40 || midi === 64) && (
                            <span className="instrument-string-name">
                              {' '}
                              {midi === 40 ? 'Low E' : 'High E'}
                            </span>
                          )}
                      </strong>
                      <small>{noteFrequency(midi, reference).toFixed(1)} Hz</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="instrument-reference">
                <button
                  type="button"
                  className="instrument-hear"
                  data-playing={referenceOn}
                  onClick={toggleReference}
                >
                  {referenceOn ? (
                    <Square fill="currentColor" size={15} aria-hidden="true" />
                  ) : (
                    <Volume2 size={19} aria-hidden="true" />
                  )}
                  {referenceOn ? 'Stop reference sound' : `Hear ${noteLabel(targetMidi)}`}
                </button>
                <p>
                  {referenceOn
                    ? 'Choose another string to change the pitch.'
                    : listening || requesting
                      ? 'Choose a string to set the microphone target.'
                      : 'The reference tone plays until you stop it.'}
                </p>
              </div>
            </>
          ) : (
            <p className="instrument-chromatic">
              Chromatic mode follows the nearest note. Start the microphone and play one note at a
              time.
            </p>
          )}
        </div>
        <div className="instrument-readout" data-in-tune={inTune}>
          <div className="instrument-screen-top">
            <span>{targetMidi != null ? `TARGET ${noteLabel(targetMidi)}` : 'CHROMATIC'}</span>
            <span
              className="instrument-signal"
              data-active={referenceOn || listening}
              role="status"
            >
              <i aria-hidden="true" />
              {startingAudio && referenceOn
                ? 'Starting reference'
                : referenceOn
                  ? 'Reference playing'
                  : listening
                    ? 'Microphone on'
                    : requesting
                      ? 'Opening microphone'
                      : 'Microphone off'}
            </span>
          </div>
          <div className="instrument-pitch">
            <span className="instrument-screen-label">
              {listening || targetMidi == null ? 'Detected pitch' : 'Reference pitch'}
            </span>
            <div>
              <strong>{displayMidi != null ? noteLabel(displayMidi) : '—'}</strong>
              {displayFrequency != null && (
                <span>
                  {displayFrequency.toFixed(1)} <small>Hz</small>
                </span>
              )}
            </div>
          </div>
          <div className="instrument-gauge">
            <div className="instrument-gauge-caption" aria-hidden="true">
              <span>Flat</span>
              <span>Cents</span>
              <span>Sharp</span>
            </div>
            <div
              className="instrument-meter"
              role="meter"
              aria-label="Tuning offset in cents"
              aria-valuemin={-50}
              aria-valuemax={50}
              aria-valuenow={offset == null ? 0 : Math.max(-50, Math.min(50, offset))}
              aria-valuetext={
                offset == null
                  ? 'No pitch detected'
                  : `${offset} cents from ${noteLabel(comparison)}`
              }
            >
              <span className="instrument-sweet-spot" aria-hidden="true" />
              {offset != null && (
                <i
                  className="instrument-needle"
                  aria-hidden="true"
                  style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }}
                />
              )}
            </div>
            <div className="instrument-gauge-labels" aria-hidden="true">
              <span>−50</span>
              <span>−25</span>
              <span>0</span>
              <span>+25</span>
              <span>+50</span>
            </div>
          </div>
          <p className="instrument-feedback">
            {offset == null ? (
              listening ? (
                'Play one sustained note.'
              ) : referenceOn ? (
                'Match your string to the reference tone.'
              ) : (
                'Start the microphone to measure pitch.'
              )
            ) : (
              <>
                <strong>
                  {checkString
                    ? `Heard ${noteLabel(nearest)}. Check the string and octave for ${noteLabel(targetMidi)}.`
                    : inTune
                      ? 'In tune'
                      : cents < 0
                        ? 'Flat · raise the pitch'
                        : 'Sharp · lower the pitch'}
                </strong>{' '}
                · {offset > 0 ? '+' : ''}
                {offset} cents
              </>
            )}
          </p>
          <button
            type="button"
            className="instrument-mic"
            onClick={() => {
              if (listening || requesting) tuner.stop();
              else {
                onBeforeListen();
                window.dispatchEvent(new Event('sattari:stop-reference'));
                void tuner.start();
              }
            }}
          >
            {listening || requesting ? (
              <Square size={14} fill="currentColor" aria-hidden="true" />
            ) : (
              <Mic size={16} aria-hidden="true" />
            )}
            {micLabel}
          </button>
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
        Microphone audio stays on this device. For a steadier reading, pluck or bow one string at a
        time in a quiet room.
      </p>
      <div className="instrument-scales" id="scales">
        <h2>Scales to play and hear</h2>
        <p>Choose a root and scale, then play the sequence or tap a single note.</p>
        {detected && (
          <button
            className="instrument-song-key"
            type="button"
            onClick={() => {
              setRoot(detected.tonic);
              setScale(detected.minor ? 'minor' : 'major');
            }}
          >
            Use song key: {songKey}
          </button>
        )}
        <div className="instrument-controls instrument-scale-controls">
          <label>
            Scale root
            <select value={root} onChange={(e) => setRoot(e.target.value)}>
              {rootOptions.map((name) => (
                <option key={name} value={name}>
                  {musicalAccidentals(name)}
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
        <div className="instrument-scale-notes" role="group" aria-label="Scale notes">
          {scalePitches.map(({ midi, label }, i) => (
            <button type="button" key={midi} onClick={() => void play([midi])}>
              <strong>{label}</strong>
              <small>Note {i + 1}</small>
            </button>
          ))}
        </div>
        <div className="instrument-actions">
          <button
            type="button"
            className="alab-button"
            onClick={() =>
              sounding === 'scale' ? stopTones() : void play(scalePitches.map((note) => note.midi))
            }
          >
            {sounding === 'scale' ? (
              <>
                <Square size={13} fill="currentColor" aria-hidden="true" />
                Stop scale
              </>
            ) : (
              <>
                <Play size={15} aria-hidden="true" />
                Play {musicalAccidentals(root)} {SCALES[scale].name.toLowerCase()} scale
              </>
            )}
          </button>
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
