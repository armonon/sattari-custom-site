import { useEffect, useRef } from 'react';

/**
 * Real waveform peaks with the actual playback position and loop region.
 * Clicking seeks; the transport slider is the keyboard-accessible equivalent,
 * so the canvas itself is decorative for assistive technology.
 */
export default function StemWaveform({
  peaks,
  color,
  progress = 0,
  loop = null,
  markers = null,
  onSeek = null,
  height = 44,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !peaks?.length) return undefined;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * scale);
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(scale, scale);
      if (loop) {
        context.globalAlpha = 0.14;
        context.fillStyle = color;
        context.fillRect(loop.a * rect.width, 0, (loop.b - loop.a) * rect.width, height);
      }
      let max = 0.01;
      for (const peak of peaks) if (peak > max) max = peak;
      const step = rect.width / peaks.length;
      for (let index = 0; index < peaks.length; index++) {
        const bar = Math.max(1, (peaks[index] / max) * (height - 8));
        context.globalAlpha = index / peaks.length > progress ? 0.42 : 1;
        context.fillStyle = color;
        context.fillRect(index * step, (height - bar) / 2, Math.max(1, step - 1), bar);
      }
      if (markers?.length) {
        // Bar lines from the beat grid.
        context.globalAlpha = 0.35;
        context.fillStyle = color;
        for (const marker of markers) context.fillRect(marker * rect.width, 0, 1, height);
      }
      context.globalAlpha = 1;
      context.fillStyle = 'currentColor';
      context.fillRect(Math.min(rect.width - 1, progress * rect.width), 0, 1.5, height);
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks, color, progress, loop, height, markers]);
  return (
    <canvas
      ref={ref}
      className={`stem-waveform${onSeek ? ' is-seekable' : ''}`}
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
