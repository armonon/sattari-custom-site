import { pcmWav } from '../../loop/lessonMedia';

// The fundamental stays strongest. Upper partials help small speakers reproduce a low string.
export const sinePartials = new Float32Array([
  0, 1, 0.59, 0.41, 0.27, 0.21, 0.15, 0.11, 0.09, 0.07, 0.05,
]);
export const cosinePartials = new Float32Array(sinePartials.length);

const rate = 24000;
export const scaleStepSeconds = 0.42;
export const scaleSoundSeconds = 0.38;
export const attackSeconds = 0.025;

function checkFrequency(frequency) {
  if (!Number.isFinite(frequency) || frequency < 1 || frequency >= rate / 2)
    throw new RangeError('Reference frequency is outside the supported audio range.');
}

function writePartials(samples, frequency, offset, length) {
  for (
    let harmonic = 1;
    harmonic < sinePartials.length && 2 * harmonic * frequency < rate;
    harmonic++
  ) {
    const radiansPerFrame = (2 * Math.PI * frequency * harmonic) / rate;
    const amplitude = sinePartials[harmonic] * 0.15;
    for (let i = 0; i < length; i++)
      samples[offset + i] += amplitude * Math.sin(radiansPerFrame * i);
  }
}

export function createReferenceWav(frequency) {
  checkFrequency(frequency);

  // An integer number of cycles in about one second keeps the seam continuous and
  // the pitch error below 0.1 cents at every supported string and calibration.
  const cycles = Math.round(frequency);
  const frames = Math.round((cycles * rate) / frequency);
  const samples = new Float32Array(frames);
  writePartials(samples, (cycles * rate) / frames, 0, frames);
  return pcmWav(samples, rate);
}

// Render finite notes ahead of playback so the browser can play the whole phrase
// from a single gesture, including on devices that suspend Web Audio.
export function createScaleWav(frequencies) {
  const step = Math.round(scaleStepSeconds * rate);
  const sound = Math.round(scaleSoundSeconds * rate);
  const attack = Math.round(attackSeconds * rate);
  const samples = new Float32Array((frequencies.length - 1) * step + sound);
  for (const [index, frequency] of frequencies.entries()) {
    checkFrequency(frequency);
    const offset = index * step;
    writePartials(samples, frequency, offset, sound);
    for (let i = 0; i < sound; i++) {
      samples[offset + i] *= i < attack ? i / attack : (sound - 1 - i) / (sound - 1 - attack);
    }
  }
  return pcmWav(samples, rate);
}
