import { useCallback, useEffect, useRef, useState } from 'react';
import { noteFrequency } from './instrumentTheory';

export default function useTunerReference(targetMidi, reference, onBeforeListen) {
  const current = useRef(null);
  const [sounding, setSounding] = useState('');
  const [toneError, setToneError] = useState('');

  const stopTones = useCallback(() => {
    const session = current.current;
    if (!session) return;
    current.current = null;
    setSounding('');
    void session.audio.close().catch(() => {});
  }, []);

  useEffect(() => {
    const visibility = () => {
      // Players can keep the open string sounding while reading sheet music in another tab.
      if (document.hidden && !current.current?.held) stopTones();
    };
    window.addEventListener('sattari:stop-reference', stopTones);
    window.addEventListener('pagehide', stopTones);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('sattari:stop-reference', stopTones);
      window.removeEventListener('pagehide', stopTones);
      document.removeEventListener('visibilitychange', visibility);
      stopTones();
    };
  }, [stopTones]);

  useEffect(() => {
    const session = current.current;
    if (!session?.held) return;
    if (targetMidi == null) {
      stopTones();
      return;
    }
    // Move the existing oscillator to the new string or concert pitch without a second voice.
    session.held.oscillator.frequency.setTargetAtTime(
      noteFrequency(targetMidi, reference),
      session.audio.currentTime,
      0.008
    );
  }, [targetMidi, reference, stopTones]);

  const start = async (notes, mode) => {
    onBeforeListen();
    window.dispatchEvent(new Event('sattari:stop-reference'));
    window.dispatchEvent(new Event('sattari:reference-tone'));
    setToneError('');
    let session;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Reference audio is unavailable in this browser.');
      const audio = new Context();
      session = { audio, held: null };
      current.current = session;
      notes.forEach((midi, i) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const when = audio.currentTime + 0.03 + i * 0.42;
        oscillator.type = 'sine';
        oscillator.frequency.value = noteFrequency(midi, reference);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(0.12, when + 0.025);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(when);
        if (mode === 'reference') {
          session.held = { oscillator, gain, attackEnd: when + 0.025 };
        } else {
          gain.gain.linearRampToValueAtTime(0, when + 0.38);
          if (i === notes.length - 1) {
            oscillator.onended = () => {
              if (current.current === session) stopTones();
            };
          }
          oscillator.stop(when + 0.4);
        }
      });
      setSounding(mode);
      await audio.resume();
    } catch (cause) {
      // A cancelled resume may reject after the next sound has already started.
      if (session && current.current !== session) return;
      stopTones();
      setToneError(cause?.message || 'Reference audio could not start.');
    }
  };

  const toggleReference = () => {
    const session = current.current;
    if (!session?.held) {
      if (targetMidi != null) void start([targetMidi], 'reference');
      return;
    }
    if (session.audio.state !== 'running') {
      stopTones();
      return;
    }
    // A short release avoids a speaker click even if Stop lands during the attack.
    const { oscillator, gain, attackEnd } = session.held;
    const release = Math.max(attackEnd, session.audio.currentTime);
    session.held = null;
    setSounding('');
    gain.gain.setTargetAtTime(0, release, 0.003);
    oscillator.onended = () => {
      if (current.current === session) stopTones();
    };
    oscillator.stop(release + 0.025);
  };
  const play = (notes) => start(notes, notes.length > 1 ? 'scale' : 'note');
  return {
    play,
    stopTones,
    sounding,
    referenceOn: sounding === 'reference',
    toggleReference,
    toneError,
  };
}
