import { useEffect, useRef, useState } from 'react';

/**
 * A steady click at a tempo, for checking BPM against the song by ear. Clicks
 * are scheduled on the audio clock a little ahead, so timing does not depend
 * on timers. The click is free-running: it is not aligned to the song's beats.
 */
export function useMetronome(bpm) {
  const [on, setOn] = useState(false);
  const context = useRef(null);
  useEffect(() => {
    if (!on || !Number.isFinite(bpm) || bpm <= 0) return undefined;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return undefined;
    context.current ||= new Context();
    const audio = context.current;
    void audio.resume?.();
    const beat = 60 / bpm;
    let next = audio.currentTime + 0.06;
    const schedule = () => {
      while (next < audio.currentTime + 0.2) {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.frequency.value = 1500;
        gain.gain.setValueAtTime(0.0001, next);
        gain.gain.exponentialRampToValueAtTime(0.3, next + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.0001, next + 0.05);
        osc.connect(gain);
        gain.connect(audio.destination);
        osc.start(next);
        osc.stop(next + 0.06);
        next += beat;
      }
    };
    schedule();
    const timer = setInterval(schedule, 50);
    return () => clearInterval(timer);
  }, [on, bpm]);
  useEffect(() => () => void context.current?.close?.().catch(() => {}), []);
  return { on, toggle: () => setOn((value) => !value), stop: () => setOn(false) };
}
