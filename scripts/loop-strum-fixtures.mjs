// Deterministic synthetic plucks for pipeline regressions, never accuracy claims.
export function strumFixture(
  midis,
  { rate = 48000, missing = false, sequential = false, noise = 0, gain = 1 } = {}
) {
  const samples = new Float32Array(Math.round(rate * 2.5));
  midis.forEach((midi, index) => {
    if (missing && index === 0) return;
    const begin = 0.25 + index * (sequential ? 0.32 : 0.023);
    const duration = sequential ? 0.18 : 1.8;
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (
      let i = Math.floor(begin * rate);
      i < Math.min(samples.length, (begin + duration) * rate);
      i++
    ) {
      const t = i / rate - begin;
      const envelope = Math.min(1, t / 0.006) * Math.exp(-t * 1.6);
      let value = 0;
      [1, 0.43, 0.24, 0.14, 0.075, 0.04].forEach((amount, harmonic) => {
        value +=
          amount *
          Math.sin(2 * Math.PI * frequency * (harmonic + 1) * t) *
          Math.exp(-t * harmonic * 0.7);
      });
      samples[i] += value * envelope * 0.065 * gain;
    }
  });
  let seed = 20260929;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] += noise * ((seed / 0xffffffff) * 2 - 1);
  }
  return samples;
}
export const STRUM_CASES = [
  { name: 'E minor', expected: [40, 47, 52, 55, 59, 64], correct: true },
  { name: 'A minor', expected: [45, 52, 57, 60, 64], correct: true },
  { name: 'C major', expected: [48, 52, 55, 60, 64], correct: true },
  { name: 'D major', expected: [50, 57, 62, 66], correct: true },
  { name: 'G major', expected: [43, 47, 50, 55, 59, 67], correct: true },
  { name: 'E minor missing root', expected: [40, 47, 52, 55, 59, 64], options: { missing: true } },
  {
    name: 'E major against E minor',
    expected: [40, 47, 52, 55, 59, 64],
    played: [40, 47, 52, 56, 59, 64],
  },
  {
    name: 'E minor sequential strings',
    expected: [40, 47, 52, 55, 59, 64],
    options: { sequential: true },
  },
  {
    name: 'E minor wrong bass',
    expected: [40, 47, 52, 55, 59, 64],
    played: [41, 47, 52, 55, 59, 64],
  },
  { name: 'Noise only', expected: [40, 47, 52, 55, 59, 64], played: [], options: { noise: 0.05 } },
  { name: 'Silence', expected: [40, 47, 52, 55, 59, 64], played: [] },
];
