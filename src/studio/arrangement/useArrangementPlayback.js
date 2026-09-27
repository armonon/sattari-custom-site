import { useCallback, useEffect, useRef, useState } from 'react';
import { arrangementDuration } from '../../utils/arrangementModel';
import { ArrangementEngine } from '../../utils/arrangementEngine';
import { useLatestRef, useStableCallback } from './useStableCallback';

/** Flags shared by every exclusive editor operation (playback start, import, export…). */
export function useOperationFlags() {
  const [flags] = useState(() => ({
    working: { current: false },
    cancelled: { current: false },
    mounted: { current: true },
  }));
  return flags;
}

/**
 * Transport for the arrangement: engine ownership, play/pause/seek and the
 * playhead loop. The playhead moves through a CSS variable on the timeline;
 * React state only carries the throttled position readout.
 */
export function useArrangementPlayback({
  getEngine,
  master,
  ready,
  visible,
  follow,
  zoom,
  scroll,
  project,
  loop,
  flags,
  onBusy,
  onPlaying,
  setBusy,
  setMessage,
}) {
  const { working, cancelled, mounted } = flags;
  const [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false);
  const engine = useRef(null),
    engineOwner = useRef(null),
    position = useRef(0);
  const settings = useLatestRef(master);
  const masterKey = JSON.stringify(master);
  useEffect(() => {
    engine.current?.setMasterSettings(settings.current);
  }, [masterKey, settings]);
  const getArrangementEngine = useCallback(() => {
    const owner = getEngine();
    if (owner !== engineOwner.current) {
      engine.current?.dispose();
      engineOwner.current = owner;
      engine.current = new ArrangementEngine(
        owner.getAudioContext(),
        owner.output,
        owner.master
          ? {
              input: owner.master,
              reduction: () => Math.max(0, -(owner.masterCompressor?.reduction || 0)),
              returnInput: owner.returnInput ? (bus) => owner.returnInput(bus) : null,
            }
          : null
      );
      owner.arrangementReduction = () => engine.current?.getReduction?.() || 0;
      owner.arrangementMetering = (active) => engine.current?.setMetering?.(active);
      owner.arrangementMeters = (into) => engine.current?.readMeters?.(into);
      engine.current.setMetering?.(!!owner.metering);
    }
    return engine.current;
  }, [getEngine]);
  const setPosition = useCallback((value) => {
    position.current = value;
    setCursor(value);
  }, []);
  const pause = useCallback(() => {
    if (engine.current) {
      const value = engine.current.pause();
      position.current = value;
      setCursor(value);
    }
    setPlaying(false);
    onPlaying(false);
  }, [onPlaying]);
  const syncPlayback = useCallback(
    (next, mixOnly = false) => {
      if (!engine.current) return;
      engine.current.updateMix?.(next);
      if (mixOnly || !engine.current.playing) return;
      void engine.current.revise(next).catch((error) => {
        if (!mounted.current || project.current !== next) return;
        pause();
        setMessage(`Edit saved; playback stopped: ${error.message}`);
      });
    },
    [pause, mounted, project, setMessage]
  );
  const toggle = useStableCallback(async () => {
    if (working.current || !ready) return;
    if (engine.current?.playing) {
      pause();
      return;
    }
    working.current = true;
    cancelled.current = false;
    onBusy(true);
    setBusy(true);
    try {
      const live = getEngine();
      live.pauseAll();
      await live.unlock();
      if (cancelled.current || !mounted.current) return;
      const arrangement = getArrangementEngine();
      const start = position.current >= arrangementDuration(project.current) ? 0 : position.current;
      const started = loop.enabled
        ? await arrangement.play(project.current, start, settings.current, {
            start: loop.start,
            end: loop.end,
          })
        : await arrangement.play(project.current, start, settings.current);
      if (!mounted.current) return;
      setPosition(loop.enabled ? arrangement.position() : start);
      setPlaying(started);
      onPlaying(started);
      setMessage(started ? 'Playing · Audio-clock scheduling' : 'No clips after the playhead.');
    } catch (error) {
      if (mounted.current) setMessage(error.message);
    } finally {
      working.current = false;
      onBusy(false);
      if (mounted.current) setBusy(false);
    }
  });
  const seek = useStableCallback(async (seconds) => {
    if (working.current) return;
    const value = Math.max(0, seconds),
      wasPlaying = engine.current?.playing;
    pause();
    setPosition(value);
    if (wasPlaying) await toggle();
  });
  const stop = useStableCallback(() => {
    pause();
    engine.current?.stop();
    setPosition(0);
  });
  const rewind = useStableCallback(() => {
    engine.current?.stop();
    setPosition(0);
    setPlaying(false);
    onPlaying(false);
  });
  const getPosition = useCallback(
    () => (engine.current?.playing ? engine.current.position() : position.current),
    []
  );
  const cancelOperation = useCallback(() => {
    cancelled.current = true;
    engine.current?.pause();
  }, [cancelled]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      engine.current?.dispose();
    };
  }, [mounted, cancelled]);
  useEffect(() => {
    if (!playing) return undefined;
    let frame,
      previous = 0,
      readoutAt = 0;
    const tick = (timestamp) => {
      if (timestamp - previous > 50) {
        previous = timestamp;
        const value = engine.current.position();
        if (engine.current.error) {
          setMessage(engine.current.error);
          pause();
          return;
        }
        position.current = value;
        if (visible) {
          scroll.current?.style.setProperty('--ae-playhead-x', `${value * zoom}px`);
          if (timestamp - readoutAt > 250) {
            setCursor(value);
            readoutAt = timestamp;
          }
        }
        if (visible && follow && scroll.current) {
          const x = value * zoom;
          if (
            x > scroll.current.scrollLeft + scroll.current.clientWidth - 260 ||
            x < scroll.current.scrollLeft
          )
            scroll.current.scrollLeft = Math.max(0, x - 60);
        }
        if (value >= engine.current.end) {
          pause();
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, visible, pause, follow, zoom, scroll, setMessage]);
  return {
    cursor,
    playing,
    setPlaying,
    position,
    engine,
    settings,
    getArrangementEngine,
    setPosition,
    pause,
    syncPlayback,
    toggle,
    seek,
    stop,
    rewind,
    getPosition,
    cancelOperation,
  };
}
