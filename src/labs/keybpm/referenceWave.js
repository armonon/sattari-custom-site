import { pcmWav } from '../../loop/lessonMedia';

// The fundamental stays strongest. Upper partials help small speakers reproduce a low string.
export const sinePartials = new Float32Array([
  0, 1, 0.59, 0.41, 0.27, 0.21, 0.15, 0.11, 0.09, 0.07, 0.05,
]);
export const cosinePartials = new Float32Array(sinePartials.length);

export function createReferenceWav(frequency) {
  const rate = 24000;
  if (!Number.isFinite(frequency) || frequency < 1 || frequency >= rate / 2)
    throw new RangeError('Reference frequency is outside the supported audio range.');

  // An integer number of cycles in about one second keeps the seam continuous and
  // the pitch error below 0.1 cents at every supported string and calibration.
  const cycles = Math.round(frequency);
  const frames = Math.round((cycles * rate) / frequency);
  const samples = new Float32Array(frames);
  for (
    let harmonic = 1;
    harmonic < sinePartials.length && 2 * harmonic * cycles < frames;
    harmonic++
  ) {
    const radiansPerFrame = (2 * Math.PI * cycles * harmonic) / frames;
    const amplitude = sinePartials[harmonic] * 0.15;
    for (let i = 0; i < frames; i++) samples[i] += amplitude * Math.sin(radiansPerFrame * i);
  }
  return pcmWav(samples, rate);
}
