// Backgrounds for the Lyric canvas: an audio-reactive visual, a plain
// color/gradient fill, and a user-supplied image or video. Export renders
// frame-by-frame offline (not from a live AnalyserNode), so the
// audio-reactive mode reads amplitude directly out of the already-decoded
// mono buffer around the current playhead time instead of listening live.

/** Root-mean-square amplitude of `samples` in a `windowSeconds` window centered on `timeSeconds`. */
export function audioEnergyAt(samples, rate, timeSeconds, windowSeconds = 0.05) {
  if (!samples?.length || !rate) return 0;
  const center = Math.max(0, timeSeconds) * rate;
  const half = (windowSeconds * rate) / 2;
  const start = Math.max(0, Math.floor(center - half));
  const end = Math.min(samples.length, Math.floor(center + half));
  if (end <= start) return 0;
  let sumSquares = 0;
  for (let i = start; i < end; i++) sumSquares += samples[i] * samples[i];
  return Math.sqrt(sumSquares / (end - start));
}

export const AUDIO_PALETTES = [
  { id: 'sunset', name: 'Sunset', colors: ['#1a0b2e', '#ff5e7e', '#ffd36e'] },
  { id: 'ocean', name: 'Ocean', colors: ['#00121f', '#0466c8', '#48cae4'] },
];

function drawAudioReactive(ctx, state, width, height) {
  const { samples, rate = 44100, time = 0, paletteId = 'sunset' } = state || {};
  const palette = AUDIO_PALETTES.find((p) => p.id === paletteId) || AUDIO_PALETTES[0];
  const energy = audioEnergyAt(samples || [], rate, time);
  // Quiet mixes rarely hit 1.0 RMS, so apply an empirical gain to keep the
  // pulse visible without clipping on loud sections.
  const level = Math.min(1, energy * 6);

  ctx.fillStyle = palette.colors[0];
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.hypot(width, height) / 2;
  const bars = 48;
  for (let i = 0; i < bars; i++) {
    const angle = (i / bars) * Math.PI * 2;
    const wobble = 0.7 + 0.3 * Math.sin(i * 1.7 + time * 2);
    const radius = maxRadius * (0.22 + 0.5 * level) * wobble;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    ctx.fillStyle = palette.colors[1 + (i % (palette.colors.length - 1))];
    ctx.beginPath();
    ctx.arc(x, y, 5 + level * 14, 0, Math.PI * 2);
    ctx.fill();
  }

  const pulseRadius = maxRadius * 0.18 * (0.6 + 0.4 * level);
  if (pulseRadius > 0 && typeof ctx.createRadialGradient === 'function') {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseRadius);
    gradient.addColorStop(0, palette.colors[palette.colors.length - 1]);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const GRADIENT_PRESETS = [
  { id: 'midnight', name: 'Midnight', colors: ['#0f0c29', '#302b63', '#24243e'] },
  { id: 'peach', name: 'Peach', colors: ['#ffecd2', '#fcb69f'] },
  { id: 'aqua', name: 'Aqua', colors: ['#2193b0', '#6dd5ed'] },
];

function drawGradient(ctx, state, width, height) {
  const { type = 'linear', colors = GRADIENT_PRESETS[0].colors } = state || {};
  if (type === 'solid' || colors.length < 2) {
    ctx.fillStyle = colors[0] || '#000000';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const gradient =
    type === 'radial'
      ? ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          Math.hypot(width, height) / 2
        )
      : ctx.createLinearGradient(0, 0, width, height);
  colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawMedia(ctx, state, width, height) {
  const { element } = state || {};
  if (!element) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  const sourceWidth = element.videoWidth || element.naturalWidth || element.width || width;
  const sourceHeight = element.videoHeight || element.naturalHeight || element.height || height;
  if (!sourceWidth || !sourceHeight) return;
  // "Cover" scaling: fill the canvas, cropping whichever axis overflows.
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;
  ctx.drawImage(element, dx, dy, drawWidth, drawHeight);
}

export const BACKGROUND_MODES = [
  { id: 'audio-reactive', name: 'Audio Reactive', draw: drawAudioReactive },
  { id: 'gradient', name: 'Color / Gradient', draw: drawGradient },
  { id: 'media', name: 'Image / Video', draw: drawMedia },
];

/** Draws the named background mode (falls back to the gradient mode for an unknown id). */
export function drawBackground(ctx, mode, state, width, height) {
  const entry = BACKGROUND_MODES.find((m) => m.id === mode) || BACKGROUND_MODES[1];
  entry.draw(ctx, state, width, height);
}
