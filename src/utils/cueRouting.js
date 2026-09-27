import { percentGain } from './mixerReturns';

// Monitoring only. Nothing here feeds the program bus, recorder, analysers or
// exports; cue settings are never journaled.
export const CUE_MODES = Object.freeze(['off', 'split', 'multichannel']);
export const DEFAULT_CUE = Object.freeze({ mode: 'off', mix: 0, level: 80 });
export const CUE_FADE = 0.02;
const SETTLE_MS = 40; // after a fade, before re-routing or reconfiguring the device

// Tone's context is a standardized-audio-context wrapper, which does not expose
// setSinkId/sinkId; those live on the native context it wraps.
export function nativeAudioContext(raw) {
  return raw?._nativeAudioContext || raw;
}

export function outputCapabilities(raw) {
  const native = nativeAudioContext(raw);
  const maxChannelCount = Number(raw?.destination?.maxChannelCount) || 0;
  return {
    maxChannelCount,
    multichannel: maxChannelCount >= 4,
    sinkSelectable: typeof native?.setSinkId === 'function',
    sinkId: typeof native?.sinkId === 'string' ? native.sinkId : '',
  };
}

// Ramp from the value actually sounding, never from a stale target (no clicks).
export function glide(param, value, at, seconds = CUE_FADE) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(at);
  else {
    param.cancelScheduledValues(at);
    param.setValueAtTime(param.value, at);
  }
  param.linearRampToValueAtTime(value, at + seconds);
}

// Headphones = cue x (1 - mix) + program x mix, times the cue level.
export function headphoneGains({ mix, level }) {
  const blend = Math.min(100, Math.max(0, Number(mix) || 0)) / 100;
  return { cue: 1 - blend, program: blend, level: percentGain(level) };
}

export function normalizeCue(value, current = DEFAULT_CUE) {
  const input = value && typeof value === 'object' ? value : {};
  const number = (key) => {
    const raw = input[key];
    const parsed =
      typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '') ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : current[key];
  };
  return {
    mode: CUE_MODES.includes(input.mode) ? input.mode : current.mode,
    mix: number('mix'),
    level: number('level'),
  };
}

const configure = (node, count, mode, interpretation) => {
  node.channelCount = count;
  node.channelCountMode = mode;
  node.channelInterpretation = interpretation;
  return node;
};

// Routes: 'off' = monitor -> speakers (today's path); 'split' = left: mono
// program monitor, right: mono headphones; 'multichannel' = program 1/2 and
// headphones 3/4 on a >= 4-channel device. Changes fade, then re-route.
export class CueRouter {
  constructor({ raw, program, monitor, cue, speaker, speakers, connect, disconnect }) {
    Object.assign(this, { raw, program, monitor, cue, speaker, speakers, connect, disconnect });
    this.state = { ...DEFAULT_CUE };
    this.mode = 'off';
    this.generation = 0;
    this.timers = new Set();
    this.connected = { split: false, multichannel: false };
  }
  get available() {
    return !!this.speaker;
  }
  capabilities() {
    return outputCapabilities(this.raw);
  }
  later(callback, ms = SETTLE_MS) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, ms);
    this.timers.add(timer);
  }
  build() {
    if (this.nodes) return this.nodes;
    const { raw } = this;
    const gain = (value) => {
      const node = raw.createGain();
      node.gain.value = value;
      return node;
    };
    const gains = headphoneGains(this.state);
    const n = {
      headCue: gain(gains.cue),
      headProgram: gain(gains.program),
      headphones: gain(gains.level),
      splitProgram: configure(gain(1), 1, 'explicit', 'speakers'),
      splitHeadphones: configure(gain(1), 1, 'explicit', 'speakers'),
      splitMerge: raw.createChannelMerger(2),
      split: gain(0),
      multiProgram: configure(gain(1), 2, 'explicit', 'speakers'),
      multiHeadphones: configure(gain(1), 2, 'explicit', 'speakers'),
      programSplitter: raw.createChannelSplitter(2),
      headphoneSplitter: raw.createChannelSplitter(2),
      multiMerge: raw.createChannelMerger(4),
      multichannel: configure(gain(0), 4, 'explicit', 'discrete'),
    };
    this.connect(this.cue, n.headCue);
    this.connect(this.program, n.headProgram);
    n.headCue.connect(n.headphones);
    n.headProgram.connect(n.headphones);
    this.connect(this.monitor, n.splitProgram);
    n.splitProgram.connect(n.splitMerge, 0, 0);
    n.headphones.connect(n.splitHeadphones).connect(n.splitMerge, 0, 1);
    n.splitMerge.connect(n.split);
    this.connect(this.monitor, n.multiProgram);
    n.multiProgram.connect(n.programSplitter);
    n.headphones.connect(n.multiHeadphones).connect(n.headphoneSplitter);
    n.programSplitter.connect(n.multiMerge, 0, 0);
    n.programSplitter.connect(n.multiMerge, 1, 1);
    n.headphoneSplitter.connect(n.multiMerge, 0, 2);
    n.headphoneSplitter.connect(n.multiMerge, 1, 3);
    n.multiMerge.connect(n.multichannel);
    this.nodes = n;
    return n;
  }
  route(mode) {
    return mode === 'off' ? this.speaker.gain : this.nodes?.[mode]?.gain;
  }
  // Only the active route reaches the device. An idle route is disconnected,
  // so 'off' is exactly the original speaker path and the cue bus is not pulled.
  attachRoute(mode, attached) {
    if (mode === 'off' || this.connected[mode] === attached) return;
    const node = this.nodes[mode],
      target = mode === 'split' ? this.speakers : this.raw.destination;
    if (attached) this.connect(node, target);
    else this.disconnect(node, target);
    this.connected[mode] = attached;
  }
  configureDestination(multichannel) {
    const destination = this.raw.destination;
    const trySet = (key, value) => {
      try {
        destination[key] = value;
      } catch {
        /* Offline and some hardware destinations fix their channel layout. */
      }
    };
    if (multichannel) {
      this.savedDestination ??= {
        channelCount: destination.channelCount,
        channelCountMode: destination.channelCountMode,
        channelInterpretation: destination.channelInterpretation,
      };
      trySet('channelCount', 4);
      trySet('channelCountMode', 'explicit');
      trySet('channelInterpretation', 'discrete');
      return destination.channelCount >= 4;
    }
    const saved = this.savedDestination;
    if (!saved) return true;
    this.savedDestination = null;
    trySet('channelCount', saved.channelCount);
    trySet('channelCountMode', saved.channelCountMode);
    trySet('channelInterpretation', saved.channelInterpretation);
    return true;
  }
  set(value) {
    if (!this.available) {
      this.state = { ...normalizeCue(value, this.state), mode: 'off' };
      return 'off';
    }
    const next = normalizeCue(value, this.state);
    const now = this.raw.currentTime;
    if (this.nodes) {
      const gains = headphoneGains(next);
      glide(this.nodes.headCue.gain, gains.cue, now);
      glide(this.nodes.headProgram.gain, gains.program, now);
      glide(this.nodes.headphones.gain, gains.level, now);
    }
    this.state = next;
    const mode =
      next.mode === 'multichannel' && !this.capabilities().multichannel ? 'off' : next.mode;
    this.state.mode = mode;
    this.switchTo(mode);
    return mode;
  }
  switchTo(mode) {
    const previous = this.mode;
    if (mode === previous) return;
    this.mode = mode;
    const generation = ++this.generation,
      now = this.raw.currentTime;
    if (mode !== 'off') this.build();
    const reconfigure = (previous === 'multichannel') !== (mode === 'multichannel');
    for (const route of CUE_MODES) {
      const param = this.route(route);
      if (param) glide(param, !reconfigure && route === mode ? 1 : 0, now);
    }
    if (!reconfigure) {
      this.attachRoute(mode, true);
      this.later(() => {
        if (generation !== this.generation) return;
        for (const route of CUE_MODES) if (route !== mode) this.attachRoute(route, false);
      });
      return;
    }
    // A channel-layout change may restart the device: fade out first, then
    // reconfigure and fade the new route in.
    this.later(() => {
      if (generation !== this.generation) return;
      for (const route of CUE_MODES) if (route !== mode) this.attachRoute(route, false);
      if (mode === 'multichannel' && !this.configureDestination(true)) {
        this.configureDestination(false);
        this.mode = this.state.mode = 'off';
        glide(this.speaker.gain, 1, this.raw.currentTime);
        return;
      }
      if (mode !== 'multichannel') this.configureDestination(false);
      this.attachRoute(mode, true);
      glide(this.route(mode), 1, this.raw.currentTime);
    });
  }
  // Around an output-device switch: silence the active route, then restore it.
  duck() {
    if (!this.available) return;
    this.ducked = true;
    glide(this.route(this.mode), 0, this.raw.currentTime);
  }
  // After a device change: keep multichannel only if the new device takes four
  // channels (a switch may also reset the layout); otherwise fall back to 'off'.
  refresh() {
    if (!this.available) return 'off';
    const ducked = this.ducked;
    this.ducked = false;
    if (
      this.mode === 'multichannel' &&
      !(this.capabilities().multichannel && this.configureDestination(true))
    ) {
      this.state.mode = 'off';
      this.switchTo('off');
      return 'off';
    }
    if (ducked) glide(this.route(this.mode), 1, this.raw.currentTime);
    return this.mode;
  }
  dispose() {
    this.generation++;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    if (!this.nodes) return;
    // The engine may have torn its buses down first; a second disconnect throws.
    const release = (from, to) => {
      try {
        this.disconnect(from, to);
      } catch {
        // Already disconnected.
      }
    };
    for (const route of ['split', 'multichannel'])
      if (this.connected[route])
        release(this.nodes[route], route === 'split' ? this.speakers : this.raw.destination);
    this.connected = { split: false, multichannel: false };
    if (this.savedDestination) this.configureDestination(false);
    release(this.cue, this.nodes.headCue);
    release(this.program, this.nodes.headProgram);
    release(this.monitor, this.nodes.splitProgram);
    release(this.monitor, this.nodes.multiProgram);
    for (const node of Object.values(this.nodes)) node.disconnect();
    this.nodes = null;
  }
}
