import { useCallback, useEffect, useRef, useState } from 'react';
import { reduceSampleRate } from '../../loop/pitch';
import { detectTunerPitch } from './instrumentTheory';

// A longer input window covers low B on a five-string bass. Processing stays local.
export default function useInstrumentTuner() {
  const live = useRef(null);
  const [status, setStatus] = useState('off');
  const [pitch, setPitch] = useState(null);
  const [error, setError] = useState('');
  const release = useCallback(() => {
    const current = live.current;
    live.current = null;
    if (!current) return;
    clearTimeout(current.startTimer);
    if (current.frame != null) cancelAnimationFrame(current.frame);
    current.stream?.getTracks().forEach((track) => {
      track.removeEventListener?.('ended', current.onEnded);
      track.stop();
    });
    current.source?.disconnect();
    void current.context?.close().catch(() => {});
  }, []);
  const stop = useCallback(() => {
    release();
    setStatus('off');
    setPitch(null);
    setError('');
  }, [release]);
  const start = useCallback(async () => {
    release();
    const current = { last: -Infinity };
    live.current = current;
    setError('');
    setPitch(null);
    setStatus('requesting');
    const fail = (message) => {
      if (live.current !== current) return;
      release();
      setPitch(null);
      setStatus('error');
      setError(message);
    };
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Use a browser with microphone support on HTTPS.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (live.current !== current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      current.stream = stream;
      current.onEnded = () =>
        fail(
          'The microphone disconnected. Reconnect it or choose another microphone and start the tuner again.'
        );
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.addEventListener?.('ended', current.onEnded, { once: true }));
      if (
        !tracks.length ||
        stream.active === false ||
        tracks.some((track) => track.readyState === 'ended')
      ) {
        current.onEnded();
        return;
      }
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('This browser does not support the audio tuner.');
      const context = new Context();
      current.context = context;
      // Permission is already granted. Release the mic if the audio device never wakes.
      current.startTimer = setTimeout(
        () => fail('The microphone audio could not start. Check the input device and try again.'),
        6000
      );
      await context.resume();
      if (live.current !== current) return;
      clearTimeout(current.startTimer);
      const analyser = context.createAnalyser();
      // Keep at least 160 ms for bass fundamentals, including 192 kHz audio interfaces.
      analyser.fftSize = Math.max(
        32,
        Math.min(32768, 2 ** Math.ceil(Math.log2(context.sampleRate * 0.16)))
      );
      const source = context.createMediaStreamSource(stream);
      current.source = source;
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const update = (time) => {
        if (live.current !== current) return;
        if (time - current.last >= 80) {
          analyser.getFloatTimeDomainData(data);
          const reduced = reduceSampleRate(data, context.sampleRate, 12000);
          setPitch(detectTunerPitch(reduced.samples, reduced.rate));
          current.last = time;
        }
        current.frame = requestAnimationFrame(update);
      };
      current.frame = requestAnimationFrame(update);
      setStatus('listening');
    } catch (cause) {
      fail(
        cause?.name === 'NotAllowedError'
          ? 'Microphone access was not allowed. You can still use reference notes and scales, or allow access in your browser and try again.'
          : cause?.message || 'The microphone could not be started.'
      );
    }
  }, [release]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', stop);
    window.addEventListener('sattari:reference-tone', stop);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', stop);
      window.removeEventListener('sattari:reference-tone', stop);
      release();
    };
  }, [release, stop]);
  return { status, pitch, error, start, stop };
}
