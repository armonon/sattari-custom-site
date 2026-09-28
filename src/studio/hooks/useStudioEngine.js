import { useCallback, useEffect, useRef } from 'react';
import { StudioAudioEngine } from '../../utils/studioAudioEngine';

/** Owns the lazily created audio engine and the object URLs its pads use. */
export function useStudioEngine() {
  const engineRef = useRef(null);
  const objectUrlsRef = useRef(new Map());
  const setups = useRef(new Set());
  const finalizers = useRef(new Set());

  const getEngine = useCallback(() => {
    if (!engineRef.current) {
      engineRef.current = new StudioAudioEngine();
      setups.current.forEach((setup) => setup(engineRef.current));
    }
    return engineRef.current;
  }, []);

  /**
   * Runs `setup(engine)` for the current engine and every later one, for
   * device settings that outlive a session. Returns the unsubscribe function.
   */
  const onEngine = useCallback((setup) => {
    setups.current.add(setup);
    if (engineRef.current) setup(engineRef.current);
    return () => setups.current.delete(setup);
  }, []);

  /**
   * Runs `finalize(engine)` before the page's engine is disposed on unmount
   * (for example to stop and save a recording in progress); the engine stays
   * alive until every finalizer settles. Returns the unsubscribe function.
   */
  const onBeforeDispose = useCallback((finalize) => {
    finalizers.current.add(finalize);
    return () => finalizers.current.delete(finalize);
  }, []);

  const revokeObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  /** Stops and disposes the current session's audio; the next getEngine() starts fresh. */
  const releaseAudio = useCallback(() => {
    engineRef.current?.stopAll?.();
    engineRef.current?.dispose();
    engineRef.current = null;
    revokeObjectUrls();
  }, [revokeObjectUrls]);

  useEffect(
    () => () => {
      const current = engineRef.current;
      engineRef.current = null;
      const pending = [...finalizers.current].map((finalize) =>
        Promise.resolve()
          .then(() => current && finalize(current))
          .catch(() => {})
      );
      void Promise.all(pending).finally(() => {
        revokeObjectUrls();
        current?.dispose();
      });
    },
    [revokeObjectUrls]
  );

  return { engineRef, objectUrlsRef, getEngine, onEngine, onBeforeDispose, releaseAudio };
}
