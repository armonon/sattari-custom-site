import { describe, expect, it } from 'vitest';
import { ProgrammeMeter } from '../../utils/loudnessDSP';
import {
  autoDetectNoiseWindow,
  compress,
  deEss,
  estimateNoiseProfile,
  highPass,
  measureLoudness,
  normalizeLoudness,
  spectralDenoise,
} from './cleanDsp';

const RATE = 44100;

function sine(hz, seconds, amplitude = 1, rate = RATE) {
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

function mix(...buffers) {
  const length = Math.max(...buffers.map((b) => b.length));
  const out = new Float32Array(length);
  for (const buffer of buffers) for (let i = 0; i < buffer.length; i++) out[i] += buffer[i];
  return out;
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

function rmsDb(samples) {
  return 20 * Math.log10(Math.max(1e-9, rms(samples)));
}

/** Simple seeded LCG so "noise" fixtures are deterministic across runs. */
function makeLcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function noiseSignal(seconds, amplitude, seed, rate = RATE) {
  const random = makeLcg(seed);
  const out = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = (random() * 2 - 1) * amplitude;
  return out;
}

/** Goertzel single-bin magnitude: used to check a tone survives denoising. */
function goertzelMagnitude(samples, rate, targetHz) {
  const n = samples.length;
  const k = Math.round((n * targetHz) / rate);
  const omega = (2 * Math.PI * k) / n;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0,
    s2 = 0;
  for (let i = 0; i < n; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

describe('ProgrammeMeter (reused for all LUFS/true-peak measurement)', () => {
  it('reports a 6.02 LU drop for a half-amplitude sine, independent of absolute calibration', () => {
    const full = measureLoudness(sine(1000, 3), RATE);
    const half = measureLoudness(sine(1000, 3, 0.5), RATE);
    expect(full.integrated).not.toBeNull();
    expect(half.integrated).not.toBeNull();
    const diff = full.integrated - half.integrated;
    expect(Math.abs(diff - 6.02)).toBeLessThan(0.3);
  });

  it('measures level, not energy: looping the same content longer does not change integrated loudness', () => {
    const short = measureLoudness(sine(1000, 2), RATE);
    const longer = measureLoudness(sine(1000, 6), RATE);
    expect(Math.abs(short.integrated - longer.integrated)).toBeLessThan(0.3);
  });

  it('measures near-silence as very quiet or unmeasurable', () => {
    const silence = new Float32Array(RATE * 2).map(() => (Math.random() - 0.5) * 1e-6);
    const measured = measureLoudness(silence, RATE);
    expect(measured.integrated === null || measured.integrated < -60).toBe(true);
  });
});

describe('normalizeLoudness', () => {
  it('hits the -16 LUFS podcast target within half a LU', () => {
    const source = sine(220, 4, 10 ** (-30 / 20)); // starts around -30 dBFS peak
    const out = normalizeLoudness(source, RATE, { targetLufs: -16, targetPeakDb: -1 });
    const after = new ProgrammeMeter(RATE);
    for (let i = 0; i < out.length; i += 1024) after.process(out.subarray(i, i + 1024));
    const snapshot = after.snapshot();
    expect(Math.abs(snapshot.integrated - -16)).toBeLessThan(0.5);
  });

  it('hits the -14 LUFS music target within half a LU', () => {
    const source = sine(220, 4, 10 ** (-30 / 20));
    const out = normalizeLoudness(source, RATE, { targetLufs: -14, targetPeakDb: -1 });
    const after = new ProgrammeMeter(RATE);
    for (let i = 0; i < out.length; i += 1024) after.process(out.subarray(i, i + 1024));
    const snapshot = after.snapshot();
    expect(Math.abs(snapshot.integrated - -14)).toBeLessThan(0.5);
  });

  it('limits true peak even when the gain needed for -16 LUFS would push a hot source past -1 dBTP', () => {
    // A quiet -24 dBFS bed (so integrated loudness sits well below -16 LUFS,
    // meaning real boost is needed) plus brief near-full-scale 3ms clicks
    // every 500ms: short enough to barely move the integrated measurement,
    // but they set a true peak that the boost needed for -16 LUFS would push
    // well past -1 dBTP without the limiter.
    const seconds = 6;
    const source = sine(300, seconds, 10 ** (-24 / 20));
    for (let beat = 0; beat < seconds * 2; beat++) {
      const clickLength = Math.round(RATE * 0.003);
      const start = Math.round(beat * 0.5 * RATE);
      for (let i = 0; i < clickLength && start + i < source.length; i++)
        source[start + i] = 0.95 * Math.sin((Math.PI * i) / clickLength);
    }
    const before = measureLoudness(source, RATE);
    expect(before.integrated).toBeLessThan(-16); // confirms boost is actually needed
    const out = normalizeLoudness(source, RATE, { targetLufs: -16, targetPeakDb: -1 });
    const after = measureLoudness(out, RATE);
    expect(after.truePeak).toBeLessThan(-1 + 0.3);
  });
});

describe('spectralDenoise (noise profile + spectral gate)', () => {
  it('suppresses a learned noise floor while preserving a tone at its own frequency', () => {
    const noiseOnly = noiseSignal(1, 0.05, 1);
    const toneAndNoise = mix(noiseSignal(2, 0.05, 2), sine(300, 2, 0.2));
    const full = new Float32Array(noiseOnly.length + toneAndNoise.length);
    full.set(noiseOnly, 0);
    full.set(toneAndNoise, noiseOnly.length);

    const profile = estimateNoiseProfile(full, RATE, { startSeconds: 0, endSeconds: 1 });
    const denoised = spectralDenoise(full, RATE, { noiseProfile: profile, amount: 70 });

    const noiseRegionBefore = full.subarray(0, noiseOnly.length);
    const noiseRegionAfter = denoised.subarray(0, noiseOnly.length);
    const noiseReductionDb = rmsDb(noiseRegionBefore) - rmsDb(noiseRegionAfter);
    expect(noiseReductionDb).toBeGreaterThan(6);

    const toneRegionBefore = full.subarray(noiseOnly.length);
    const toneRegionAfter = denoised.subarray(noiseOnly.length);
    const toneBefore = goertzelMagnitude(toneRegionBefore, RATE, 300);
    const toneAfter = goertzelMagnitude(toneRegionAfter, RATE, 300);
    const toneDropDb = 20 * Math.log10(toneBefore / toneAfter);
    expect(toneDropDb).toBeLessThan(3);
  });

  it('autoDetectNoiseWindow finds the quietest region to feed estimateNoiseProfile', () => {
    const quiet = noiseSignal(1, 0.01, 3);
    const loud = mix(noiseSignal(2, 0.01, 4), sine(440, 2, 0.4));
    const full = new Float32Array(quiet.length + loud.length);
    full.set(quiet, 0);
    full.set(loud, quiet.length);
    const window = autoDetectNoiseWindow(full, RATE);
    expect(window.startSeconds).toBeLessThan(1);
    expect(window.endSeconds).toBeLessThanOrEqual(1.01);
  });
});

describe('highPass', () => {
  it('removes low-frequency rumble while leaving a mid tone mostly intact', () => {
    const rumble = sine(30, 2, 0.5);
    const tone = sine(500, 2, 0.3);
    const source = mix(rumble, tone);
    const filtered = highPass(source, RATE, { cutoffHz: 80, amount: 100 });

    const rumbleReductionDb = rmsDb(rumble) - rmsDb(highPass(rumble, RATE, { cutoffHz: 80 }));
    expect(rumbleReductionDb).toBeGreaterThan(12);

    const toneReductionDb = rmsDb(tone) - rmsDb(highPass(tone, RATE, { cutoffHz: 80 }));
    expect(toneReductionDb).toBeLessThan(1.5);
    expect(filtered.length).toBe(source.length);
  });

  it('wet/dry: amount 0 is dry, 100 is fully processed, 50 is the midpoint', () => {
    const source = mix(sine(30, 1, 0.5), sine(500, 1, 0.3));
    const dry = highPass(source, RATE, { cutoffHz: 80, amount: 0 });
    const wet = highPass(source, RATE, { cutoffHz: 80, amount: 100 });
    const half = highPass(source, RATE, { cutoffHz: 80, amount: 50 });
    for (let i = 0; i < source.length; i++) expect(dry[i]).toBeCloseTo(source[i], 5);
    // amount:50 is sample-exact dry+0.5*(processed-dry), i.e. the elementwise
    // midpoint between the dry and fully-processed signals (not an RMS
    // midpoint, which is not a linear quantity under a phase-shifting filter).
    for (let i = 0; i < source.length; i += 997) {
      const expected = (source[i] + wet[i]) / 2;
      expect(half[i]).toBeCloseTo(expected, 5);
    }
  });
});

describe('compress', () => {
  it('reduces the dynamic range between a loud and a quiet section', () => {
    const loud = sine(220, 1, 10 ** (-6 / 20));
    const quiet = sine(220, 1, 10 ** (-30 / 20));
    const source = new Float32Array(loud.length + quiet.length);
    source.set(loud, 0);
    source.set(quiet, loud.length);

    const compressed = compress(source, RATE, { thresholdDb: -24, ratio: 3 });
    const loudOut = compressed.subarray(0.3 * RATE, loud.length);
    const quietOut = compressed.subarray(loud.length + 0.3 * RATE, compressed.length);
    const loudIn = loud.subarray(0.3 * RATE);
    const quietIn = quiet.subarray(0.3 * RATE);

    const inputRatio = rms(loudIn) / rms(quietIn);
    const outputRatio = rms(loudOut) / rms(quietOut);
    expect(outputRatio).toBeLessThan(inputRatio);
  });
});

describe('deEss', () => {
  it('reduces energy in the sibilant band when a hot 6 kHz burst is present', () => {
    const body = sine(200, 1.5, 0.3);
    const sibilance = sine(6500, 1.5, 0.5);
    const source = mix(body, sibilance);
    const deEssed = deEss(source, RATE, { amount: 80 });
    const before = goertzelMagnitude(source, RATE, 6500);
    const after = goertzelMagnitude(deEssed, RATE, 6500);
    expect(after).toBeLessThan(before);
  });

  it('wet/dry: amount 0 returns the original signal', () => {
    const source = mix(sine(200, 0.5, 0.3), sine(6500, 0.5, 0.5));
    const out = deEss(source, RATE, { amount: 0 });
    for (let i = 0; i < source.length; i++) expect(out[i]).toBeCloseTo(source[i], 5);
  });
});
