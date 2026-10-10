// Static, on-demand STFT-magnitude spectrogram for the Clean lab. Not a
// real-time scrolling view -- an alpha tool only needs a single render of
// the whole buffer, triggered when the user flips the waveform/spectrogram
// toggle. Reuses the same small FFT engine the noise reducer uses.
import { fft, hannWindow } from './fft';

const FRAME = 1024;
const HOP = 256;

/** Magnitude STFT of the whole buffer, log-friendly units left to the renderer. */
export function computeSpectrogram(samples, rate, { frame = FRAME, hop = HOP } = {}) {
  const window = hannWindow(frame);
  const bins = frame / 2;
  const frames = samples.length <= frame ? 1 : 1 + Math.floor((samples.length - frame) / hop);
  const magnitudes = new Float32Array(frames * bins);
  const re = new Float64Array(frame),
    im = new Float64Array(frame);
  let max = 1e-9;
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < frame; i++) {
      const s = start + i;
      re[i] = (s < samples.length ? samples[s] : 0) * window[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < bins; b++) {
      const mag = Math.hypot(re[b], im[b]);
      magnitudes[f * bins + b] = mag;
      if (mag > max) max = mag;
    }
  }
  return { magnitudes, frames, bins, rate, hop, frame, max };
}

/** Draws a log-scaled magnitude spectrogram onto `canvas`; low frequencies at the bottom. */
export function drawSpectrogram(canvas, spectrogram, { color = [185, 231, 200] } = {}) {
  if (!canvas || !spectrogram) return;
  const { magnitudes, frames, bins, max } = spectrogram;
  const scale = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round((rect.width || 320) * scale));
  const height = Math.max(1, Math.round((rect.height || 160) * scale));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const image = ctx.createImageData(width, height);
  const floor = Math.log1p(max * 0.001);
  const ceiling = Math.log1p(max);
  const [r, g, b] = color;
  for (let x = 0; x < width; x++) {
    const f = Math.min(frames - 1, Math.floor((x / width) * frames));
    for (let y = 0; y < height; y++) {
      const bin = Math.min(bins - 1, Math.floor(((height - 1 - y) / height) * bins));
      const mag = magnitudes[f * bins + bin];
      const level = (Math.log1p(mag) - floor) / Math.max(1e-6, ceiling - floor);
      const v = Math.max(0, Math.min(1, level));
      const idx = (y * width + x) * 4;
      image.data[idx] = Math.round(17 * (1 - v) + r * v);
      image.data[idx + 1] = Math.round(18 * (1 - v) + g * v);
      image.data[idx + 2] = Math.round(19 * (1 - v) + b * v);
      image.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}
