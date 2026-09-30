// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analyzeAutoKey, SattariAutoKey } from './sattariAutoKey';

// Same signal as core/tests/song_key_estimator_contract.cpp in the plugin suite.
function progression(root, minor, sampleRate) {
  const chordSamples = Math.round(1.25 * sampleRate);
  const roots = [
    root,
    (root + 5) % 12,
    (root + 7) % 12,
    root,
    root,
    (root + 5) % 12,
    (root + 7) % 12,
    root,
  ];
  const audio = new Float32Array(chordSamples * 8);
  for (let chord = 0; chord < 8; chord++) {
    const third = (chord === 2 ? false : minor) ? 3 : 4;
    const notes = [roots[chord], (roots[chord] + third) % 12, (roots[chord] + 7) % 12];
    const frequencies = notes.map(
      (note) => 440 * 2 ** ((12 * ((note < 5 ? 4 : 3) + 1) + note - 69) / 12)
    );
    for (let i = 0; i < chordSamples; i++) {
      const time = i / sampleRate;
      const edge = Math.min(1, i / 256, (chordSamples - 1 - i) / 256);
      let sample = 0;
      for (const frequency of frequencies) {
        sample += 0.2 * Math.sin(2 * Math.PI * frequency * time);
        sample += 0.05 * Math.sin(4 * Math.PI * frequency * time);
      }
      audio[chord * chordSamples + i] = edge * sample;
    }
  }
  return audio;
}

function analyse(audio, rate, chunk = audio.length) {
  const estimator = new SattariAutoKey(rate, audio.length);
  for (let from = 0; from < audio.length; from += chunk)
    estimator.addSamples(audio.subarray(from, from + chunk));
  estimator.finalise();
  return estimator.result();
}

describe('Sattari AutoKey native song-key contract', () => {
  it.each([44100, 48000])(
    'recognises all 24 keys at %s Hz',
    (rate) => {
      for (let root = 0; root < 12; root++) {
        for (const minor of [false, true]) {
          const result = analyse(progression(root, minor, rate), rate, 16384);
          expect(result, `${root} ${minor ? 'minor' : 'major'}`).toMatchObject({
            valid: true,
            root,
            minor,
          });
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
          expect(result.alternative.key).not.toBe(result.key);
          expect(result.frames).toBe(Math.ceil((10 * 16000) / 4096));
        }
      }
    },
    30000
  );

  it.each([8000, 11025, 16000, 44100, 48000, 96000])('is chunk-independent at %s Hz', (rate) => {
    const audio = progression(9, true, rate);
    const whole = analyse(audio, rate);
    expect(analyse(audio, rate, 257)).toEqual(whole);
    expect(whole).toMatchObject({ valid: true, root: 9, minor: true });
  });

  it('keeps the tonic with 27.5 Hz boundary sub-bass, matching the native regression', () => {
    const audio = progression(9, false, 44100);
    for (let i = 0; i < audio.length; i++)
      audio[i] += Math.fround(0.12 * Math.sin((2 * Math.PI * 27.5 * i) / 44100));
    expect(analyse(audio, 44100, 4096)).toMatchObject({ valid: true, root: 9, minor: false });
  });

  it('returns no key for silence and sanitises nonfinite samples', () => {
    const silence = new Float32Array(44100);
    expect(analyse(silence, 44100)).toMatchObject({ valid: false, key: null, confidence: 0 });
    silence[0] = NaN;
    silence[100] = Infinity;
    expect(analyse(silence, 44100)).toMatchObject({ valid: false, key: null });
  });

  it('finalises once and ignores samples after finalisation', () => {
    const audio = progression(2, false, 44100);
    const estimator = new SattariAutoKey(44100, audio.length);
    estimator.addSamples(audio);
    estimator.finalise();
    const result = estimator.result();
    estimator.finalise();
    estimator.addSamples(audio);
    expect(estimator.result()).toEqual(result);
  });

  it('adapts stereo without mutating source samples and can preserve antiphase audio', () => {
    const audio = progression(0, false, 44100);
    const inverse = audio.map((value) => -value);
    const original = audio.slice();
    expect(analyzeAutoKey(audio, inverse, 44100).valid).toBe(false);
    expect(analyzeAutoKey(audio, inverse, 44100, 0)).toEqual(analyse(audio, 44100));
    expect(audio.every((sample, i) => sample === original[i])).toBe(true);
  });
});
