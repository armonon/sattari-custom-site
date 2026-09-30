import { useEffect, useRef, useState } from 'react';
import { mediaStore, pcmWav } from './lessonMedia';
import { lessonFingerprint } from './progress';

function Recording({ take, onDelete, onListen }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(take.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [take.blob]);
  return (
    <div className="lc-take">
      <div>
        <strong>{new Date(take.at).toLocaleString()}</strong>
        <small>
          {Math.round(take.speed * 100)}% speed · {take.seconds.toFixed(1)} seconds
        </small>
      </div>
      <audio controls src={url} onPlay={(e) => onListen(e.currentTarget)} />
      <button type="button" className="lj-text-link" onClick={() => onDelete(take.id)}>
        Delete take
      </button>
    </div>
  );
}

export default function RecordCompare({ lesson, phrase, mic, speed, sourceUrl, onBeforeRecord }) {
  const [takes, setTakes] = useState([]),
    [phase, setPhase] = useState('idle'),
    [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const run = useRef(null),
    root = useRef(null),
    reference = useRef(null);
  const stopMic = mic.stop;
  const fingerprint = lessonFingerprint(lesson);
  const key = `${lesson.id}:${phrase.start}`;
  const seconds = Math.min(60, Math.max(1, (phrase.end - phrase.start) / speed + 0.5));
  useEffect(() => {
    let live = true;
    void mediaStore('list')
      .then((rows) => {
        if (live)
          setTakes(
            rows
              .filter((r) => r.kind === 'take' && r.key === key && r.fingerprint === fingerprint)
              .sort((a, b) => b.at - a.at)
          );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, fingerprint]);
  useEffect(() => {
    const area = root.current;
    const stop = () => {
      if (run.current) {
        run.current.abort();
        stopMic();
        run.current = null;
      }
      area?.querySelectorAll('audio').forEach((a) => a.pause());
    };
    const hide = () => {
      if (document.hidden) {
        stop();
        setPhase('idle');
        setMessage('Recording paused while this tab was away.');
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', hide);
    };
  }, [stopMic]);
  const pauseOthers = (current) =>
    root.current?.querySelectorAll('audio').forEach((a) => {
      if (a !== current) a.pause();
    });
  const record = async () => {
    const controller = new AbortController();
    run.current = controller;
    setMessage('');
    setPhase('connecting');
    setProgress(0);
    onBeforeRecord?.();
    pauseOthers(null);
    const wait = (ms) =>
      new Promise((resolve, reject) => {
        const done = () => {
          controller.signal.removeEventListener('abort', cancel);
          resolve();
        };
        const timer = setTimeout(done, ms);
        const cancel = () => {
          clearTimeout(timer);
          reject(new DOMException('Cancelled', 'AbortError'));
        };
        controller.signal.addEventListener('abort', cancel, { once: true });
        if (controller.signal.aborted) cancel();
      });
    try {
      await mic.start();
      if (controller.signal.aborted) {
        mic.stop();
        return;
      }
      await mic.prepareRecording({ signal: controller.signal });
      for (let i = 3; i > 0; i--) {
        setPhase(`count-${i}`);
        await wait(1000);
      }
      setPhase('recording');
      const take = await mic.record({
        seconds,
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (controller.signal.aborted) return;
      mic.stop();
      const value = {
        id: crypto.randomUUID(),
        key,
        kind: 'take',
        fingerprint,
        at: Date.now(),
        speed,
        seconds: take.samples.length / take.rate,
        blob: pcmWav(take.samples, take.rate),
      };
      setTakes((rows) => [value, ...rows]);
      try {
        await mediaStore('save', value);
        if (!controller.signal.aborted)
          setMessage('Take saved on this device. Compare it with the example.');
      } catch {
        if (!controller.signal.aborted) {
          setTakes((rows) =>
            rows.map((row) => (row.id === value.id ? { ...row, temporary: true } : row))
          );
          setMessage('Take available for this visit only; device storage is unavailable.');
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setMessage(e.message || 'The take could not be recorded.');
    } finally {
      if (run.current === controller) {
        run.current = null;
        setPhase('idle');
        mic.stop();
      }
    }
  };
  return (
    <details
      className="lc-record"
      ref={root}
      onToggle={(e) => {
        if (!e.currentTarget.open && run.current) {
          run.current.abort();
          mic.stop();
        }
      }}
    >
      <summary>Record & compare</summary>
      <p>
        Record this passage at {Math.round(speed * 100)}% speed after a three-second count-in. Takes
        save on this device. This is a listening exercise; it does not award a score.
      </p>
      {(phrase.end - phrase.start) / speed + 0.5 > 60 && (
        <p>
          This take captures the first 60 seconds. Choose a shorter passage to record it in full.
        </p>
      )}
      <button
        type="button"
        className="loop-button loop-button-secondary"
        disabled={takes.length >= 10 && phase === 'idle'}
        onClick={() => {
          if (phase !== 'idle') {
            run.current?.abort();
            mic.stop();
          } else void record();
        }}
      >
        {phase === 'idle' ? `Record ${Math.ceil(seconds)}-second take` : 'Cancel recording'}
      </button>
      {takes.length >= 10 && <p>Ten takes are saved for this passage. Delete one to make room.</p>}
      {phase !== 'idle' && (
        <p role="status">
          {phase.startsWith('count-')
            ? `Get ready: ${phase.slice(-1)}`
            : phase === 'recording'
              ? 'Recording your guitar…'
              : 'Connecting the microphone…'}
        </p>
      )}
      {phase === 'recording' && (
        <progress value={progress} max="1" aria-label="Recording progress" />
      )}
      {message && <p role="status">{message}</p>}
      {takes.length > 0 && sourceUrl && (
        <div className="lc-example">
          <strong>Lesson example</strong>
          <audio
            ref={reference}
            controls
            src={sourceUrl}
            onPlay={(e) => {
              pauseOthers(e.currentTarget);
              e.currentTarget.playbackRate = speed;
              if (
                e.currentTarget.currentTime < phrase.start ||
                e.currentTarget.currentTime >= phrase.end
              )
                e.currentTarget.currentTime = phrase.start;
            }}
            onTimeUpdate={(e) => {
              if (e.currentTarget.currentTime >= phrase.end) e.currentTarget.pause();
            }}
          />
        </div>
      )}
      {takes.map((take) => (
        <Recording
          key={take.id}
          take={take}
          onListen={pauseOthers}
          onDelete={async (id) => {
            try {
              if (!take.temporary) await mediaStore('delete', id);
              setTakes((rows) => rows.filter((r) => r.id !== id));
            } catch {
              setMessage('Could not delete this take. Try again.');
            }
          }}
        />
      ))}
    </details>
  );
}
