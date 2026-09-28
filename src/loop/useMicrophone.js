import { useCallback, useEffect, useRef, useState } from 'react';
import { detectFundamental, reduceSampleRate } from './pitch';

export default function useMicrophone() {
  const runtime = useRef(null);
  const generation = useRef(0);
  const [status, setStatus] = useState('off');
  const [pitch, setPitch] = useState(null);
  const [error, setError] = useState('');

  const release = useCallback(() => {
    generation.current++;
    const current = runtime.current;
    runtime.current = null;
    if (!current) return;
    cancelAnimationFrame(current.frame);
    current.stream?.getTracks().forEach((track) => track.stop());
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
        throw new Error('Microphone access needs a supported browser on HTTPS or localhost.');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      if (token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const Context = window.AudioContext || window.webkitAudioContext;
      context = new Context();
      await context.resume();
      if (token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        await context.close();
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const current = { stream, context, source, frame: 0, last: 0 };
      runtime.current = current;
      const update = (time) => {
        if (runtime.current !== current) return;
        if (time - current.last >= 75) {
          analyser.getFloatTimeDomainData(data);
          const reduced = reduceSampleRate(data, context.sampleRate);
          setPitch(detectFundamental(reduced.samples, reduced.rate));
          current.last = time;
        }
        current.frame = requestAnimationFrame(update);
      };
      current.frame = requestAnimationFrame(update);
      stream.getTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (runtime.current === current) {
            stop();
            setError('The microphone disconnected. Connect it and try again.');
          }
        })
      );
      setStatus('listening');
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
      if (token !== generation.current) return;
      setStatus('off');
      setError(
        cause.name === 'NotAllowedError'
          ? 'Microphone access was declined. Allow it in your browser, then try again.'
          : cause.name === 'NotFoundError'
            ? 'No microphone was found. Connect a microphone or guitar interface.'
            : cause.message || 'Could not open the microphone. Please try again.'
      );
    }
  }, [release, stop]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      release();
    };
  }, [release, stop]);

  return { status, pitch, error, start, stop };
}
