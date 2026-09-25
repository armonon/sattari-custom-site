import * as Tone from 'tone';

// Immutable impulses may be shared by all decks at the same sample rate.
// Bound uncommon rates too, so repeated device changes cannot grow this cache.
const impulses = new Map();

// Versioned, deterministic impulse: live playback and replay use identical room
// data instead of generating a new random reverb on every engine construction.
export function performanceReverb() {
  const input = new Tone.Gain(1),
    mix = new Tone.CrossFade(0);
  const raw = input.context.rawContext,
    convolver = raw.createConvolver();
  let buffer = impulses.get(raw.sampleRate);
  if (!buffer) {
    buffer = raw.createBuffer(2, Math.ceil(raw.sampleRate * 1.812), raw.sampleRate);
    for (let c = 0; c < 2; c++) {
      let seed = 9127 + c * 1237;
      const pcm = buffer.getChannelData(c),
        delay = Math.round(raw.sampleRate * 0.012);
      for (let i = delay; i < pcm.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        pcm[i] = (seed / 2147483648 - 1) * Math.exp((-6.9 * (i - delay)) / (raw.sampleRate * 1.8));
      }
    }
    if (impulses.size >= 4) impulses.delete(impulses.keys().next().value);
    impulses.set(raw.sampleRate, buffer);
  }
  convolver.buffer = buffer;
  input.connect(mix.a);
  Tone.connect(input, convolver);
  Tone.connect(convolver, mix.b);
  return {
    input,
    output: mix,
    wet: mix.fade,
    connect(to) {
      mix.connect(to);
      return this;
    },
    dispose() {
      input.dispose();
      mix.dispose();
      convolver.disconnect();
    },
  };
}
