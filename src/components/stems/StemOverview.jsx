import { useEffect, useRef } from 'react';

const RULER = 18;

/**
 * The whole song at a glance: every part's real peaks layered in its own
 * colour (silent parts dimmed), the A–B loop, numbered bar lines from the
 * beat grid and the playhead. Clicking seeks; the position slider beside it
 * is the keyboard and screen-reader equivalent, so the canvas is decorative.
 */
export default function StemOverview({
  lanes,
  progress = 0,
  loop = null,
  markers = null,
  onSeek = null,
  height = 150,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !lanes?.some((lane) => lane.peaks?.length)) return undefined;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, width * scale);
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(scale, scale);
      // Theme colours come from CSS so the day and night palettes both work.
      const style = getComputedStyle(canvas);
      const accent = style.getPropertyValue('--sp-accent').trim() || '#d6b36d';
      const ink = style.color || '#f5f5f2';
      const wave = height - (markers?.length ? RULER : 0);
      const middle = wave / 2;
      if (loop) {
        context.globalAlpha = 0.14;
        context.fillStyle = accent;
        context.fillRect(loop.a * width, 0, (loop.b - loop.a) * width, wave);
      }
      let max = 0.01;
      for (const lane of lanes) for (const peak of lane.peaks || []) if (peak > max) max = peak;
      const columns = Math.max(1, Math.floor(width / 3));
      // Loud parts first so quieter ones stay visible on top.
      const ordered = [...lanes].sort((a, b) => Number(a.audible) - Number(b.audible));
      for (const lane of ordered) {
        const peaks = lane.peaks;
        if (!peaks?.length) continue;
        context.fillStyle = lane.color;
        for (let column = 0; column < columns; column++) {
          const from = Math.floor((column / columns) * peaks.length);
          const to = Math.max(from + 1, Math.floor(((column + 1) / columns) * peaks.length));
          let value = 0;
          for (let index = from; index < to && index < peaks.length; index++)
            if (peaks[index] > value) value = peaks[index];
          const bar = Math.max(1, (value / max) * (wave - 12));
          const played = column / columns <= progress;
          context.globalAlpha = lane.audible ? (played ? 0.85 : 0.5) : 0.12;
          context.fillRect(column * 3, middle - bar / 2, 2, bar);
        }
      }
      if (markers?.length) {
        context.fillStyle = ink;
        context.globalAlpha = 0.1;
        context.fillRect(0, wave, width, 1);
        // Number every bar that has room for its label.
        const every = Math.max(
          1,
          Math.ceil(36 / Math.max(1, width * (markers[1] - markers[0] || 1)))
        );
        context.font = '10px "JetBrains Mono", ui-monospace, monospace';
        markers.forEach((marker, index) => {
          if (index % every) return;
          const x = marker * width;
          context.globalAlpha = 0.12;
          context.fillRect(x, 0, 1, height);
          context.globalAlpha = 0.5;
          context.fillText?.(String(index + 1), x + 4, height - 5);
        });
      }
      if (loop) {
        context.globalAlpha = 1;
        context.fillStyle = accent;
        context.fillRect(loop.a * width - 1, 0, 2, wave);
        context.fillRect(loop.b * width - 1, 0, 2, wave);
      }
      const x = Math.min(width - 2, Math.max(0, progress * width));
      context.globalAlpha = 1;
      context.fillStyle = ink;
      context.fillRect(x, 0, 2, wave);
      // Playhead knob; skipped on minimal canvas implementations.
      if (context.arc) {
        context.beginPath();
        context.arc(x + 1, 5, 5, 0, Math.PI * 2);
        context.fill();
      }
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [lanes, progress, loop, markers, height]);
  return (
    <canvas
      ref={ref}
      className={`stem-overview${onSeek ? ' is-seekable' : ''}`}
      style={{ height }}
      aria-hidden="true"
      onClick={
        onSeek
          ? (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onSeek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)));
            }
          : undefined
      }
    />
  );
}
