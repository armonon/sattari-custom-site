import { useEffect, useRef, useState } from 'react';
import { gridBeatsBetween } from './keyBpm';

/**
 * A steady click at a tempo, for checking BPM against the song by ear. Clicks
 * are scheduled on the audio clock a little ahead, so timing does not depend
 * on timers. With a beat grid and a playing song it follows the song's measured
 * beats; otherwise it runs free.
 */
export function useMetronome(bpm, { grid = null, getSongTime = null } = {}) {
  const [on, setOn] = useState(false);
  const context = useRef(null);
  // Read through refs so a re-render never restarts the click.
  const sync = useRef({ grid, getSongTime });
  sync.current = { grid, getSongTime };
  useEffect(() => {
    if (!on || !Number.isFinite(bpm) || bpm <= 0) return undefined;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return undefined;
    context.current ||= new Context();
    const audio = context.current;
    void audio.resume?.();
    const beat = 60 / bpm;
    const tick = (when) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = 1500;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.exponentialRampToValueAtTime(0.3, when + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(when);
      osc.stop(when + 0.06);
    };
    let next = audio.currentTime + 0.06; // free-running clock
    let sungUntil = null; // song time already covered while following the song
    const schedule = () => {
      const song = sync.current.getSongTime?.() ?? null;
      const following = sync.current.grid && song !== null;
      if (following) {
        // A seek or a fresh start: begin from the current position.
        if (sungUntil === null || Math.abs(song - sungUntil) > 0.6) sungUntil = song;
        const until = song + 0.2;
        for (const time of gridBeatsBetween(sync.current.grid, sungUntil, until))
          tick(audio.currentTime + Math.max(0, time - song));
        sungUntil = Math.max(sungUntil, until);
        next = audio.currentTime + beat;
        return;
      }
      sungUntil = null;
      while (next < audio.currentTime + 0.2) {
        tick(next);
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
