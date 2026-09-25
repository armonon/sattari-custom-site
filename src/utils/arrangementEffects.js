// Browser editions: native Web Audio DSP, not the AU/VST binaries or their exact algorithms.
const p = (label, min, max, value, step = 1, unit = '') => ({ label, min, max, value, step, unit });
export const EFFECTS = {
  eq: {
    name: 'Sattari EQ',
    description: 'Three-band tone shaping',
    params: {
      low: p('Low', -18, 18, 0, 0.5, 'dB'),
      mid: p('Mid', -18, 18, 0, 0.5, 'dB'),
      high: p('High', -18, 18, 0, 0.5, 'dB'),
    },
  },
  comp: {
    name: 'Sattari Comp',
    description: 'Track dynamics',
    params: {
      threshold: p('Threshold', -60, 0, -18, 1, 'dB'),
      ratio: p('Ratio', 1, 12, 3, 0.1, ':1'),
      attack: p('Attack', 0.001, 0.1, 0.01, 0.001, 's'),
      release: p('Release', 0.02, 0.5, 0.15, 0.01, 's'),
    },
  },
  echo: {
    name: 'Sattari Echo',
    description: 'Stereo feedback delay',
    params: {
      time: p('Time', 0.03, 0.6, 0.25, 0.01, 's'),
      feedback: p('Feedback', 0, 0.5, 0.25, 0.01),
      mix: p('Mix', 0, 1, 0.2, 0.01),
    },
  },
  space: {
    name: 'Sattari Space',
    description: 'Deterministic stereo room reverb',
    params: { mix: p('Mix', 0, 1, 0.18, 0.01) },
  },
  heat: {
    name: 'Sattari Heat',
    description: 'Soft saturation with output trim',
    params: { drive: p('Drive', 1, 8, 1.5, 0.1), output: p('Output', -24, 0, -3, 0.5, 'dB') },
  },
  imager: {
    name: 'Sattari Image',
    description: 'Mid/side stereo width',
    params: { width: p('Width', 0, 2, 1, 0.05) },
  },
};
export function newEffect(type) {
  if (!Object.hasOwn(EFFECTS, type)) throw new Error('Unsupported browser effect.');
  return {
    id: crypto.randomUUID(),
    type,
    bypass: false,
    params: Object.fromEntries(
      Object.entries(EFFECTS[type].params).map(([key, value]) => [key, value.value])
    ),
  };
}
export const EFFECT_DRAG_TYPE = 'application/x-sattari-effects';
export function draggedEffects(transfer) {
  if (transfer?.files?.length)
    throw new Error(
      'Native AU/VST/CLAP files require a desktop host. Drag a built-in web effect from the device browser instead.'
    );
  const payload = transfer?.getData(EFFECT_DRAG_TYPE);
  if (!payload)
    throw new Error(
      'Drop an effect from the device browser. Instruments belong on instrument tracks.'
    );
  const types = JSON.parse(payload);
  if (!Array.isArray(types) || !types.length || types.length > 8)
    throw new Error('Unsupported effect drop.');
  return types.map(newEffect);
}

// Stable mix endpoints; insert crossfades must never overwrite track automation.
// Tail policy: replaced inserts (including echo/reverb tails) fade out in 25 ms.
// Cleanup timers only reclaim already-silent graphs, never determine audio timing.
export function createMutableEffectRack(raw, effects = []) {
  const input = raw.createGain(),
    output = raw.createGain();
  const nodes = [input, output],
    retired = new Set();
  let current = { rack: createEffectRack(raw, effects), from: 1, to: 1, at: 0 },
    timer,
    disposed = false;
  input.connect(current.rack.input);
  current.rack.output.connect(output);
  const level = (branch, now) =>
    branch.from + (branch.to - branch.from) * Math.min(1, Math.max(0, (now - branch.at) / 0.025));
  const fade = (branch, to, now) => {
    const from = level(branch, now),
      param = branch.rack.output.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(from, now);
    param.linearRampToValueAtTime(to, now + 0.025);
    Object.assign(branch, { from, to, at: now });
  };
  const retire = () => {
    clearTimeout(timer);
    for (const branch of retired) {
      if (!disposed && raw.state !== 'closed' && raw.currentTime < branch.at + 0.025) continue;
      input.disconnect(branch.rack.input);
      branch.rack.dispose();
      retired.delete(branch);
    }
    if (retired.size) timer = setTimeout(retire, 100);
  };
  return {
    input,
    output,
    nodes,
    mutable: true,
    get topology() {
      return current.rack.topology;
    },
    get automationBindings() {
      return current.rack.automationBindings;
    },
    schedule(next = [], at = raw.currentTime) {
      // Scheduling may change parameters, never allocate/swap the active graph early.
      if (rackTopology(next) !== current.rack.topology)
        throw new Error('Scheduled effects must preserve the active rack topology.');
      current.rack.update(next, at);
    },
    update(next = []) {
      if (disposed) throw new Error('This effect rack has been closed.');
      validateEffects(next);
      if (rackTopology(next) === current.rack.topology) {
        current.rack.update(next);
        return;
      }
      retire();
      // Bound even adversarial edits while the audio clock is suspended. Leave
      // the sounding rack intact if a caller exceeds this short-lived budget.
      if (retired.size >= 16) throw new Error('Effects are still changing. Try again in a moment.');
      const replacement = {
        rack: createEffectRack(raw, next),
        from: 0,
        to: 0,
        at: raw.currentTime,
      };
      const now = raw.currentTime;
      fade(replacement, 1, now);
      input.connect(replacement.rack.input);
      replacement.rack.output.connect(output);
      retired.add(current);
      // Rebase all audible branches: fast consecutive edits retain continuous
      // gain and a unity sum, rather than disconnecting the previous crossfade.
      for (const branch of retired) fade(branch, 0, now);
      current = replacement;
      clearTimeout(timer);
      timer = setTimeout(retire, 100);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      retire();
      current.rack.dispose();
      for (const node of nodes) node.disconnect();
    },
  };
}
export function validateEffects(effects = []) {
  if (!Array.isArray(effects) || effects.length > 8)
    throw new Error('Use up to eight effects per track.');
  const ids = new Set();
  for (const effect of effects) {
    const definition = Object.hasOwn(EFFECTS, effect?.type) ? EFFECTS[effect.type] : null;
    if (
      !definition ||
      typeof effect.id !== 'string' ||
      ids.has(effect.id) ||
      typeof effect.bypass !== 'boolean' ||
      !effect.params ||
      typeof effect.params !== 'object'
    )
      throw new Error('Unsupported or damaged track effect.');
    ids.add(effect.id);
    for (const [key, value] of Object.entries(effect.params)) {
      const range = Object.hasOwn(definition.params, key) ? definition.params[key] : null;
      if (!range || !Number.isFinite(value) || value < range.min || value > range.max)
        throw new Error('Invalid effect parameter.');
    }
  }
  return effects;
}
const values = (effect) =>
  Object.fromEntries(
    Object.entries(EFFECTS[effect.type].params).map(([key, spec]) => [
      key,
      effect.params[key] ?? spec.value,
    ])
  );
export const rackTopology = (effects = []) =>
  JSON.stringify(effects.map(({ id, type }) => [id, type]));
export function rackTail(effects = [], automation = {}) {
  return effects.reduce((sum, effect) => {
    if (effect.bypass) return sum;
    const v = values(effect);
    for (const key of ['time', 'feedback', 'mix'])
      if (automation[`fx:${effect.id}:${key}`]?.length)
        v[key] = Math.max(v[key] || 0, ...automation[`fx:${effect.id}:${key}`].map((p) => p.value));
    return (
      sum +
      (effect.type === 'space' && v.mix
        ? 1.8
        : effect.type === 'echo' && v.mix
          ? v.time * (1 + Math.ceil(Math.log(1e-5) / Math.log(Math.max(0.001, v.feedback))))
          : 0)
    );
  }, 0);
}
const impulses = new WeakMap();
function room(raw) {
  if (impulses.has(raw)) return impulses.get(raw);
  const buffer = raw.createBuffer(2, Math.ceil(raw.sampleRate * 1.8), raw.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    let seed = 711 + channel;
    const pcm = buffer.getChannelData(channel);
    for (let i = 0; i < pcm.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pcm[i] = (seed / 2147483648 - 1) * Math.exp((-8 * i) / pcm.length);
    }
  }
  impulses.set(raw, buffer);
  return buffer;
}
export function createEffectRack(raw, effects = []) {
  validateEffects(effects);
  const nodes = [],
    updates = [],
    automationBindings = {},
    input = raw.createGain(),
    output = raw.createGain();
  nodes.push(input, output);
  let previous = input;
  const add = (node) => {
    nodes.push(node);
    return node;
  };
  const gain = (value = 1) => {
    const node = add(raw.createGain());
    node.gain.value = value;
    return node;
  };
  const set = (param, value, at, immediate) => {
    if (immediate) param.value = value;
    else {
      param.cancelScheduledValues(at);
      param.setTargetAtTime(value, at, 0.015);
    }
  };
  try {
    for (const effect of effects) {
      let bypass = effect.bypass;
      const bind = (key, param, transform = (value) => value) => {
        (automationBindings[`fx:${effect.id}:${key}`] ||= []).push({ param, transform });
      };
      const inlet = gain(),
        dry = gain(),
        wet = gain(),
        outlet = gain();
      previous.connect(inlet);
      inlet.connect(dry).connect(outlet);
      wet.connect(outlet);
      let apply;
      if (effect.type === 'eq') {
        const filters = ['lowshelf', 'peaking', 'highshelf'].map((type, i) => {
          const f = add(raw.createBiquadFilter());
          f.type = type;
          f.frequency.value = [200, 1000, 5000][i];
          f.Q.value = 0.7;
          return f;
        });
        inlet.connect(filters[0]).connect(filters[1]).connect(filters[2]).connect(wet);
        ['low', 'mid', 'high'].forEach((key, i) => bind(key, filters[i].gain));
        apply = (v, at, immediate) =>
          ['low', 'mid', 'high'].forEach((key, i) => set(filters[i].gain, v[key], at, immediate));
      } else if (effect.type === 'comp') {
        const compressor = add(raw.createDynamicsCompressor());
        compressor.knee.value = 12;
        inlet.connect(compressor).connect(wet);
        Object.keys(values(effect)).forEach((key) => bind(key, compressor[key]));
        apply = (v, at, immediate) =>
          Object.entries(v).forEach(([key, value]) => set(compressor[key], value, at, immediate));
      } else if (effect.type === 'echo') {
        const delay = add(raw.createDelay(0.6)),
          feedback = gain();
        inlet.connect(delay).connect(wet);
        delay.connect(feedback).connect(delay);
        bind('time', delay.delayTime);
        bind('feedback', feedback.gain);
        apply = (v, at, immediate) => {
          set(delay.delayTime, v.time, at, immediate);
          set(feedback.gain, v.feedback, at, immediate);
        };
      } else if (effect.type === 'space') {
        const convolver = add(raw.createConvolver());
        convolver.buffer = room(raw);
        inlet.connect(convolver).connect(wet);
        apply = () => {};
      } else if (effect.type === 'heat') {
        const shaper = add(raw.createWaveShaper()),
          trim = gain(),
          drive = gain();
        const curve = Float32Array.from(
          { length: 2048 },
          (_, i) => Math.tanh((i / 2047) * 2 - 1) / Math.tanh(1)
        );
        shaper.curve = curve;
        shaper.oversample = '2x';
        inlet.connect(drive).connect(shaper).connect(trim).connect(wet);
        bind('drive', drive.gain);
        bind('output', trim.gain, (value) => 10 ** (value / 20));
        apply = (v, at, immediate) => {
          set(drive.gain, v.drive, at, immediate);
          set(trim.gain, 10 ** (v.output / 20), at, immediate);
        };
      } else {
        const split = add(raw.createChannelSplitter(2)),
          merge = add(raw.createChannelMerger(2));
        const ll = gain(),
          lr = gain(),
          rl = gain(),
          rr = gain();
        inlet.channelCount = 2;
        inlet.channelCountMode = 'explicit';
        inlet.connect(split);
        split.connect(ll, 0);
        split.connect(lr, 0);
        split.connect(rl, 1);
        split.connect(rr, 1);
        ll.connect(merge, 0, 0);
        rl.connect(merge, 0, 0);
        lr.connect(merge, 0, 1);
        rr.connect(merge, 0, 1);
        merge.connect(wet);
        for (const node of [ll, rr]) bind('width', node.gain, (value) => (1 + value) / 2);
        for (const node of [lr, rl]) bind('width', node.gain, (value) => (1 - value) / 2);
        apply = (v, at, immediate) => {
          for (const node of [ll, rr]) set(node.gain, (1 + v.width) / 2, at, immediate);
          for (const node of [lr, rl]) set(node.gain, (1 - v.width) / 2, at, immediate);
        };
      }
      updates.push((next, at, immediate) => {
        bypass = next.bypass;
        const v = values(next),
          mix = next.bypass ? 0 : (v.mix ?? 1);
        set(dry.gain, 1 - mix, at, immediate);
        set(wet.gain, mix, at, immediate);
        apply(v, at, immediate);
      });
      if ('mix' in values(effect)) {
        bind('mix', dry.gain, (value) => (bypass ? 1 : 1 - value));
        bind('mix', wet.gain, (value) => (bypass ? 0 : value));
      }
      previous = outlet;
    }
    previous.connect(output);
    const rack = {
      input,
      output,
      nodes,
      automationBindings,
      topology: rackTopology(effects),
      update(next, at = raw.currentTime, immediate = false) {
        validateEffects(next);
        if (rackTopology(next) !== this.topology)
          throw new Error('Pause playback to add, remove or reorder effects.');
        next.forEach((effect, i) => updates[i](effect, at, immediate));
      },
      dispose() {
        for (const node of nodes) node.disconnect();
      },
    };
    rack.update(effects, 0, true);
    return rack;
  } catch (error) {
    for (const node of nodes) node.disconnect();
    throw error;
  }
}

// Catalog filenames only. Never execute, decode, or upload native plugin binaries.
export function diskPluginInventory(files) {
  if (files.length > 20000) throw new Error('Choose a smaller plugin folder (up to 20,000 files).');
  const plugins = new Map();
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    const match = /(?:^|\/)([^/]+\.(vst3|component|vst|clap))(?=\/|$)/i.exec(path);
    if (!match) continue;
    const end = match.index + match[0].length,
      key = path.slice(0, end);
    plugins.set(key, {
      name: match[1].replace(/\.(vst3|component|vst|clap)$/i, ''),
      format: match[2].toLowerCase() === 'component' ? 'AU' : match[2].toUpperCase(),
      path: key,
    });
  }
  return [...plugins.values()];
}
