import { useCallback, useEffect, useMemo, useRef } from 'react';
import { normalizeReturns } from '../mixer/mixerReturns';

const withMasterFx = (fx, { x, y }) => ({ ...fx, echo: x, reverb: 100 - y });

/** Crossfader, master bus and return engine sync, the global FX pad and tap tempo. */
export function useMasterControls({ engine, session, setNotice }) {
  const { getEngine } = engine;
  const { state, actions, latest } = session;
  const {
    crossfader,
    crossfaderCurve,
    crossfaderReverse,
    masterLevel,
    masterProcessing,
    limiter,
    aiMaster,
    aiMasterMode,
    masterBpm,
    mixer,
  } = state;
  const tapTimes = useRef([]);

  useEffect(() => {
    const audio = getEngine();
    audio.setCrossfaderCurve(crossfaderCurve);
    audio.setCrossfader(crossfaderReverse ? 100 - crossfader : crossfader);
  }, [crossfader, crossfaderCurve, crossfaderReverse, getEngine]);

  useEffect(() => {
    const audio = getEngine();
    audio.setMasterLevel(masterLevel);
    audio.setMasterProcessing(masterProcessing);
    audio.setLimiter(limiter);
    audio.setMasterAssist(aiMaster, aiMasterMode);
  }, [getEngine, masterLevel, masterProcessing, limiter, aiMaster, aiMasterMode]);

  // Keeps its identity while the values are unchanged (arrangement editor contract).
  // Returns ride along so arrangement playback and exports use the same buses,
  // with the session tempo for the synced delay.
  const master = useMemo(
    () => ({
      level: masterLevel,
      processing: masterProcessing,
      limiter,
      compression: aiMaster,
      mode: aiMasterMode,
      returns: mixer.returns,
      bpm: masterBpm,
    }),
    [aiMaster, aiMasterMode, limiter, masterBpm, masterLevel, masterProcessing, mixer.returns]
  );

  /** Changes return `bus` ('a' reverb, 'b' delay) live and in the session. */
  const updateReturn = useCallback(
    (bus, changes) => {
      getEngine().setReturn?.(bus, changes);
      actions.setMixer((current) => ({
        ...current,
        returns: normalizeReturns({
          ...current.returns,
          [bus]: { ...current.returns[bus], ...changes },
        }),
      }));
    },
    [actions, getEngine]
  );

  const updateMasterFx = useCallback(
    (x, y) => {
      const next = { x: Math.round(x), y: Math.round(y) };
      // Engine calls stay outside the state updater, which StrictMode runs twice.
      const audio = getEngine();
      latest.current.decks.forEach((deck) => audio.setDeckFx(deck.id, withMasterFx(deck.fx, next)));
      actions.setMasterFx(next);
      actions.setDecks((decks) =>
        decks.map((deck) => ({ ...deck, fx: withMasterFx(deck.fx, next) }))
      );
    },
    [actions, getEngine, latest]
  );

  const tapTempo = useCallback(() => {
    const now = performance.now();
    tapTimes.current = [...tapTimes.current.filter((time) => now - time < 2500), now].slice(-6);
    if (tapTimes.current.length < 2) {
      setNotice('Tap again to set the host tempo.');
      return;
    }
    const intervals = tapTimes.current
      .slice(1)
      .map((time, index) => time - tapTimes.current[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    actions.setMasterBpm(Math.round(Math.min(220, Math.max(40, 60000 / average))));
  }, [actions, setNotice]);

  return { master, updateMasterFx, updateReturn, tapTempo };
}
