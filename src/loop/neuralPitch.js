import { keyResample } from './autoKey.js';
import { positionForMidi } from './music.js';

export const CREPE_MODEL = {
  url: '/models/loop/crepe-tiny.onnx',
  sha256: '027006c98e649e4bd9c795fb84cb4df6f23d8a7a54255f38789c68e85b56bd60',
};
const RATE = 16000,
  SIZE = 1024,
  HOP = 320;

// The same ±4-bin salience decoder and per-frame normalization as Auto Pitch's
// SattariCrepePitch.h. Key detection never forces a note into a predicted scale.
export function decodeSalience(salience, threshold = 0.75) {
  let center = 0;
  for (let i = 1; i < salience.length; i++) if (salience[i] > salience[center]) center = i;
  const confidence = salience[center];
  if (!Number.isFinite(confidence) || confidence < threshold) return null;
  let weight = 0,
    product = 0;
  for (let i = Math.max(0, center - 4); i <= Math.min(salience.length - 1, center + 4); i++) {
    const value = Math.max(0, salience[i]);
    weight += value;
    product += value * (1997.3794084376191 + 20 * i);
  }
  if (weight <= 1e-9) return null;
  const frequency = 10 * 2 ** (product / weight / 1200);
  const exact = 69 + 12 * Math.log2(frequency / 440);
  return { midi: Math.round(exact), cents: (exact - Math.round(exact)) * 100, confidence };
}

export function notesFromPitchFrames(frames, duration, hopSeconds = HOP / RATE) {
  // A centered median removes one-frame octave glitches without delaying the
  // timeline. Missing frames remain missing rather than inventing notes in rests.
  const smoothed = frames.map((frame, i) => {
    const neighbors = frames.slice(Math.max(0, i - 1), i + 2).map((f) => f.midi);
    if (frame.midi == null || neighbors.some((midi) => midi == null)) return frame;
    return {
      ...frame,
      midi: [...neighbors].sort((a, b) => a - b)[Math.floor(neighbors.length / 2)],
    };
  });
  const notes = [];
  let current = null,
    previous = null;
  const close = (end) => {
    if (current && current.frames >= 4 && end - current.start >= 0.075) {
      const position = positionForMidi(current.midi, previous);
      if (position) {
        notes.push({
          midi: current.midi,
          start: current.start,
          end: Math.min(duration, end),
          confidence: current.confidence / current.frames,
          ...position,
        });
        previous = position;
      }
    }
    current = null;
  };
  for (const frame of smoothed) {
    const valid = frame.midi >= 40 && frame.midi <= 84;
    if (!valid) {
      close(frame.time);
      continue;
    }
    if (
      current &&
      (current.midi !== frame.midi || (frame.attack && frame.time - current.start >= 0.1))
    )
      close(frame.time);
    current ||= { midi: frame.midi, start: frame.time, confidence: 0, frames: 0 };
    current.confidence += frame.confidence;
    current.frames++;
  }
  close(Math.min(duration, (frames.at(-1)?.time || 0) + hopSeconds));
  return notes;
}

// Injecting the runtime/session lets qualification exercise this exact inference
// path with the pinned model in Node as well as in the browser worker.
export async function transcribeNeural(input, inputRate, ort, session, onProgress = () => {}) {
  const samples = keyResample(input, inputRate);
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const floor = Math.max(0.0006, Math.min(0.006, peak * 0.025));
  const frames = [];
  let previousRms = 0,
    lastAttack = -1;
  const total = Math.ceil(samples.length / HOP),
    batchSize = 32;
  for (let first = 0; first < total; first += batchSize) {
    const count = Math.min(batchSize, total - first);
    const data = new Float32Array(count * SIZE),
      meta = [];
    for (let batch = 0; batch < count; batch++) {
      const center = (first + batch) * HOP;
      const offset = batch * SIZE;
      let mean = 0,
        localEnergy = 0;
      for (let i = 0; i < SIZE; i++) {
        const v = samples[center + i - SIZE / 2] || 0;
        data[offset + i] = v;
        mean += v;
      }
      mean /= SIZE;
      let variance = 0;
      for (let i = 0; i < SIZE; i++) variance += (data[offset + i] - mean) ** 2;
      const std = Math.sqrt(Math.max(1e-8, variance / SIZE));
      for (let i = 0; i < SIZE; i++) data[offset + i] = (data[offset + i] - mean) / std;
      for (let i = center; i < Math.min(samples.length, center + HOP); i++)
        localEnergy += samples[i] ** 2;
      const rms = Math.sqrt(localEnergy / HOP),
        time = center / RATE;
      const attack = rms > floor * 2 && rms > previousRms * 1.8 && time - lastAttack > 0.1;
      if (attack) lastAttack = time;
      previousRms = rms;
      meta.push({ time, rms, attack });
    }
    const tensor = new ort.Tensor('float32', data, [count, SIZE]);
    let output;
    try {
      output = await session.run({ [session.inputNames[0]]: tensor });
      const salience = output[session.outputNames[0]].data;
      for (let i = 0; i < count; i++) {
        const pitch =
          meta[i].rms >= floor ? decodeSalience(salience.subarray(i * 360, (i + 1) * 360)) : null;
        frames.push({ ...meta[i], midi: pitch?.midi ?? null, confidence: pitch?.confidence || 0 });
      }
    } finally {
      tensor.dispose();
      if (output) for (const value of Object.values(output)) value.dispose();
    }
    onProgress((first + count) / total);
  }
  return notesFromPitchFrames(frames, samples.length / RATE);
}
