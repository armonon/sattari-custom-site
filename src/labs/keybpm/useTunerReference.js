import { useCallback, useEffect, useRef, useState } from 'react';
import { noteFrequency } from './instrumentTheory';

import { sinePartials, cosinePartials, createReferenceWav } from './referenceWave';

// Only override the default category. Another feature may already own the audio session.
function switchSessionType(from, to) {
  try {
    const session = navigator.audioSession;
    if (session?.type !== from) return false;
    session.type = to;
    return true;
  } catch {
    // The browser can still run Web Audio with its default session.
    return false;
  }
}

function tuneHeld(session, midi, reference) {
  const hz = noteFrequency(midi, reference);
  if (session.native) {
    session.held.retune(hz);
    return;
  }
  session.held.oscillator.frequency.setTargetAtTime(hz, session.audio.currentTime, 0.008);
}

export default function useTunerReference(targetMidi, reference, onBeforeListen) {
  const current = useRef(null);
  const preferNativeReference = useRef(false);
  const [sounding, setSounding] = useState('');
  const [toneError, setToneError] = useState('');
  const [startingAudio, setStartingAudio] = useState(false);

  const stopTones = useCallback(() => {
    const session = current.current;
    if (!session) return;
    current.current = null;
    setSounding('');
    setStartingAudio(false);
    clearInterval(session.clockTimer);
    clearTimeout(session.releaseTimer);
    if (session.native) {
      const media = session.audio;
      media.onerror = null;
      media.pause();
      media.removeAttribute('src');
      media.load();
      if (session.url) URL.revokeObjectURL(session.url);
    } else {
      session.audio.onstatechange = null;
      void session.audio.close().catch(() => {});
    }
    if (session.usesPlayback) switchSessionType('playback', 'auto');
  }, []);

  useEffect(() => {
    const visibility = () => {
      // Players can keep the open string sounding while reading sheet music in another tab.
      if (document.hidden && !current.current?.held) stopTones();
      else if (current.current) current.current.lastProgress = performance.now();
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
    // Retune the active output without leaving the previous string playing.
    tuneHeld(session, targetMidi, reference);
  }, [targetMidi, reference, stopTones]);

  const start = async (notes, mode) => {
    onBeforeListen();
    window.dispatchEvent(new Event('sattari:stop-reference'));
    window.dispatchEvent(new Event('sattari:reference-tone'));
    setToneError('');
    let session;
    let usesPlayback = false;
    const native = mode === 'reference' && preferNativeReference.current;
    const fail = (message) => {
      if (session && current.current !== session) return;
      if (!session && usesPlayback) switchSessionType('playback', 'auto');
      stopTones();
      if (mode === 'reference' && !native) {
        // Native playback begins only on a fresh user gesture.
        preferNativeReference.current = true;
        setToneError(`${message} Tap the string again to use the alternate audio player.`);
      } else {
        setToneError(`${message} Check your media volume and audio output, then try again.`);
      }
    };
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!native && !Context) throw new Error('Web Audio is unavailable in this browser.');
      usesPlayback = switchSessionType('auto', 'playback');
      const audio = native ? new Audio() : new Context();
      session = { audio, native, held: null, usesPlayback, lastProgress: performance.now() };
      current.current = session;

      // Some output routes report "running" even when the first render quantum never arrives.
      // Wait until the clock has passed the attack, then keep checking for a stalled output.
      const firstAudibleTime = audio.currentTime + 0.055;
      let lastClock = audio.currentTime;
      let started = false;
      let retried = false;
      setStartingAudio(true);
      const checkClock = () => {
        if (current.current !== session) return;
        const now = performance.now();
        const time = audio.currentTime;
        const advanced = native
          ? !audio.paused && time > 0 && time !== lastClock
          : audio.state === 'running' && time > lastClock;
        if (advanced) {
          session.lastProgress = now;
          lastClock = time;
          if (!started && time >= firstAudibleTime) {
            started = true;
            setStartingAudio(false);
          }
        } else if (
          !document.hidden &&
          !retried &&
          audio.state === 'running' &&
          audio.suspend &&
          now - session.lastProgress >= 1200
        ) {
          // Reopen the default output once if the browser clock froze while it claimed to run.
          retried = true;
          void audio
            .suspend()
            .then(() => {
              if (current.current === session) return audio.resume();
            })
            .catch(() => {});
        } else if (!document.hidden && now - session.lastProgress >= 4000) {
          fail(started ? 'Audio playback stalled.' : 'Audio playback could not start.');
        }
      };
      session.clockTimer = setInterval(checkClock, 200);
      if (native) {
        audio.loop = true;
        audio.onerror = () => {
          if (audio.error) fail('The alternate audio player could not play this note.');
        };
        let lastHz;
        session.held = {
          retune(hz) {
            if (hz === lastHz) return;
            lastHz = hz;
            try {
              const oldUrl = session.url;
              const url = URL.createObjectURL(createReferenceWav(hz));
              session.url = url;
              if (oldUrl) URL.revokeObjectURL(oldUrl);
              audio.src = url;
              session.lastProgress = performance.now();
              started = false;
              lastClock = 0;
              setStartingAudio(true);
              // Reuse the unlocked media element and ignore superseded play() rejections.
              void Promise.resolve(audio.play()).catch(() => {
                if (session.url === url) fail('The alternate audio player could not start.');
              });
            } catch {
              fail('The alternate audio player could not load this note.');
            }
          },
        };
        setSounding(mode);
        tuneHeld(session, notes[0], reference);
        return;
      }
      audio.onstatechange = checkClock;
      const wave = audio.createPeriodicWave?.(cosinePartials, sinePartials, {
        disableNormalization: true,
      });
      notes.forEach((midi, i) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const when = audio.currentTime + 0.03 + i * 0.42;
        if (wave) oscillator.setPeriodicWave(wave);
        else oscillator.type = 'triangle';
        oscillator.frequency.value = noteFrequency(midi, reference);
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(0.15, when + 0.025);
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
      checkClock();
    } catch (cause) {
      // A cancelled resume may reject after the next sound has already started.
      fail(cause?.message || 'Reference audio could not start.');
    }
  };

  const playReference = (midi) => {
    if (midi == null) return;
    const session = current.current;
    if (session?.held) tuneHeld(session, midi, reference);
    else void start([midi], 'reference');
  };
  const toggleReference = () => {
    const session = current.current;
    if (!session?.held) {
      playReference(targetMidi);
      return;
    }
    if (session.native || session.audio.state !== 'running') {
      stopTones();
      return;
    }
    // A short release avoids a speaker click even if Stop lands during the attack.
    const { oscillator, gain, attackEnd } = session.held;
    const release = Math.max(attackEnd, session.audio.currentTime);
    session.held = null;
    setSounding('');
    gain.gain.setTargetAtTime(0, release, 0.003);
    clearInterval(session.clockTimer);
    session.audio.onstatechange = null;
    const finish = () => {
      if (current.current === session) stopTones();
    };
    oscillator.onended = finish;
    oscillator.stop(release + 0.025);
    // If the device stopped rendering, onended will never fire on its frozen clock.
    session.releaseTimer = setTimeout(finish, 120);
  };
  const play = (notes) => start(notes, notes.length > 1 ? 'scale' : 'note');
  return {
    play,
    stopTones,
    sounding,
    referenceOn: sounding === 'reference',
    toggleReference,
    playReference,
    startingAudio,
    toneError,
  };
}
