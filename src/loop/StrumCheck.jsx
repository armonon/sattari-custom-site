import { useEffect, useRef, useState } from 'react';
import { Check, Mic, RotateCcw, Volume2 } from 'lucide-react';
import MicrophoneSetup from './MicrophoneSetup';
import { noteName } from './music';
import { analyzeStrum } from './strumClient';

const descriptions = {
  matched: 'All shape notes heard together. Nice work!',
  'not-confirmed': 'We couldn’t confirm the whole shape this time.',
  quiet: 'The recording was too quiet to check.',
  clipped: 'The input was too loud to check reliably.',
  unavailable: 'There wasn’t enough audio to check.',
};

function countdown(signal, tick) {
  return new Promise((resolve, reject) => {
    let left = 3;
    tick(left);
    const abort = () => {
      clearInterval(timer);
      reject(new DOMException('Check cancelled', 'AbortError'));
    };
    const timer = setInterval(() => {
      left--;
      if (left) tick(left);
      else {
        clearInterval(timer);
        signal.removeEventListener('abort', abort);
        resolve();
      }
    }, 1000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export default function StrumCheck({ mic, notes, onMatch, matched }) {
  const [stage, setStage] = useState('idle');
  const [count, setCount] = useState(3);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const run = useRef(null);
  const stop = mic.stop;
  useEffect(() => {
    const cancel = () => {
      run.current?.abort();
      run.current = null;
      stop();
    };
    const hide = () => {
      if (document.hidden && run.current) {
        cancel();
        setStage('idle');
        setError('The check paused when you left this tab. Try again when you’re ready.');
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      cancel();
    };
  }, [stop]);
  const cancel = () => {
    run.current?.abort();
    run.current = null;
    stop();
    setStage('idle');
  };
  const start = async () => {
    if (run.current) return;
    const controller = new AbortController();
    run.current = controller;
    const { signal } = controller;
    setError('');
    setResult(null);
    setProgress(0);
    setStage('preparing');
    try {
      await mic.prepareRecording({ signal });
      if (signal.aborted) return;
      setStage('countdown');
      await countdown(signal, setCount);
      if (signal.aborted) return;
      setStage('recording');
      const take = await mic.record({ signal, onProgress: setProgress });
      if (signal.aborted) return;
      stop();
      setStage('analyzing');
      const checked = await analyzeStrum(
        take,
        notes.map((note) => note.midi),
        { signal }
      );
      if (signal.aborted || run.current !== controller) return;
      setResult(checked);
      setStage('result');
      if (checked.status === 'matched') onMatch();
    } catch (cause) {
      if (run.current !== controller) return;
      setStage('idle');
      setError(
        cause.name === 'AbortError'
          ? 'The audio input stopped. Reconnect and try again.'
          : cause.message
      );
    } finally {
      if (run.current === controller) {
        run.current = null;
        stop();
      }
    }
  };
  const busy = ['preparing', 'countdown', 'recording', 'analyzing'].includes(stage);
  return (
    <section className="lf-strum-check" aria-label="Whole chord check">
      <div className="lf-strum-title">
        <Volume2 size={20} />
        <h3>Bring the strings together.</h3>
      </div>
      <p>
        Strum once, then let it ring. This experimental check listens for every note in the
        displayed shape together.
      </p>
      {matched && (
        <span className="lf-strum-badge">
          <Check size={14} /> Whole shape matched
        </span>
      )}
      {stage === 'setup' ? (
        <>
          <MicrophoneSetup mic={mic} onReady={start} />
          <button type="button" className="lj-text-link" onClick={cancel}>
            Cancel strum check
          </button>
        </>
      ) : busy ? (
        <>
          <div
            className={`lf-strum-live ${stage === 'recording' ? 'is-recording' : ''}`}
            role="status"
            aria-live="polite"
          >
            <strong>
              {stage === 'preparing'
                ? 'Getting the recorder ready…'
                : stage === 'countdown'
                  ? `Get ready · ${count}`
                  : stage === 'recording'
                    ? 'Strum now. Let it ring…'
                    : 'Listening for the notes together…'}
            </strong>
            {stage === 'recording' && (
              <progress aria-label="Strum recording" value={progress} max={1} />
            )}
            <span>
              {stage === 'preparing'
                ? 'Hold your chord. A three-count comes next.'
                : stage === 'countdown'
                  ? 'Keep the room quiet. Strum when the count ends.'
                  : stage === 'recording'
                    ? 'Recording 2.5 seconds on this device'
                    : 'Microphone off · first check may take a moment'}
            </span>
          </div>
          <button type="button" className="lj-text-link" onClick={cancel}>
            Cancel strum check
          </button>
        </>
      ) : (
        <>
          {result && (
            <div
              className={`lf-strum-result ${result.status === 'matched' ? 'is-correct' : ''}`}
              role="status"
            >
              <strong>{descriptions[result.status] || descriptions.unavailable}</strong>
              {['matched', 'not-confirmed'].includes(result.status) && (
                <>
                  <div className="lf-strum-notes" aria-label="Detected chord notes">
                    {notes.map((note) => (
                      <span
                        key={note.string}
                        className={result.heard.includes(note.midi) ? 'is-heard' : ''}
                      >
                        {result.heard.includes(note.midi) && <Check size={12} />}
                        {noteName(note.midi)}
                      </span>
                    ))}
                  </div>
                  {result.status !== 'matched' && (
                    <p>
                      {result.extra.length
                        ? `We also picked up ${result.extra.map(noteName).join(', ')}. `
                        : ''}
                      An unmarked note means “not detected,” not “played wrong.” Mute unused
                      strings, move closer, or check the strings individually.
                    </p>
                  )}
                </>
              )}
              {result.status === 'quiet' && (
                <p>
                  Move closer to the microphone or raise your interface input, then strum again.
                </p>
              )}
              {result.status === 'clipped' && (
                <p>Lower your interface input or move a little farther from the microphone.</p>
              )}
            </div>
          )}
          <button
            type="button"
            className="loop-button loop-button-secondary"
            onClick={() => {
              setError('');
              if (mic.status === 'listening') void start();
              else setStage('setup');
            }}
          >
            {result ? <RotateCcw size={16} /> : <Mic size={16} />}
            {result ? 'Check another strum' : 'Try a whole chord check'}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="loop-error">
          {error}
        </p>
      )}
      <small>
        Recorded only when you start a check. Audio stays on your device and is discarded afterward.
        This checks detected pitches, not tuning, finger placement or buzzing.
      </small>
    </section>
  );
}
