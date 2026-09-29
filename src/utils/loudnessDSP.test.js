import { it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { ProgrammeMeter, kWeighting } from './loudnessDSP';

function signal(rate, seconds, level = 0.1, hz = 997, phase = 0) {
  return Float32Array.from(
    { length: Math.round(rate * seconds) },
    (_, i) => level * Math.sin((2 * Math.PI * hz * i) / rate + phase)
  );
}
function feed(meter, left, right = left) {
  for (let at = 0; at < left.length; at += 128)
    meter.process(left.subarray(at, at + 128), right?.subarray(at, at + 128));
  return meter.snapshot();
}
it('matches the reference 48 kHz K-weighting coefficients', () => {
  const [s, h] = kWeighting(48000);
  expect(s[0]).toBeCloseTo(1.53512485958697, 10);
  expect(s[3]).toBeCloseTo(-1.69065929318241, 10);
  expect(h[3]).toBeCloseTo(-1.99004745483398, 10);
  expect(h[4]).toBeCloseTo(0.99007225036621, 10);
});
it('measures stereo loudness, excludes silence from integrated loudness and resets', () => {
  const meter = new ProgrammeMeter(48000),
    tone = signal(48000, 4);
  const value = feed(meter, tone);
  expect(value.integrated).toBeCloseTo(-20, 1);
  expect(value.shortTerm).toBeCloseTo(-20, 1);
  expect(value.truePeak).toBeCloseTo(-20, 1);
  const quiet = feed(meter, new Float32Array(48000 * 5));
  expect(Math.abs(quiet.integrated - value.integrated)).toBeLessThan(0.2);
  expect(meter.counts.length).toBe(10001);
  meter.reset();
  expect(meter.snapshot().integrated).toBeNull();
  expect(meter.snapshot().seconds).toBe(0);
});
it('waits for complete gating blocks and detects intersample peaks', () => {
  const meter = new ProgrammeMeter(48000);
  feed(meter, signal(48000, 0.2));
  expect(meter.snapshot().integrated).toBeNull();
  meter.reset();
  const value = feed(meter, signal(48000, 1, 0.99, 12000, Math.PI / 4));
  expect(value.truePeak - value.samplePeak).toBeGreaterThan(2);
});
it.each([44100, 48000])(
  'resets measurement at arbitrary waveform phases without inventing a peak at %i Hz',
  (rate) => {
    const tone = signal(rate, 1);
    for (const phase of [0, 8, 12, 20, 32, 40]) {
      const meter = new ProgrammeMeter(rate);
      const cut = Math.floor(rate / 4) + phase;
      feed(meter, tone.subarray(0, cut));
      meter.reset();
      expect(meter.snapshot().truePeak).toBeNull();
      expect(meter.snapshot().measurementSeconds).toBe(0);
      const value = feed(meter, tone.subarray(cut));
      expect(Math.abs(value.truePeak + 20)).toBeLessThan(0.1);
      expect(Math.abs(value.integrated + 20)).toBeLessThan(0.1);
    }
  }
);
it('holds maxima between UI updates and excludes paused time from programme integration', () => {
  const meter = new ProgrammeMeter(48000);
  feed(meter, new Float32Array(960));
  feed(meter, signal(48000, 0.4));
  feed(meter, new Float32Array(48000));
  expect(meter.snapshot().maxMomentary).toBeCloseTo(-20, 1);
  const before = meter.snapshot();
  meter.setRunning(false);
  feed(meter, signal(48000, 4, 0.5));
  expect(meter.snapshot().integrated).toBe(before.integrated);
  expect(meter.snapshot().measurementSeconds).toBe(before.measurementSeconds);
  expect(meter.snapshot().momentary).toBeGreaterThan(-7);
  meter.setRunning(true);
  feed(meter, signal(48000, 4));
  expect(meter.snapshot().measuring).toBe(true);
  meter.reset();
  expect(meter.snapshot().maxMomentary).toBeNull();
  expect(meter.snapshot().loudnessRange).toBeNull();
});
let ffmpeg = false;
try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  ffmpeg = true;
} catch {
  /* Optional independent local oracle. */
}
it.skipIf(!ffmpeg)('agrees with FFmpeg ebur128 on stereo gated loudness at 44.1/48 kHz', () => {
  for (const rate of [44100, 48000]) {
    const input = signal(rate, 10, 0.15);
    // Include both gates: trailing silence and a quiet section below relative gate.
    for (let i = rate * 4; i < input.length; i++) input[i] *= i < rate * 7 ? 0.01 : 0;
    const meter = new ProgrammeMeter(rate),
      result = feed(meter, input);
    const interleaved = new Float32Array(input.length * 2);
    input.forEach((v, i) => {
      interleaved[i * 2] = v;
      interleaved[i * 2 + 1] = v;
    });
    const reference = spawnSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-f',
        'f32le',
        '-ar',
        String(rate),
        '-ac',
        '2',
        '-i',
        'pipe:0',
        '-af',
        'ebur128=peak=true',
        '-f',
        'null',
        '-',
      ],
      { input: Buffer.from(interleaved.buffer), encoding: 'buffer' }
    );
    expect(reference.status).toBe(0);
    const matches = [...reference.stderr.toString().matchAll(/I:\s*(-?[\d.]+) LUFS/g)];
    expect(matches.length).toBeGreaterThan(0);
    const expected = Number(matches.at(-1)[1]);
    expect(Math.abs(result.integrated - expected)).toBeLessThan(0.1);
  }
});
