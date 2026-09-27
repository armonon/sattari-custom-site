// Return buses shared by the live mixer and offline export. Everything here is
// deterministic: the reverb impulse comes from fixed seeds, never Math.random,
// so renders of the same settings are identical.
export const RETURN_BUSES = Object.freeze(['a', 'b']);
export const RETURN_DIVISIONS = Object.freeze({
  '1/16': 0.25,
  '1/8': 0.5,
  '1/8d': 0.75,
  '1/4': 1,
  '1/4d': 1.5,
  '1/2': 2,
});
export const DEFAULT_RETURNS = Object.freeze({
  a: Object.freeze({ size: 45, decay: 2.4, preDelay: 12, tone: 50, level: 70, muted: false }),
  b: Object.freeze({
    division: '1/4',
    feedback: 35,
    tone: 50,
    pingPong: false,
    level: 70,
    muted: false,
  }),
});
const RANGES = {
  size: [0, 100],
  decay: [0.3, 10],
  preDelay: [0, 200],
  tone: [0, 100],
  level: [0, 100],
  feedback: [0, 90],
};
export const MAX_RETURN_DELAY = 6;
const IMPULSE_ENERGY = 0.35;
const CROSSFADE = 0.05;
const IMPULSE_INTERVAL_MS = 150;

const bounded = (value, key, fallback) => {
  const number =
    typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
      ? Number(value)
      : NaN;
  const [min, max] = RANGES[key];
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const flag = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

// Partial values merge over `base`, so one function serves defaults and edits.
export function normalizeReturnBus(bus, value, base = DEFAULT_RETURNS[bus]) {
  const input = value && typeof value === 'object' ? value : {};
  if (bus === 'a')
    return {
      size: bounded(input.size, 'size', base.size),
      decay: bounded(input.decay, 'decay', base.decay),
      preDelay: bounded(input.preDelay, 'preDelay', base.preDelay),
      tone: bounded(input.tone, 'tone', base.tone),
      level: bounded(input.level, 'level', base.level),
      muted: flag(input.muted, base.muted),
    };
  return {
    division: Object.hasOwn(RETURN_DIVISIONS, input.division) ? input.division : base.division,
    feedback: bounded(input.feedback, 'feedback', base.feedback),
    tone: bounded(input.tone, 'tone', base.tone),
    pingPong: flag(input.pingPong, base.pingPong),
    level: bounded(input.level, 'level', base.level),
    muted: flag(input.muted, base.muted),
  };
}

export function normalizeReturns(value) {
  const input = value && typeof value === 'object' ? value : {};
  return { a: normalizeReturnBus('a', input.a), b: normalizeReturnBus('b', input.b) };
}

// The fader taper below unity (gainFromPercent): 100 is 0 dB, 0 is silence.
export function percentGain(value) {
  const number = Number(value);
  return Math.pow(Math.min(100, Math.max(0, Number.isFinite(number) ? number : 0)) / 100, 1.35);
}
export const sendGain = percentGain;

export function returnDelaySeconds(division, bpm) {
  const tempo = Number(bpm);
  const beats = RETURN_DIVISIONS[division] ?? 1;
  const seconds = (beats * 60) / (tempo > 0 && Number.isFinite(tempo) ? tempo : 120);
  return Math.min(MAX_RETURN_DELAY, Math.max(0.01, seconds));
}

// 0 = dark (low-pass), 50 = flat, 100 = thin (high-pass).
export function returnToneFrequencies(tone) {
  const value = Math.min(100, Math.max(0, Number(tone) || 0));
  return {
    lowpass: value < 50 ? 1200 * Math.pow(20000 / 1200, value / 50) : 20000,
    highpass: value > 50 ? 20 * Math.pow(800 / 20, (value - 50) / 50) : 20,
  };
}

export const impulseSeconds = (decay) => decay * 1.2 + 0.03;

// Seconds of audible output after the last send input (-100 dB, like rackTail).
export function returnTail(bus, params, bpm) {
  if (bus === 'a') return params.preDelay / 1000 + impulseSeconds(params.decay);
  const time = returnDelaySeconds(params.division, bpm);
  const feedback = Math.max(0.001, params.feedback / 100);
  return time * (1 + Math.ceil(Math.log(1e-5) / Math.log(feedback)));
}

export const reverbImpulseKey = (sampleRate, { size, decay }) => `${sampleRate}:${size}:${decay}`;

const impulses = new Map();
// Filtered, exponentially decaying noise with sparse early reflections. Each
// channel has a fixed seed: identical settings always yield identical PCM.
export function reverbImpulse(sampleRate, size, decay) {
  const key = reverbImpulseKey(sampleRate, { size, decay });
  const cached = impulses.get(key);
  if (cached) {
    impulses.delete(key);
    impulses.set(key, cached);
    return cached;
  }
  const room = Math.min(100, Math.max(0, size)) / 100;
  const length = Math.max(1, Math.ceil(sampleRate * impulseSeconds(decay)));
  const perSample = Math.exp(-6.907755278982137 / (decay * sampleRate)); // -60 dB at `decay`
  const onset = Math.max(1, Math.round(sampleRate * (0.002 + 0.028 * room)));
  const early = Math.max(2, Math.round(sampleRate * (0.004 + 0.056 * room)));
  const channels = [0, 1].map((channel) => {
    const pcm = new Float32Array(length);
    let seed = (0x2545f491 + channel * 0x9e3779b9) >>> 0;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    let envelope = 1,
      smooth = 0;
    for (let i = 0; i < length; i++) {
      // High frequencies die away faster than lows, as in a real room.
      const brightness = 0.92 - 0.7 * Math.min(1, i / (decay * sampleRate));
      smooth += brightness * (next() / 2147483648 - 1 - smooth);
      pcm[i] = smooth * envelope * (i < onset ? i / onset : 1);
      envelope *= perSample;
    }
    const taps = 6 + Math.round(10 * room);
    for (let tap = 0; tap < taps; tap++) {
      const at = Math.min(length - 1, Math.floor((next() / 4294967296) * early));
      pcm[at] += (next() & 0x10000 ? 0.6 : -0.6) * (1 - tap / (taps * 2));
    }
    // Equal energy for every size and decay: only the return level sets loudness.
    let energy = 0;
    for (let i = 0; i < length; i++) energy += pcm[i] * pcm[i];
    const scale = Math.sqrt(IMPULSE_ENERGY / Math.max(energy, 1e-12));
    for (let i = 0; i < length; i++) pcm[i] *= scale;
    return pcm;
  });
  const impulse = { key, length, sampleRate, channels };
  if (impulses.size >= 6) impulses.delete(impulses.keys().next().value);
  impulses.set(key, impulse);
  return impulse;
}

function reverbStage(raw, kit, state, live) {
  const { add, later, input, level, tone } = kit;
  const preDelay = add(raw.createDelay(0.25));
  preDelay.delayTime.value = state.current.preDelay / 1000;
  input.connect(preDelay);
  tone.output.connect(level);
  const slots = new Set();
  const addSlot = (initial) => {
    const impulse = reverbImpulse(raw.sampleRate, state.current.size, state.current.decay);
    const buffer = raw.createBuffer(2, impulse.length, raw.sampleRate);
    impulse.channels.forEach((pcm, channel) => buffer.getChannelData(channel).set(pcm));
    const convolver = raw.createConvolver();
    convolver.normalize = false; // before the buffer: normalization happens on assignment
    convolver.buffer = buffer;
    const gain = raw.createGain();
    gain.gain.value = initial;
    preDelay.connect(convolver).connect(gain).connect(tone.input);
    const slot = { convolver, gain, key: impulse.key, until: 0 };
    slots.add(slot);
    return slot;
  };
  const retire = (slot) => {
    // Never cut a branch whose fade the (possibly suspended) audio clock has not played.
    if (!kit.disposed() && raw.state !== 'closed' && raw.currentTime < slot.until) {
      later(() => retire(slot), 100);
      return;
    }
    preDelay.disconnect(slot.convolver);
    slot.convolver.disconnect();
    slot.gain.disconnect();
    slots.delete(slot);
  };
  let active = addSlot(1),
    pending = null,
    lastSwap = -Infinity;
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  const swap = () => {
    pending = null;
    if (kit.disposed() || reverbImpulseKey(raw.sampleRate, state.current) === active.key) return;
    lastSwap = clock();
    const at = raw.currentTime,
      previous = active;
    active = addSlot(0);
    for (const [slot, from, to] of [
      [active, 0, 1],
      [previous, 1, 0],
    ]) {
      slot.gain.gain.cancelScheduledValues(at);
      slot.gain.gain.setValueAtTime(from, at);
      slot.gain.gain.linearRampToValueAtTime(to, at + CROSSFADE);
    }
    previous.until = at + CROSSFADE;
    later(() => retire(previous), CROSSFADE * 1000 + 50);
  };
  // Building an impulse costs milliseconds; a dragged knob coalesces to the
  // latest size/decay at most every IMPULSE_INTERVAL_MS.
  const requestImpulse = () => {
    if (pending) return;
    const wait = lastSwap + IMPULSE_INTERVAL_MS - clock();
    if (wait <= 0) swap();
    else pending = later(swap, wait);
  };
  return {
    apply(next, previous, at, set) {
      set(preDelay.delayTime, next.preDelay / 1000, at);
      if (next.size === previous.size && next.decay === previous.decay) return;
      if (live) requestImpulse();
      else {
        const replaced = active;
        active = addSlot(1);
        retire(replaced);
      }
    },
    retempo() {},
    dispose() {
      for (const slot of slots) {
        slot.convolver.disconnect();
        slot.gain.disconnect();
      }
      slots.clear();
    },
  };
}

function delayStage(raw, kit, state, live) {
  const { add, gain, input, level, toneStage } = kit;
  const initial = state.current;
  const wet = gain(1);
  wet.connect(level);
  // Stereo repeats: every repeat passes the tone stage once more.
  const straightIn = gain(initial.pingPong ? 0 : 1),
    straight = add(raw.createDelay(MAX_RETURN_DELAY)),
    straightTone = toneStage(),
    straightFeedback = gain(initial.feedback / 100);
  input.connect(straightIn).connect(straight).connect(straightTone.input);
  straightTone.output.connect(straightFeedback).connect(straight);
  straightTone.output.connect(wet);
  // Ping-pong: a mono sum alternates left, right, left... Each junction sums at
  // most two inputs, so offline renders do not depend on fan-in order.
  const pingIn = gain(initial.pingPong ? 1 : 0);
  pingIn.channelCount = 1;
  pingIn.channelCountMode = 'explicit';
  const left = add(raw.createDelay(MAX_RETURN_DELAY)),
    right = add(raw.createDelay(MAX_RETURN_DELAY)),
    leftTone = toneStage(),
    rightTone = toneStage(),
    cross = gain(initial.feedback / 100),
    back = gain(initial.feedback / 100),
    merge = add(raw.createChannelMerger(2));
  input.connect(pingIn).connect(left).connect(leftTone.input);
  leftTone.output.connect(merge, 0, 0);
  leftTone.output.connect(cross).connect(right).connect(rightTone.input);
  rightTone.output.connect(merge, 0, 1);
  rightTone.output.connect(back).connect(left);
  merge.connect(wet);
  const delays = [straight, left, right];
  const setTime = (at, immediate) => {
    const seconds = returnDelaySeconds(state.current.division, state.tempo);
    for (const delay of delays)
      if (immediate) delay.delayTime.value = seconds;
      else {
        delay.delayTime.cancelScheduledValues(at);
        delay.delayTime.setTargetAtTime(seconds, at, 0.05);
      }
  };
  setTime(0, true);
  return {
    tones: [straightTone, leftTone, rightTone],
    apply(next, previous, at, set) {
      for (const node of [straightFeedback, cross, back]) set(node.gain, next.feedback / 100, at);
      set(straightIn.gain, next.pingPong ? 0 : 1, at);
      set(pingIn.gain, next.pingPong ? 1 : 0, at);
      if (next.division !== previous.division) setTime(at, !live);
    },
    retempo(at) {
      setTime(at, !live);
    },
    dispose() {},
  };
}

// `live` buses glide every change and crossfade impulse swaps; static (export)
// buses take exact values at once. Raw nodes only, so one graph serves the live
// context and an OfflineAudioContext alike.
export function createReturnBus(raw, bus, params, { bpm = 120, live = false } = {}) {
  const nodes = [],
    timers = new Set();
  let disposed = false;
  const state = {
    current: normalizeReturnBus(bus, params),
    tempo: Number(bpm) > 0 && Number.isFinite(Number(bpm)) ? Number(bpm) : 120,
  };
  const add = (node) => {
    nodes.push(node);
    return node;
  };
  const gain = (value = 1) => {
    const node = add(raw.createGain());
    node.gain.value = value;
    return node;
  };
  const toneStage = () => {
    const [low, high] = ['lowpass', 'highpass'].map((type) => {
      const node = add(raw.createBiquadFilter());
      node.type = type;
      node.Q.value = Math.SQRT1_2;
      return node;
    });
    low.connect(high);
    return { input: low, output: high, low, high };
  };
  const later = (callback, ms) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, ms);
    timers.add(timer);
    return timer;
  };
  const set = (param, value, at) => {
    if (!live) param.value = value;
    else {
      param.cancelScheduledValues(at);
      param.setTargetAtTime(value, at, 0.012);
    }
  };
  const input = gain(1),
    level = gain(percentGain(state.current.level)),
    mute = gain(state.current.muted ? 0 : 1);
  level.connect(mute);
  const tone = bus === 'a' ? toneStage() : null;
  const kit = { add, gain, later, input, level, tone, toneStage, disposed: () => disposed };
  const stage = (bus === 'a' ? reverbStage : delayStage)(raw, kit, state, live);
  const tones = stage.tones || [tone];
  const applyTone = (value, at, immediate) => {
    const { lowpass, highpass } = returnToneFrequencies(value);
    for (const { low, high } of tones)
      for (const [param, frequency] of [
        [low.frequency, lowpass],
        [high.frequency, highpass],
      ])
        if (immediate) param.value = frequency;
        else set(param, frequency, at);
  };
  applyTone(state.current.tone, 0, true);
  return {
    bus,
    input,
    output: mute,
    get params() {
      return { ...state.current };
    },
    get tempo() {
      return state.tempo;
    },
    update(params, at = raw.currentTime) {
      const previous = state.current;
      state.current = normalizeReturnBus(bus, params, previous);
      stage.apply(state.current, previous, at, set);
      applyTone(state.current.tone, at, !live);
      set(level.gain, percentGain(state.current.level), at);
      set(mute.gain, state.current.muted ? 0 : 1, at);
    },
    setTempo(value, at = raw.currentTime) {
      const next = Number(value);
      if (!(next > 0) || !Number.isFinite(next) || next === state.tempo) return;
      state.tempo = next;
      stage.retempo(at);
    },
    tail() {
      return returnTail(bus, state.current, state.tempo);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      stage.dispose();
      for (const node of nodes) node.disconnect();
    },
  };
}
