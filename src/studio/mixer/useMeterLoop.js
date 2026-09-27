import { useEffect } from 'react';

// At most 30 frames a second; the millisecond of slack keeps a 60 Hz display
// sampling every other frame instead of every third.
const FRAME_MS = 1000 / 30 - 1;

/**
 * Samples engine.getChannelMeters() into the meter store while `active` and
 * the tab is visible, with engine metering switched on only for that time.
 * Publishing re-renders the subscribed meters and nothing else.
 */
export function useMeterLoop({ active, store, engineRef }) {
  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    let last = -Infinity;
    let metered = null;
    const meter = (engine) => {
      if (!engine || engine === metered) return;
      engine.setMetering?.(true);
      metered = engine;
    };
    const tick = (time) => {
      frame = window.requestAnimationFrame(tick);
      if (time - last < FRAME_MS) return;
      last = time;
      // A replaced session brings a new engine, which starts with metering off.
      const engine = engineRef.current;
      meter(engine);
      const readings = engine?.getChannelMeters?.();
      if (readings) store.publish(readings, time);
    };
    const start = () => {
      if (frame) return;
      meter(engineRef.current);
      frame = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      last = -Infinity;
      // An engine that was replaced has been disposed; leave it alone.
      if (metered && metered === engineRef.current) metered.setMetering?.(false);
      metered = null;
    };
    const visibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      stop();
    };
  }, [active, store, engineRef]);
}
