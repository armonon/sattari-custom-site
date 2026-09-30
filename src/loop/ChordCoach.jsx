import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Guitar, Mic, RotateCcw } from 'lucide-react';
import { ChordDiagram, Fretboard } from './Guides';
import { noteName } from './music';
import { useGuitarProfile } from './GuitarSetup';
import { openStrings, profileChord } from './guitarProfile';
import { emptyPitchGate, gradePitch } from './practiceGate';
import useMicrophone from './useMicrophone';
import MicrophoneSetup from './MicrophoneSetup';
import { lessonFingerprint } from './progress';
import StrumCheck from './StrumCheck';

function readProgress(key, fingerprint, field = 'matched') {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved?.fingerprint === fingerprint &&
      (field !== 'strums' || saved.strumVersion === 1) &&
      Array.isArray(saved[field])
      ? saved[field]
      : [];
  } catch {
    return [];
  }
}

export default function ChordCoach({ lesson, onExit, onComplete }) {
  const { profile } = useGuitarProfile();
  const tuning = openStrings(profile);
  const chords = [...new Set(lesson.chords.map((c) => c.name))].filter((name) =>
    profileChord(name, profile)
  );
  const [chordIndex, setChordIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [stage, setStage] = useState('setup');
  const [manual, setManual] = useState(false);
  const [justHit, setJustHit] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const fingerprint = lessonFingerprint({ ...lesson, guitarProfile: profile });
  const storageKey = `loop-chord-progress-v1:${lesson.id}`;
  const [matched, setMatched] = useState(() => readProgress(storageKey, fingerprint));
  const [strums, setStrums] = useState(() => readProgress(storageKey, fingerprint, 'strums'));
  const mic = useMicrophone();
  const stop = mic.stop;
  const gate = useRef(emptyPitchGate());
  const heading = useRef(null);
  const name = chords[chordIndex];
  const shape = profileChord(name, profile);
  const notes =
    shape?.frets.flatMap((fret, string) =>
      fret < 0 ? [] : [{ midi: tuning[string] + fret, fret, string }]
    ) || [];
  const target = notes[position];
  const id = `${name}:${target?.string}`;
  const next = () => {
    gate.current = emptyPitchGate();
    if (position + 1 < notes.length) setPosition(position + 1);
    else {
      stop();
      setStage('done');
    }
  };
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [stage, chordIndex]);
  useEffect(() => {
    if (stage !== 'play' || manual || justHit || mic.status !== 'listening' || !target) return;
    const result = gradePitch(gate.current, mic.pitch, target.midi, performance.now());
    gate.current = result.gate;
    if (result.hit) {
      setMatched((previous) => (previous.includes(id) ? previous : [...previous, id]));
      setJustHit(true);
    }
  }, [stage, manual, justHit, mic.status, mic.pitch, target, id]);
  useEffect(() => {
    if (!justHit) return;
    const timeout = setTimeout(() => {
      setJustHit(false);
      // Keep the gate armed across targets: a held note must not score twice.
      if (position + 1 < notes.length) setPosition(position + 1);
      else {
        stop();
        setStage('done');
      }
    }, 450);
    return () => clearTimeout(timeout);
  }, [justHit, position, notes.length, stop]);
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ fingerprint, matched, strums, strumVersion: 1 })
      );
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [matched, strums, fingerprint, storageKey]);
  const exit = () => {
    stop();
    onExit();
  };
  const begin = (withoutMic) => {
    if (withoutMic) stop();
    setManual(withoutMic);
    gate.current = emptyPitchGate();
    setStage('play');
  };
  const count = notes.filter((n) => matched.includes(`${name}:${n.string}`)).length;
  if (!chords.length)
    return (
      <div className="lc-panel">
        <h1>Choose another guitar setup</h1>
        <p>
          No playable chord shapes are available for this passage in your current tuning and capo
          position.
        </p>
        <button type="button" className="loop-button loop-button-secondary" onClick={exit}>
          Back to song
        </button>
      </div>
    );
  return (
    <div className="lf-session lf-chord-coach">
      <header className="lf-header">
        <button type="button" className="lj-text-link" onClick={exit}>
          <ArrowLeft size={16} /> Back to song
        </button>
        <div className="lf-header-song">
          <strong>{lesson.title}</strong>
          <span>CHORD WORKSHOP</span>
        </div>
        <span>
          {chordIndex + 1} / {chords.length} shapes
        </span>
      </header>
      <section className="lf-chord-workshop">
        <span className="lj-eyebrow">HOLD THE SHAPE · CHECK EACH STRING</span>
        <h1 ref={heading} tabIndex={-1}>
          {stage === 'done' ? 'Getting to know' : 'Build your'} <em>{name}.</em>
        </h1>
        <p>
          Keep the chord shape down. Pluck one string at a time and briefly mute it before the next.
          Then bring the notes together with a whole chord check.
        </p>
        <div className="lf-chord-workshop-grid">
          <section className="lf-chord-shape">
            <ChordDiagram name={name} />
            <strong>{shape?.fullName}</strong>
            <small>○ open · × skip · numbers are fingers</small>
          </section>
          <section className="lf-chord-coach-card">
            {stage === 'setup' ? (
              <>
                <h2>Let’s hear your strings.</h2>
                <MicrophoneSetup mic={mic} onReady={() => begin(false)} />
                <button type="button" className="lj-text-link" onClick={() => begin(true)}>
                  Explore without a microphone <ArrowRight size={15} />
                </button>
              </>
            ) : stage === 'done' ? (
              <>
                {count === notes.length ? <Check size={38} /> : <Guitar size={38} />}
                <h2>
                  {count} of {notes.length} strings matched.
                </h2>
                <p>
                  Listen for ringing notes and buzzing strings. Self-guided steps do not count as
                  microphone matches.
                </p>
                <StrumCheck
                  key={name}
                  mic={mic}
                  notes={notes}
                  matched={strums.includes(name)}
                  onMatch={() =>
                    setStrums((previous) =>
                      previous.includes(name) ? previous : [...previous, name]
                    )
                  }
                />
                <button
                  type="button"
                  className="loop-button loop-button-purple"
                  onClick={() => {
                    if (chordIndex + 1 === chords.length) {
                      if (onComplete) onComplete();
                      else exit();
                    } else {
                      setChordIndex(chordIndex + 1);
                      setPosition(0);
                      setStage('setup');
                    }
                  }}
                >
                  {chordIndex + 1 === chords.length ? 'Back to the song' : 'Next chord'}{' '}
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="lj-text-link"
                  onClick={() => {
                    setPosition(0);
                    setStage('setup');
                  }}
                >
                  <RotateCcw size={15} /> Try this shape again
                </button>
              </>
            ) : (
              <>
                <div className="lf-chord-strings" aria-label="Chord strings">
                  {notes.map((n, i) => (
                    <span key={n.string} className={i === position ? 'is-current' : ''}>
                      {matched.includes(`${name}:${n.string}`) ? (
                        <Check size={14} />
                      ) : (
                        noteName(openStrings(profile)[n.string]).replace(/\d/g, '')
                      )}
                    </span>
                  ))}
                </div>
                <h2>
                  Pluck string {6 - target.string} ·{' '}
                  {noteName(openStrings(profile)[target.string]).replace(/\d/g, '')}
                </h2>
                <p>
                  {target.fret === 0 ? 'Leave it open' : `Hold fret ${target.fret}`} · Aim for{' '}
                  <strong>{noteName(target.midi)}</strong>
                </p>
                <Fretboard note={target} />
                <div className={`lf-feedback${justHit ? ' is-correct' : ''}`} role="status">
                  <Guitar size={22} />
                  <strong>
                    {justHit
                      ? 'Clear and in tune. You got it!'
                      : manual
                        ? 'Take your time with this string.'
                        : mic.status !== 'listening'
                          ? 'Your microphone is paused.'
                          : mic.pitch
                            ? `Hearing ${noteName(mic.pitch.midi)}${mic.pitch.midi === target.midi ? ` · ${Math.round(mic.pitch.cents)} cents` : ` · aim for ${noteName(target.midi)}`}`
                            : 'Pluck the highlighted string.'}
                  </strong>
                </div>
                {manual ? (
                  <button type="button" className="loop-button loop-button-purple" onClick={next}>
                    {position + 1 === notes.length ? 'Finish shape' : 'Next string'}{' '}
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="lj-text-link"
                    onClick={() => {
                      gate.current = emptyPitchGate();
                      if (mic.status === 'off') setStage('setup');
                      else stop();
                    }}
                  >
                    <Mic size={16} />
                    {mic.status === 'off' ? 'Reconnect microphone' : 'Pause microphone'}
                  </button>
                )}
                {mic.error && (
                  <>
                    <p role="alert" className="loop-error">
                      {mic.error}
                    </p>
                    <button type="button" className="lj-text-link" onClick={() => begin(true)}>
                      Continue without microphone feedback
                    </button>
                  </>
                )}
              </>
            )}
          </section>
        </div>
        {saveError && <p role="status">Your string checks are saved for this visit only.</p>}
        <p className="lf-setup-footnote">
          Pitch checks cannot identify your finger or string. Follow the diagram and use your ears
          alongside the feedback.
        </p>
      </section>
    </div>
  );
}
