import { useCallback, useEffect, useState } from 'react';
import { useLatest } from '../hooks/useLatest';
import { DEFAULT_CUE, normalizeCue } from './mixerModel';

export const HEADPHONES_KEY = 'stemdeck-headphones-v1';

export const STEREO_OUTPUT = Object.freeze({
  maxChannelCount: 2,
  multichannel: false,
  sinkSelectable: false,
  sinkId: '',
});

function readCue() {
  try {
    return normalizeCue(JSON.parse(window.localStorage.getItem(HEADPHONES_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_CUE };
  }
}

const cueSettings = ({ mode, mix, level }) => ({ mode, mix, level });

/**
 * Headphone cue routing and the output device. These are preferences of this
 * device, kept in local storage rather than the session, and applied to every
 * engine the page creates (a new or opened session replaces the engine).
 */
export function useHeadphones({ getEngine, onEngine, setNotice }) {
  const [cue, setCue] = useState(readCue);
  const [effectiveMode, setEffectiveMode] = useState(cue.mode);
  const [capabilities, setCapabilities] = useState(STEREO_OUTPUT);
  const latest = useLatest(cue);

  useEffect(() => {
    try {
      window.localStorage.setItem(HEADPHONES_KEY, JSON.stringify(cue));
    } catch {
      // Preferences apply for this visit without storage.
    }
  }, [cue]);

  // The engine reports the mode it could route; Outputs 3-4 needs four channels.
  const route = useCallback((audio, settings) => {
    const result = audio.setCue?.(cueSettings(settings));
    setEffectiveMode(typeof result === 'string' ? result : settings.mode);
    setCapabilities(audio.getOutputCapabilities?.() || STEREO_OUTPUT);
  }, []);

  useEffect(
    () =>
      onEngine((audio) => {
        const current = latest.current;
        route(audio, current);
        if (!current.deviceId || !audio.setOutputDevice) return;
        const unavailable = () =>
          setNotice('The saved audio output is unavailable; using the default output.');
        void Promise.resolve(audio.setOutputDevice(current.deviceId))
          .then((applied) => (applied ? route(audio, latest.current) : unavailable()))
          .catch(unavailable);
      }),
    [latest, onEngine, route, setNotice]
  );

  const changeCue = useCallback(
    (changes) => {
      const next = normalizeCue({ ...latest.current, ...changes });
      setCue(next);
      route(getEngine(), next);
    },
    [getEngine, latest, route]
  );

  const chooseOutput = useCallback(
    async (deviceId) => {
      const audio = getEngine();
      let applied = false;
      try {
        applied = (await audio.setOutputDevice?.(deviceId)) === true;
      } catch {
        applied = false;
      }
      if (!applied) {
        setNotice('That output could not be selected. Audio stays on the current output.');
        return false;
      }
      const next = { ...latest.current, deviceId };
      setCue(next);
      route(audio, next);
      return true;
    },
    [getEngine, latest, route, setNotice]
  );

  return { cue, effectiveMode, capabilities, changeCue, chooseOutput };
}
