import { mkdir, writeFile } from 'node:fs/promises';
import { SONGS } from '../src/loop/catalog.js';

// Deterministic plucked-string teaching arrangements. No third-party recordings.
async function renderLesson(lesson) {
  const rate = 24000;
  const samples = new Float32Array(Math.ceil(lesson.duration * rate));
  let seed = 1789;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  for (const note of lesson.notes) {
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    const period = Math.round(rate / frequency);
    const delay = Float32Array.from({ length: period }, () => (random() * 2 - 1) * 0.9);
    const start = Math.round(note.start * rate);
    const length = Math.round((note.end - note.start) * rate);
    for (let i = 0; i < length && i + start < samples.length; i++) {
      const index = i % period;
      const value = delay[index];
      delay[index] = 0.497 * (value + delay[(index + 1) % period]);
      const envelope = Math.min(1, i / 100) * Math.min(1, (length - i) / 240);
      // A quiet fundamental keeps the synthetic pluck stable and easy to follow.
      samples[start + i] +=
        (value * 0.58 +
          0.18 * Math.sin((2 * Math.PI * frequency * i) / rate) * Math.exp(-i / (rate * 0.24))) *
        envelope;
    }
  }
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++)
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  await mkdir(new URL('../public/audio/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../public${lesson.audioUrl}`, import.meta.url), bytes);
  console.log(
    `Created ${lesson.title}: ${lesson.notes.length} notes, ${lesson.duration.toFixed(1)} seconds.`
  );
}
for (const lesson of SONGS) await renderLesson(lesson);
