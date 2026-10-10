import { useCallback, useEffect, useRef, useState } from 'react';
import { VOX_MAX_SECONDS } from './voxDsp';

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

/** Microphone take via MediaRecorder, with browser voice processing turned off. */
export default function useVoxRecorder(onTake) {
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const runtime = useRef(null);
  const latestOnTake = useRef(onTake);
  latestOnTake.current = onTake;

  const release = useCallback(() => {
    const current = runtime.current;
    runtime.current = null;
    if (!current) return;
    clearInterval(current.timer);
    cancelAnimationFrame(current.frame);
    current.stream.getTracks().forEach((track) => track.stop());
    void current.context?.close().catch(() => {});
  }, []);

  useEffect(
    () => () => {
      if (runtime.current?.recorder.state === 'recording') {
        runtime.current.recorder.ondataavailable = null;
        runtime.current.recorder.onstop = null;
        runtime.current.recorder.stop();
      }
      release();
    },
    [release]
  );

  const stop = useCallback(() => {
    const recorder = runtime.current?.recorder;
    if (recorder?.state === 'recording') recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (runtime.current) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser. Drop a vocal file instead.');
      return;
    }
    setStatus('requesting');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      setStatus('idle');
      setError('Microphone access was blocked. Allow it in the address bar, or drop a file.');
      return;
    }
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const started = performance.now();
    const current = { stream, recorder, timer: 0, frame: 0, context: null };
    runtime.current = current;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = new Context();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const meter = () => {
        analyser.getFloatTimeDomainData(data);
        let peak = 0;
        for (const value of data) peak = Math.max(peak, Math.abs(value));
        setLevel(peak);
        current.frame = requestAnimationFrame(meter);
      };
      current.context = context;
      meter();
    } catch {
      /* The level meter is optional. */
    }
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      release();
      setStatus('idle');
      setLevel(0);
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      if (blob.size) latestOnTake.current(blob);
      else setError('The recording was empty. Check your input device and try again.');
    };
    current.timer = setInterval(() => {
      const seconds = (performance.now() - started) / 1000;
      setElapsed(seconds);
      if (seconds >= VOX_MAX_SECONDS) recorder.stop();
    }, 200);
    setElapsed(0);
    recorder.start(250);
    setStatus('recording');
  }, [release]);

  return { status, elapsed, level, error, start, stop };
}
