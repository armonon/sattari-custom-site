import { useLayoutEffect, useRef, useState } from 'react';
import { bounded } from '../../utils/arrangementModel';

/**
 * Timeline zoom (pixels per second). Zooming keeps the playhead where it is on
 * screen, or the view centre when the playhead is out of view; the new scroll
 * position is applied after the wider/narrower timeline has rendered.
 */
export function useTimelineZoom({ scroll, bpm }) {
  const [zoom, setZoom] = useState(40);
  const pendingScroll = useRef(null);
  useLayoutEffect(() => {
    if (pendingScroll.current !== null && scroll.current) {
      scroll.current.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [zoom, scroll]);
  const viewportWidth = () =>
    Math.max(
      180,
      (scroll.current?.clientWidth || 1000) -
        (scroll.current?.querySelector('.ae-ruler > span')?.offsetWidth || 220)
    );
  const changeZoom = (requested, playhead) => {
    const next = bounded(requested, 0.1, 400, zoom),
      left = scroll.current?.scrollLeft || 0,
      viewWidth = viewportWidth(),
      x = playhead * zoom - left,
      anchor = x >= 0 && x <= viewWidth ? x : viewWidth / 2;
    pendingScroll.current = Math.max(0, ((left + anchor) / zoom) * next - anchor);
    setZoom(next);
  };
  /** Fits `clips` (from their earliest start when `fromFirst`) into the view. */
  const fit = (clips, fromFirst) => {
    const start =
        fromFirst && clips.length
          ? clips.reduce((value, clip) => Math.min(value, clip.start), Infinity)
          : 0,
      end = clips.reduce((value, clip) => Math.max(value, clip.start + clip.duration), start),
      next = bounded(
        (viewportWidth() - 40) / Math.max(0.1, end - start || (16 * 240) / bpm),
        0.1,
        400
      );
    pendingScroll.current = Math.max(0, start * next - 20);
    if (next === zoom && scroll.current) scroll.current.scrollLeft = pendingScroll.current;
    setZoom(next);
  };
  return { zoom, changeZoom, fit };
}
