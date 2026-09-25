import { mkdir, writeFile } from 'node:fs/promises';
import { wavBytes } from '../src/utils/arrangementExport.js';

// Original deterministic synthesis; no third-party song or performance samples.
const sampleRate = 44100;
const seconds = 8;
const roots = [110, 87.307, 130.813, 97.999];
const thirds = [3, 4, 4, 4];
const samples = new Float32Array(sampleRate * seconds);
let seed = 9173;
for (let i = 0; i < samples.length; i++) {
  const t = i / sampleRate;
  const bar = Math.floor(t / 2);
  const beat = t % 0.5;
  const chord = t % 2;
  const bass = Math.sin(2 * Math.PI * roots[bar] * t) * Math.exp(-beat * 5) * 0.2;
  const harmony =
    [0, thirds[bar], 7].reduce(
      (sum, interval) => sum + Math.sin(2 * Math.PI * roots[bar] * 2 * 2 ** (interval / 12) * t),
      0
    ) *
    0.045 *
    Math.exp(-chord * 1.5);
  const kick =
    Math.sin(2 * Math.PI * (54 * beat + 1.4 * (1 - Math.exp(-beat * 30)))) *
    Math.exp(-beat * 30) *
    0.26;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const noise = seed / 2 ** 31 - 1;
  const hat = noise * Math.exp(-(t % 0.25) * 140) * 0.07;
  samples[i] = (bass + harmony + kick + hat) * Math.min(1, t * 100, (seconds - t) * 100);
}
await mkdir('public/audio', { recursive: true });
await writeFile(
  'public/audio/sattari-practice-demo.wav',
  Buffer.from(
    wavBytes({
      sampleRate,
      length: samples.length,
      numberOfChannels: 2,
      getChannelData: () => samples,
    })
  )
);
console.log('Created original 8-second, 120 BPM A minor practice demo.');
