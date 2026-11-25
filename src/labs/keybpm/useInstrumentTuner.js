import { useCallback, useEffect, useRef, useState } from 'react';
import { detectFundamental, reduceSampleRate } from '../../loop/pitch';

// A longer input window covers low B on a five-string bass. Processing stays local.
export default function useInstrumentTuner() {
  const live = useRef(null);
  const generation = useRef(0);
  const [status, setStatus] = useState('off');
  const [pitch, setPitch] = useState(null);
  const [error, setError] = useState('');
  const release = useCallback(() => {
    generation.current++;
    const current = live.current;
    live.current = null;
    if (!current) return;
    cancelAnimationFrame(current.frame);
    current.stream.getTracks().forEach((track) => track.stop());
    current.source?.disconnect();
    void current.context?.close().catch(() => {});
  }, []);
  const stop = useCallback(() => {
    release();
    setStatus('off');
    setPitch(null);
  }, [release]);
  const start = useCallback(async () => {
    release();
    const token = generation.current;
    setError('');
    setPitch(null);
    setStatus('requesting');
    let stream, context;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Use a browser with microphone support on HTTPS.');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('This browser does not support the audio tuner.');
      context = new Context();
      await context.resume();
      if (token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 8192;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const current = { stream, context, source, frame: 0, last: -Infinity };
      live.current = current;
      const update = (time) => {
        if (live.current !== current) return;
        if (time - current.last >= 80) {
          analyser.getFloatTimeDomainData(data);
          const reduced = reduceSampleRate(data, context.sampleRate, 12000);
          setPitch(detectFundamental(reduced.samples, reduced.rate, 25, 2000, 0.004));
          current.last = time;
        }
        current.frame = requestAnimationFrame(update);
      };
      current.frame = requestAnimationFrame(update);
      stream.getTracks().forEach((track) =>
        track.addEventListener?.(
          'ended',
          () => {
            if (live.current === current) stop();
          },
          { once: true }
        )
      );
      setStatus('listening');
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
      if (token !== generation.current) return;
      setStatus('error');
      setError(
        cause?.name === 'NotAllowedError'
          ? 'Microphone access was not allowed. You can still use reference notes and scales, or allow access in your browser and try again.'
          : cause?.message || 'The microphone could not be started.'
      );
    }
  }, [release, stop]);
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
