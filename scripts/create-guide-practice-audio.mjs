// Sattari's original teaching scores and synthesized performances, rendered as mono PCM.
// Regenerate from the repository root with node scripts/create-guide-practice-audio.mjs.
import { mkdir, writeFile } from 'node:fs/promises';

const sampleRate = 24000;
const directory = new URL('../public/audio/guide-practice/', import.meta.url);
await mkdir(directory, { recursive: true });
const track = (seconds) => new Float64Array(Math.round(seconds * sampleRate));
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const tau = 2 * Math.PI;
function sound(lane, start, duration, synth) {
  const offset = Math.round(start * sampleRate);
  for (let i = 0; i < Math.round(duration * sampleRate) && offset + i < lane.length; i++) {
    const t = i / sampleRate;
    const ramp = Math.min(1, t / 0.008, (duration - t) / 0.023);
    lane[offset + i] += synth(t) * ramp;
  }
}
function note(lane, start, duration, pitch, volume, voice = 'pluck') {
  const f = hz(pitch);
  sound(lane, start, duration, (t) => {
    const phase = tau * f * t;
    if (voice === 'vowel') {
      // A harmonic tone with two broad vowel formants. It is identified as synthetic in the lesson.
      let value = 0;
      for (let h = 1; h <= 12; h++) {
        const freq = f * h;
        const weight =
          0.65 / h +
          0.5 * Math.exp(-((freq - 750) ** 2) / 48000) +
          0.28 * Math.exp(-((freq - 1250) ** 2) / 70000);
        value += weight * Math.sin(h * phase + 0.1 * h * Math.sin(tau * 4.8 * t));
      }
      return volume * value * Math.min(1, t * 14);
    }
    return (
      volume *
      (Math.sin(phase) + 0.36 * Math.sin(2 * phase) + 0.16 * Math.sin(3 * phase)) *
      Math.exp(-t * (voice === 'bass' ? 2.3 : 3.2))
    );
  });
}
function chord(lane, start, duration, notes, volume) {
  for (const pitch of notes) note(lane, start, duration, pitch, volume / notes.length);
}
function kick(lane, start) {
  sound(
    lane,
    start,
    0.24,
    (t) => 0.29 * Math.sin(tau * (49 * t + 1.3 * (1 - Math.exp(-t * 34)))) * Math.exp(-t * 16)
  );
}
let seed = 3168;
function snare(lane, start) {
  sound(lane, start, 0.15, (t) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (
      0.18 * (seed / 2 ** 31 - 1) * Math.exp(-t * 31) +
      0.08 * Math.sin(tau * 178 * t) * Math.exp(-t * 28)
    );
  });
}
function click(lane, start, downbeat = false) {
  sound(
    lane,
    start,
    0.068,
    (t) =>
      (downbeat ? 0.36 : 0.23) * Math.sin(tau * (downbeat ? 1390 : 970) * t) * Math.exp(-t * 58)
  );
}
async function wav(name, ...lanes) {
  const length = lanes[0].length;
  const b = Buffer.alloc(44 + length * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) {
    const v = lanes.reduce((sum, lane) => sum + lane[i], 0);
    if (Math.abs(v) >= 1) throw new Error('Clipped sample in ' + name);
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  await writeFile(new URL(name + '.wav', directory), b);
}
const beat = 0.75;
const drums = track(6),
  bass = track(6),
  keys = track(6),
  lead = track(6);
for (const bar of [0, 1]) {
  const t = bar * 4 * beat;
  const root = bar === 0 ? 45 : 41;
  kick(drums, t);
  kick(drums, t + 2 * beat);
  snare(drums, t + beat);
  snare(drums, t + 3 * beat);
  note(bass, t, beat, root, 0.23, 'bass');
  note(bass, t + beat * 1.5, beat * 0.45, root + 7, 0.2, 'bass');
  note(bass, t + beat * 2, beat * 0.9, root, 0.23, 'bass');
  chord(keys, t, beat * 1.8, bar === 0 ? [57, 60, 64] : [53, 57, 60], 0.22);
  chord(keys, t + 2.5 * beat, beat, bar === 0 ? [60, 64, 69] : [57, 60, 65], 0.19);
  [0.5, 1.5, 2.5].forEach((b, i) =>
    note(
      lead,
      t + b * beat,
      beat * 0.8,
      (bar === 0 ? [72, 71, 69] : [69, 67, 65])[i],
      0.14,
      'vowel'
    )
  );
}
await wav('other-instruments', keys);
await wav('karaoke-band', drums, bass, keys);
await wav('solo-vocal', lead);
await wav('two-bar-bass', bass);
await wav('two-bars-without-bass', drums, keys, lead);
const pickupBand = track(6),
  pickupDrums = track(6);
for (let i = 0; i < 8; i++) {
  const t = i * beat;
  chord(pickupBand, t, beat * 0.72, i < 4 ? [55, 59, 62] : [60, 64, 67], i === 4 ? 0.32 : 0.18);
  note(pickupBand, t, beat * 0.75, i < 4 ? 43 : 48, 0.2, 'bass');
  if (i % 2 === 0) kick(pickupDrums, t);
  else snare(pickupDrums, t);
}
snare(pickupDrums, 3.5 * beat);
snare(pickupDrums, 3.75 * beat);
await wav('pickup-with-drums', pickupDrums, pickupBand);
await wav('pickup-drumless', pickupBand);
const guitar = track(4.2),
  clicks = track(4.2);
for (const [i, midi] of [64, 65, 67, 64].entries()) {
  note(guitar, i, 0.96, midi, 0.28);
  click(clicks, i, i === 0);
}
await wav('guitar-phrase-60', guitar);
await wav('guitar-four-beats', clicks);
for (const minor of [false, true]) {
  const lane = track(4);
  chord(lane, 0, 1.85, minor ? [52, 55, 59] : [55, 59, 62], 0.4);
  chord(lane, 2, 1.9, minor ? [45, 52, 57, 60] : [48, 55, 60, 64], 0.4);
  [64, 67, 69, 67, 64, minor ? 57 : 60].forEach((m, i) =>
    note(lane, i * 0.5, i === 5 ? 1.35 : 0.44, m, 0.22)
  );
  await wav(minor ? 'a-minor-ending' : 'c-major-ending', lane);
}
const pulse = track(6);
for (let i = 0; i < 16; i++) click(pulse, i * 0.375, i % 2 === 0);
await wav('80-and-160', pulse);
