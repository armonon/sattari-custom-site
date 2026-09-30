import { useCallback, useEffect, useRef, useState } from 'react';
import { detectFundamental, reduceSampleRate } from './pitch';
import { signalLevel, noiseThreshold, detectAttack } from './signal';
import { capturePcm, preparePcmCapture } from './pcmCapture';

export default function useMicrophone() {
  const runtime = useRef(null);
  const generation = useRef(0);
  const [status, setStatus] = useState('off');
  const [pitch, setPitch] = useState(null);
  const [error, setError] = useState('');
  const [level, setLevel] = useState({ rms: 0, peak: 0, db: -120 });
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const selectedDevice = useRef('');
  const threshold = useRef(0.002);
  const calibrationRun = useRef(null);
  const [calibration, setCalibration] = useState({ state: 'idle', progress: 0, threshold: 0.002 });
  const refreshDevices = useCallback(async () => {
    try {
      const available = await navigator.mediaDevices?.enumerateDevices?.();
      if (available) setDevices(available.filter((device) => device.kind === 'audioinput'));
    } catch {
      /* Enumeration is optional; the default input still works. */
    }
  }, []);
  const calibrate = useCallback(() => {
    if (!runtime.current) return;
    calibrationRun.current = { start: performance.now(), levels: [] };
    setCalibration({ state: 'measuring', progress: 0, threshold: threshold.current });
  }, []);

  const release = useCallback(() => {
    generation.current++;
    const current = runtime.current;
    runtime.current = null;
    if (!current) return;
    current.capture?.abort();
    current.preparation?.abort();
    cancelAnimationFrame(current.frame);
    current.stream?.getTracks().forEach((track) => track.stop());
    current.source?.disconnect();
    void current.context?.close().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    release();
    setStatus('off');
    setPitch(null);
    setLevel({ rms: 0, peak: 0, db: -120 });
    calibrationRun.current = null;
    setCalibration((value) => (value.state === 'measuring' ? { ...value, state: 'idle' } : value));
  }, [release]);

  const prepareRecording = useCallback(async ({ signal } = {}) => {
    const current = runtime.current;
    if (!current) throw new Error('Connect your microphone before recording a strum.');
    current.preparation?.abort();
    const controller = new AbortController();
    const abort = () => controller.abort();
    current.preparation = controller;
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    try {
      await preparePcmCapture(current.context, { signal: controller.signal });
      if (controller.signal.aborted) throw new DOMException('Recording cancelled', 'AbortError');
    } finally {
      signal?.removeEventListener('abort', abort);
      if (current.preparation === controller) current.preparation = null;
    }
  }, []);

  const record = useCallback(async ({ signal, onProgress, seconds = 2.5 } = {}) => {
    const current = runtime.current;
    if (!current) throw new Error('Connect your microphone before recording a strum.');
    if (current.capture) throw new Error('A recording is already in progress.');
    const controller = new AbortController();
    const abort = () => controller.abort();
    current.capture = controller;
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    try {
      const take = await capturePcm(current.context, current.source, {
        seconds: Math.max(0.5, Math.min(60, Number(seconds) || 2.5)),
        signal: controller.signal,
        onProgress,
      });
      if (controller.signal.aborted) throw new DOMException('Recording cancelled', 'AbortError');
      if (take.inputFrames < take.samples.length * 0.95)
        throw new Error('The microphone lost audio during this take. Reconnect it and try again.');
      return { samples: take.samples, rate: take.rate, noiseFloor: threshold.current };
    } finally {
      signal?.removeEventListener('abort', abort);
      if (current.capture === controller) current.capture = null;
    }
  }, []);

  const start = useCallback(
    async (inputId = selectedDevice.current) => {
      release();
      const token = generation.current;
      if (typeof inputId !== 'string') inputId = selectedDevice.current;
      if (inputId !== selectedDevice.current) {
        threshold.current = 0.002;
        setCalibration({ state: 'idle', progress: 0, threshold: 0.002 });
      }
      selectedDevice.current = inputId;
      setDeviceId(inputId);
      calibrationRun.current = null;
      setError('');
      setPitch(null);
      setStatus('requesting');
      let stream, context;
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error('Microphone access needs a supported browser on HTTPS or localhost.');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            ...(inputId ? { deviceId: { exact: inputId } } : {}),
          },
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
        analyser.fftSize = 2048;
        const source = context.createMediaStreamSource(stream);
        source.connect(analyser);
        const data = new Float32Array(analyser.fftSize);
        const current = {
          stream,
          context,
          source,
          frame: 0,
          last: 0,
          attack: { rms: 0, at: -Infinity, id: 0 },
        };
        runtime.current = current;
        const update = (time) => {
          if (runtime.current !== current) return;
          if (time - current.last >= 32) {
            analyser.getFloatTimeDomainData(data);
            const signal = signalLevel(
              data.subarray(data.length - Math.floor(context.sampleRate * 0.02))
            );
            setLevel(signal);
            const run = calibrationRun.current;
            if (run) {
              run.levels.push(signal.rms);
              const progress = Math.min(1, (time - run.start) / 1800);
              if (progress === 1) {
                threshold.current = noiseThreshold(run.levels);
                calibrationRun.current = null;
              }
              setCalibration({
                state: progress === 1 ? 'ready' : 'measuring',
                progress,
                threshold: threshold.current,
              });
            }
            current.attack = detectAttack(current.attack, signal.rms, threshold.current, time);
            const reduced = reduceSampleRate(data, context.sampleRate);
            const found =
              run || signal.rms < threshold.current
                ? null
                : detectFundamental(
                    reduced.samples,
                    reduced.rate,
                    70,
                    1320,
                    threshold.current * 0.65
                  );
            setPitch(
              found
                ? {
                    ...found,
                    onsetId: current.attack.id,
                    onsetAt: current.attack.at,
                    observedAt: time,
                  }
                : null
            );
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
        void refreshDevices();
      } catch (cause) {
        stream?.getTracks().forEach((track) => track.stop());
        void context?.close().catch(() => {});
        if (token !== generation.current) return;
        setStatus('off');
        if (cause.name === 'OverconstrainedError') {
          selectedDevice.current = '';
          setDeviceId('');
          threshold.current = 0.002;
          setCalibration({ state: 'idle', progress: 0, threshold: 0.002 });
        }
        setError(
          cause.name === 'NotAllowedError'
            ? 'Microphone access was declined. Allow it in your browser, then try again.'
            : cause.name === 'NotFoundError'
              ? 'No microphone was found. Connect a microphone or guitar interface.'
              : cause.name === 'OverconstrainedError'
                ? 'That input is unavailable. The default microphone is selected; try again.'
                : cause.message || 'Could not open the microphone. Please try again.'
        );
      }
    },
    [release, stop, refreshDevices]
  );

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', onHide);
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
      release();
    };
  }, [release, stop, refreshDevices]);

  return {
    status,
    pitch,
    error,
    start,
    stop,
    record,
    prepareRecording,
    level,
    devices,
    deviceId,
    calibrate,
    calibration,
  };
}
