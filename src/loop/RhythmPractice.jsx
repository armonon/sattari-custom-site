import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Headphones, Pause, Play, RotateCcw } from 'lucide-react';
import { noteName } from './music';
import { rhythmTargets, scoreRhythm } from './rhythm';
import { InputMeter } from './MicrophoneSetup';

const LABELS = {
  'on-time': 'On time',
  early: 'A little early',
  late: 'A little late',
  wrong: 'Check the note',
  missed: 'Missed',
  waiting: 'Coming up',
};

export default function RhythmPractice({
  phrase,
  bpm,
  mic,
  initialSpeed,
  onDone,
  onBack,
  onRequestMicrophone,
}) {
  const [speed, setSpeed] = useState(initialSpeed);
  const [phase, setPhase] = useState('ready');
  const [elapsed, setElapsed] = useState((-4 * 60) / bpm / speed);
  const [attacks, setAttacks] = useState([]);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [clipped, setClipped] = useState(false);
  const clock = useRef(null);
  const candidate = useRef(null);
  const consumed = useRef(new Set());
  const targets = useMemo(() => rhythmTargets(phrase, bpm, speed), [phrase, bpm, speed]);
  const beat = 60 / bpm / speed;
  const result = useMemo(
    () =>
      scoreRhythm(
        targets,
        phase === 'ready' ? [] : attacks,
        beat,
        phase === 'ready' ? -Infinity : elapsed
      ),
    [targets, attacks, beat, elapsed, phase]
  );
  const running = phase === 'count' || phase === 'playing';
  useEffect(() => {
    if (running && mic.level?.peak >= 0.98) setClipped(true);
  }, [running, mic.level?.peak]);
  const reliable = attacks.length > 0 && !clipped;
  const end = Math.max((phrase.end - phrase.start) / speed, (targets.at(-1)?.at || 0) + 0.5);
  const stop = useCallback(() => {
    const current = clock.current;
    clock.current = null;
    if (current) {
      cancelAnimationFrame(current.frame);
      void current.context.close().catch(() => {});
    }
  }, []);
  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden && clock.current) {
        stop();
        setPhase('ready');
        setError(
          'Practice paused while this tab was away. Start a fresh count-in when you’re ready.'
        );
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [stop]);
  useEffect(() => {
    if (running && mic.status !== 'listening') {
      stop();
      setPhase('ready');
      setError('The microphone paused. Reconnect, then restart this phrase.');
    }
  }, [mic.status, running, stop]);
  useEffect(() => {
    const pitch = mic.pitch;
    const current = clock.current;
    if (!current || !pitch || pitch.onsetId == null || !Number.isFinite(pitch.onsetAt)) return;
    if (consumed.current.has(pitch.onsetId) || pitch.observedAt - pitch.onsetAt > 240) return;
    if (candidate.current?.id !== pitch.onsetId || candidate.current?.midi !== pitch.midi) {
      candidate.current = { id: pitch.onsetId, midi: pitch.midi, since: pitch.observedAt };
      return;
    }
    if (pitch.observedAt - candidate.current.since < 30) return;
    consumed.current.add(pitch.onsetId);
    const at = (pitch.onsetAt - current.zero - offset) / 1000;
    // Ignore warm-up notes before the final part of the count-in.
    if (at < -Math.min(0.38, beat * 0.45)) return;
    setAttacks((events) => [...events, { at, midi: pitch.midi, cents: pitch.cents }]);
  }, [mic.pitch, offset, beat]);

  const start = async () => {
    stop();
    setError('');
    setAttacks([]);
    setClipped(false);
    consumed.current.clear();
    candidate.current = null;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = new Context();
      // Keep the pending context cancellable during resume, navigation or hiding.
      const current = { context, frame: 0, zero: Infinity };
      clock.current = current;
      await context.resume();
      if (clock.current !== current) return;
      const begin = context.currentTime + 0.15;
      current.zero =
        performance.now() +
        (begin + 4 * beat - context.currentTime + (context.outputLatency || 0)) * 1000;
      const total = 4 + Math.ceil(end / beat);
      for (let i = 0; i < total; i++) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const time = begin + i * beat;
        oscillator.frequency.value = i % 4 === 0 ? 1000 : 700;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.exponentialRampToValueAtTime(0.08, time + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.05);
      }
      setPhase('count');
      setElapsed(-4 * beat);
      const tick = () => {
        if (clock.current !== current) return;
        const time = (performance.now() - current.zero) / 1000;
        setElapsed(time);
        if (time >= end + 0.4) {
          stop();
          setPhase('done');
          return;
        }
        if (time >= 0) setPhase('playing');
        current.frame = requestAnimationFrame(tick);
      };
      current.frame = requestAnimationFrame(tick);
    } catch {
      stop();
      setPhase('ready');
      setError('The metronome could not start. Try again after reconnecting audio.');
    }
  };

  const nextIndex = targets.findIndex((target) => target.at >= elapsed - beat * 0.35);
  const currentIndex = nextIndex < 0 ? targets.length - 1 : nextIndex;
  return (
    <section className={`lf-rhythm${running ? ' is-running' : ''}`}>
      <div className="lj-eyebrow">NEXT STEP · FIND THE PULSE</div>
      <h1>
        Same notes. <em>A little rhythm.</em>
      </h1>
      <p>Hear four clicks, then pluck each note on its beat. Let longer notes ring.</p>
      <div className="lf-rhythm-panel">
        <div className="lf-rhythm-topline">
          <span>
            <Headphones size={17} /> Headphones on for accurate feedback
          </span>
          <label>
            Practice speed{' '}
            <select
              disabled={running}
              value={speed}
              onChange={(e) => {
                setSpeed(Number(e.target.value));
                setPhase('ready');
              }}
            >
              <option value="0.5">50% · {Math.round(bpm * 0.5)} BPM</option>
              <option value="0.75">75% · {Math.round(bpm * 0.75)} BPM</option>
              <option value="1">100% · {bpm} BPM</option>
            </select>
          </label>
        </div>
        <div className="lf-beat-clock" aria-live="off">
          <strong>
            {phase === 'count'
              ? Math.max(1, Math.min(4, Math.ceil(-elapsed / beat)))
              : phase === 'playing'
                ? (Math.floor(elapsed / beat) % 4) + 1
                : phase === 'done'
                  ? reliable
                    ? `${result.onTime}/${result.total}`
                    : '—'
                  : '1 · 2 · 3 · 4'}
          </strong>
          <span>
            {phase === 'count'
              ? 'Get ready…'
              : phase === 'playing'
                ? 'Keep the pulse'
                : phase === 'done'
                  ? reliable
                    ? 'correct notes on time'
                    : 'input unconfirmed'
                  : 'Four beats to get ready'}
          </span>
        </div>
        <div className="lf-rhythm-notes" aria-label="Phrase timing results">
          {result.notes.map((note, i) => (
            <div
              key={note.index}
              className={`lf-rhythm-note ${note.status} ${running && currentIndex === i ? 'is-current' : ''}`}
            >
              <span>Beat {Math.round((note.at / beat) * 100) / 100 + 1}</span>
              <strong>{noteName(note.midi)}</strong>
              <small>
                {phase === 'ready'
                  ? `${Math.round((note.hold / beat) * 100) / 100} beat${note.hold / beat === 1 ? '' : 's'}`
                  : phase === 'done' && !reliable
                    ? 'Unconfirmed'
                    : LABELS[note.status]}
              </small>
            </div>
          ))}
        </div>
        <InputMeter level={mic.level} />
        {phase === 'done' && reliable && (
          <div className="lf-rhythm-result" role="status">
            <strong>
              {result.onTime === result.total && !result.extras
                ? 'Your notes landed on the beat.'
                : 'You’re finding the shape of it.'}
            </strong>
            <p>
              {result.pitch} correct pitches · {result.onTime} on time · {result.extras} extra
              attacks. We measure note starts; sustained duration and technique aren’t scored.
            </p>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        {mic.error && <p role="alert">{mic.error}</p>}
        <div className="lf-rhythm-actions">
          {mic.status !== 'listening' ? (
            <button
              className="loop-button loop-button-purple"
              type="button"
              onClick={() => (onRequestMicrophone ? onRequestMicrophone() : void mic.start())}
            >
              Connect microphone
            </button>
          ) : (
            <button
              className="loop-button loop-button-purple"
              type="button"
              onClick={() => {
                if (running) {
                  stop();
                  setPhase('ready');
                } else void start();
              }}
            >
              {running ? (
                <Pause size={17} />
              ) : phase === 'done' ? (
                <RotateCcw size={17} />
              ) : (
                <Play size={17} />
              )}
              {running
                ? 'Pause & restart'
                : phase === 'done'
                  ? 'Try the rhythm again'
                  : 'Start four-beat count-in'}
            </button>
          )}
          {phase === 'done' && (
            <button
              className="loop-button loop-button-secondary"
              type="button"
              onClick={() =>
                onDone({
                  onTime: result.onTime,
                  pitch: result.pitch,
                  total: result.total,
                  extras: result.extras,
                  speed,
                  reliable,
                  review: result.notes.filter((n) => n.status !== 'on-time').map((n) => n.index),
                })
              }
            >
              Save this attempt <ArrowRight size={17} />
            </button>
          )}
        </div>
        {phase === 'done' && !reliable && (
          <p role="status">
            This attempt is unconfirmed:{' '}
            {clipped
              ? 'the input clipped. Lower the microphone level'
              : 'no clear note attacks reached the microphone'}
            . Check your input and try again. It will not change your adaptive practice plan.
          </p>
        )}
        <details className="lf-rhythm-settings">
          <summary>Timing feels consistently late?</summary>
          <p>
            Use wired headphones if possible. If every correctly played note registers late, adjust
            for your input’s delay and retry.
          </p>
          <label>
            Input delay adjustment{' '}
            <select
              disabled={running}
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
            >
              {[0, 50, 100, 150, 200, 250].map((value) => (
                <option key={value} value={value}>
                  {value} ms
                </option>
              ))}
            </select>
          </label>
        </details>
      </div>
      <button
        className="lj-text-link"
        type="button"
        onClick={() => {
          stop();
          onBack();
        }}
      >
        Back to phrase progress
      </button>
    </section>
  );
}
