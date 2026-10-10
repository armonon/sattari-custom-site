// Pocket's sounds are synthesized with Web Audio nodes (oscillators, filtered
// noise, envelopes): no samples. The same voice functions schedule into a live
// AudioContext or an OfflineAudioContext, so exports sound like playback.
import {
  ALL_TRACKS,
  barDuration,
  bassFrequency,
  bassNotes,
  bufferLike,
  DRUM_TRACKS,
  foldTail,
  mixStems,
  stepDuration,
  stepTime,
  STEPS,
  trackHasNotes,
} from './pocketPattern';

const TAIL_SECONDS = 1.5;
const noiseCache = new WeakMap();

function noiseBuffer(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const length = Math.round(ctx.sampleRate * 1);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 0x2f6b9a1d;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  noiseCache.set(ctx, buffer);
  return buffer;
}

function envelope(ctx, destination, time, peak, decay, attack = 0.001) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  gain.connect(destination);
  return gain;
}

function noise(ctx, time, duration, offset = 0) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.start(time, offset % 0.9, duration);
  return source;
}

function filter(ctx, type, frequency, q = 0.7) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

const VOICES = {
  kick(ctx, out, time, v) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.11);
    osc.connect(envelope(ctx, out, time, 1.0 * v, 0.42));
    osc.start(time);
    osc.stop(time + 0.5);
    const click = noise(ctx, time, 0.02);
    click.connect(filter(ctx, 'highpass', 2500)).connect(envelope(ctx, out, time, 0.18 * v, 0.012));
  },
  snare(ctx, out, time, v) {
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190, time);
    body.frequency.exponentialRampToValueAtTime(150, time + 0.08);
    body.connect(envelope(ctx, out, time, 0.45 * v, 0.1));
    body.start(time);
    body.stop(time + 0.2);
    const snap = noise(ctx, time, 0.3, 0.1);
    snap.connect(filter(ctx, 'highpass', 1200)).connect(envelope(ctx, out, time, 0.55 * v, 0.17));
  },
  clap(ctx, out, time, v) {
    const band = filter(ctx, 'bandpass', 1300, 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    for (const [at, level] of [
      [0, 0.8],
      [0.011, 0.7],
      [0.023, 0.9],
    ]) {
      gain.gain.setValueAtTime(level * v, time + at);
      gain.gain.exponentialRampToValueAtTime(0.05 * v, time + at + 0.009);
    }
    gain.gain.setValueAtTime(0.6 * v, time + 0.032);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    const source = noise(ctx, time, 0.3, 0.3);
    source.connect(band).connect(gain).connect(out);
  },
  hat(ctx, out, time, v) {
    const source = noise(ctx, time, 0.08, 0.5);
    source
      .connect(filter(ctx, 'highpass', 7200))
      .connect(envelope(ctx, out, time, 0.32 * v, 0.045));
  },
  open(ctx, out, time, v) {
    const source = noise(ctx, time, 0.5, 0.6);
    source
      .connect(filter(ctx, 'highpass', 6500))
      .connect(envelope(ctx, out, time, 0.28 * v, 0.32, 0.004));
  },
  rim(ctx, out, time, v) {
    for (const [frequency, level] of [
      [820, 0.35],
      [1640, 0.18],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = frequency;
      osc
        .connect(filter(ctx, 'bandpass', frequency, 3))
        .connect(envelope(ctx, out, time, level * v, 0.05));
      osc.start(time);
      osc.stop(time + 0.08);
    }
  },
};

export function scheduleDrum(ctx, out, id, time, velocity = 1) {
  VOICES[id]?.(ctx, out, time, velocity);
}

export function scheduleBass(ctx, out, frequency, time, duration, cutoff) {
  const lowpass = filter(ctx, 'lowpass', cutoff * 3.5, 5);
  lowpass.frequency.setValueAtTime(cutoff * 3.5, time);
  lowpass.frequency.exponentialRampToValueAtTime(cutoff, time + 0.16);
  const gain = ctx.createGain();
  const end = time + Math.max(0.05, duration);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.42, time + 0.006);
  gain.gain.setValueAtTime(0.36, Math.max(time + 0.007, end - 0.03));
  gain.gain.linearRampToValueAtTime(0, end);
  lowpass.connect(gain).connect(out);
  for (const [type, detune, level] of [
    ['sawtooth', 0, 0.7],
    ['square', -1200, 0.5],
  ]) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    const mix = ctx.createGain();
    mix.gain.value = level;
    osc.connect(mix).connect(lowpass);
    osc.start(time);
    osc.stop(end + 0.01);
  }
}

/** Hi-hats a little softer off the beat: a fixed accent, not randomness. */
export function velocityFor(id, step) {
  if (id === 'hat') return step % 4 === 0 ? 1 : step % 2 ? 0.62 : 0.8;
  return 1;
}

/**
 * Schedules one step of `pattern` at `time`.
 * @param {Record<string, AudioNode>} outputs one node per track id
 */
export function scheduleStep(ctx, outputs, pattern, step, time) {
  for (const { id } of DRUM_TRACKS) {
    if (pattern.drums[id][step]) scheduleDrum(ctx, outputs[id], id, time, velocityFor(id, step));
  }
  const note = bassNotes(pattern).find((item) => item.step === step);
  if (note) {
    const frequency = bassFrequency(pattern.key, pattern.scale, note.row);
    const duration = note.length * stepDuration(pattern.bpm) * 0.92;
    scheduleBass(ctx, outputs.bass, frequency, time, duration, pattern.cutoff);
  }
}

/**
 * Renders `bars` repeats of the pattern offline, one stem per track that has
 * notes and is not muted, each folded into a seamless loop. The mix is the
 * exact sum of the stems.
 */
export async function renderLoop(pattern, { bars = 2, sampleRate = 44100 } = {}) {
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Offline) throw new Error('This browser cannot render audio offline.');
  const loopSeconds = barDuration(pattern.bpm) * bars;
  const loopFrames = Math.round(loopSeconds * sampleRate);
  const totalFrames = loopFrames + Math.round(TAIL_SECONDS * sampleRate);
  const active = ALL_TRACKS.filter(({ id }) => !pattern.muted[id] && trackHasNotes(pattern, id));
  const stems = [];
  for (const track of active) {
    const ctx = new Offline(2, totalFrames, sampleRate);
    const gain = ctx.createGain();
    gain.gain.value = pattern.volume[track.id];
    gain.connect(ctx.destination);
    const silent = ctx.createGain();
    silent.gain.value = 0;
    silent.connect(ctx.destination);
    const outputs = Object.fromEntries(
      ALL_TRACKS.map(({ id }) => [id, id === track.id ? gain : silent])
    );
    for (let bar = 0; bar < bars; bar++) {
      for (let step = 0; step < STEPS; step++) {
        const time = bar * barDuration(pattern.bpm) + stepTime(step, pattern.bpm, pattern.swing);
        // Only this track's voice is built; the others would be silent anyway.
        const solo = {
          ...pattern,
          drums: Object.fromEntries(
            DRUM_TRACKS.map(({ id }) => [
              id,
              id === track.id ? pattern.drums[id] : Array(STEPS).fill(false),
            ])
          ),
          bass: track.id === 'bass' ? pattern.bass : Array(STEPS).fill(null),
        };
        scheduleStep(ctx, outputs, solo, step, time);
      }
    }
    const rendered = await ctx.startRendering();
    const channels = foldTail([rendered.getChannelData(0), rendered.getChannelData(1)], loopFrames);
    stems.push({ id: track.id, label: track.label, channels });
  }
  if (!stems.length) throw new Error('The pattern is empty. Add some steps first.');
  const { mix, gain } = mixStems(stems);
  return {
    sampleRate,
    seconds: loopSeconds,
    gain,
    mix: bufferLike(mix, sampleRate),
    stems: stems.map((stem) => ({ ...stem, buffer: bufferLike(stem.channels, sampleRate) })),
  };
}
