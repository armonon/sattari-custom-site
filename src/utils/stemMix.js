// Shared mix contract for separated stems. The synchronized preview and the
// "Download my mix" render both call laneGain(), so what is heard is what is
// exported. Keep this file free of React and Web Audio so it is testable and
// usable from any page or worker.
import { wavBytes } from './arrangementExport.js';

export const MIX_STEM_IDS = ['vocals', 'drums', 'bass', 'other'];
export const MIN_GAIN = 0;
export const MAX_GAIN = 2; // about +6 dB per part
export const MIN_MASTER = 0;
export const MAX_MASTER = 1.5;
export const CLIP_SAFE_PEAK = 10 ** (-1 / 20); // -1 dBFS

// Practice presets are plain settings on the supported stems. With the
// four-stem model "other" is the residual instruments stem; a vocal-free
// backing track is therefore drums + bass + other, not "other" alone.
export const MIX_PRESETS = [
  {
    id: 'all',
    label: 'All parts',
    detail: 'Every separated part at its original level.',
    muted: [],
  },
  {
    id: 'no-vocals',
    label: 'Vocal backing track',
    detail: 'Drums, bass and other instruments without the vocal.',
    muted: ['vocals'],
  },
  {
    id: 'no-drums',
    label: 'Drum practice',
    detail: 'Vocals, bass and other instruments. Play the drums yourself.',
    muted: ['drums'],
  },
  {
    id: 'no-bass',
    label: 'Bass practice',
    detail: 'Vocals, drums and other instruments. Play the bass yourself.',
    muted: ['bass'],
  },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

/** A neutral mix for the given stem ids: everything audible at unity. */
export function createMix(ids) {
  return {
    lanes: Object.fromEntries(ids.map((id) => [id, { muted: false, solo: false, gain: 1 }])),
    master: 1,
  };
}

/** Return a sanitized copy (finite, clamped, only known lanes). */
export function normalizeMix(mix, ids = Object.keys(mix?.lanes || {})) {
  const lanes = {};
  for (const id of ids) {
    const lane = mix?.lanes?.[id] || {};
    lanes[id] = {
      muted: Boolean(lane.muted),
      solo: Boolean(lane.solo),
      gain: clamp(finite(lane.gain, 1), MIN_GAIN, MAX_GAIN),
    };
  }
  return { lanes, master: clamp(finite(mix?.master, 1), MIN_MASTER, MAX_MASTER) };
}

/**
 * The one rule for preview and export:
 * - a muted lane is never audible (mute wins over solo);
 * - if any unmuted lane is soloed, only soloed lanes are audible;
 * - an audible lane plays at lane gain x master gain.
 */
export function laneGain(mix, id) {
  const lane = mix?.lanes?.[id];
  if (!lane || lane.muted) return 0;
  const soloing = Object.values(mix.lanes).some((other) => other.solo && !other.muted);
  if (soloing && !lane.solo) return 0;
  return (
    clamp(finite(lane.gain, 1), MIN_GAIN, MAX_GAIN) * clamp(finite(mix.master, 1), 0, MAX_MASTER)
  );
}

export function audibleLanes(mix) {
  return Object.keys(mix?.lanes || {}).filter((id) => laneGain(mix, id) > 0);
}

export function applyPreset(mix, presetId) {
  const preset = MIX_PRESETS.find((item) => item.id === presetId);
  if (!preset) return mix;
  return {
    master: mix.master,
    lanes: Object.fromEntries(
      Object.keys(mix.lanes).map((id) => [
        id,
        { muted: preset.muted.includes(id), solo: false, gain: 1 },
      ])
    ),
  };
}

export function soloMix(mix, soloId) {
  return {
    master: mix.master,
    lanes: Object.fromEntries(
      Object.keys(mix.lanes).map((id) => [
        id,
        {
          muted: id === soloId ? false : mix.lanes[id].muted,
          solo: id === soloId,
          gain: mix.lanes[id].gain,
        },
      ])
    ),
  };
}

/** Which preset the current settings correspond to, or 'solo:<id>' / 'custom'. */
export function describeMix(mix) {
  const ids = Object.keys(mix?.lanes || {});
  const lanes = ids.map((id) => mix.lanes[id]);
  const soloed = ids.filter((id) => mix.lanes[id].solo && !mix.lanes[id].muted);
  if (soloed.length === 1 && lanes.every((lane) => lane.gain === 1))
    return { id: `solo:${soloed[0]}`, audible: audibleLanes(mix) };
  if (!soloed.length && lanes.every((lane) => lane.gain === 1 && !lane.solo)) {
    const muted = ids.filter((id) => mix.lanes[id].muted).sort();
    const preset = MIX_PRESETS.find(
      (item) =>
        item.muted
          .filter((id) => ids.includes(id))
          .sort()
          .join() === muted.join() &&
        // A preset needs its kept parts present; "no-vocals" over a drums-only
        // result is just "custom".
        ids.length - muted.length > 0
    );
    if (preset) return { id: preset.id, audible: audibleLanes(mix) };
  }
  return { id: 'custom', audible: audibleLanes(mix) };
}

export const gainToDb = (gain) => (gain > 0 ? 20 * Math.log10(gain) : -Infinity);
export const formatDb = (db) =>
  Number.isFinite(db)
    ? `${db > 0 ? '+' : db < 0 ? '−' : ''}${Math.abs(db).toFixed(1)} dB`
    : '−∞ dB';

export class MixError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MixError';
    this.code = code;
  }
}

/**
 * Parse a PCM or IEEE-float WAV without resampling (Web Audio's
 * decodeAudioData resamples to the context rate; an export must not).
 */
export function parseWav(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const tag = (offset) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
  if (view.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE')
    throw new MixError('format', 'This stem is not a WAV file.');
  let offset = 12;
  let format = null;
  let data = null;
  while (offset + 8 <= view.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      let code = view.getUint16(body, true);
      const channels = view.getUint16(body + 2, true);
      const sampleRate = view.getUint32(body + 4, true);
      const bits = view.getUint16(body + 14, true);
      if (code === 0xfffe && size >= 40) code = view.getUint16(body + 24, true);
      format = { code, channels, sampleRate, bits };
    } else if (id === 'data') {
      data = { offset: body, size: Math.min(size, view.byteLength - body) };
    }
    offset = body + size + (size % 2);
  }
  if (!format || !data) throw new MixError('format', 'This WAV file is incomplete.');
  const { code, channels, sampleRate, bits } = format;
  const bytes = bits / 8;
  if (!channels || !sampleRate || ![1, 3].includes(code) || ![16, 24, 32].includes(bits))
    throw new MixError('format', 'Unsupported WAV encoding.');
  if (code === 3 && bits !== 32) throw new MixError('format', 'Unsupported float WAV encoding.');
  const frames = Math.floor(data.size / (bytes * channels));
  const out = Array.from({ length: channels }, () => new Float32Array(frames));
  let at = data.offset;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      let value;
      if (code === 3) value = view.getFloat32(at, true);
      else if (bits === 16) value = view.getInt16(at, true) / 32768;
      else if (bits === 24) {
        let raw = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getUint8(at + 2) << 16);
        if (raw & 0x800000) raw -= 0x1000000;
        value = raw / 8388608;
      } else value = view.getInt32(at, true) / 2147483648;
      out[channel][frame] = value;
      at += bytes;
    }
  }
  return { sampleRate, channels: out, bitsPerSample: bits, float: code === 3 };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Two channels from mono or stereo input (mono feeds both sides equally). */
const stereo = (channels) => [channels[0], channels[1] || channels[0]];

/**
 * Render the audible stems to one stereo PCM pair.
 *
 * sources: { [stemId]: { channels: Float32Array[], sampleRate } }
 * options.headroom: 'none' keeps the summed level as-is (32-bit float keeps
 *   peaks above 0 dBFS); 'prevent-clipping' lowers the whole mix so the peak
 *   is at most -1 dBFS (never raises it).
 * The mix is snapshotted at start, so later setting changes never alter a
 * running export. Sources of different lengths are padded with silence to
 * the longest; frames are never truncated.
 */
export async function renderMix(sources, mixInput, options = {}) {
  const { signal, onProgress = () => {}, headroom = 'none', chunkFrames = 1 << 16 } = options;
  const mix = normalizeMix(structuredClone(mixInput));
  const ids = Object.keys(mix.lanes).filter((id) => sources[id]);
  const active = ids
    .map((id) => ({ id, gain: laneGain(mix, id), channels: stereo(sources[id].channels) }))
    .filter((lane) => lane.gain > 0);
  if (!active.length)
    throw new MixError(
      'silent',
      'Every part is muted or at zero, so the mix would be silent. Unmute a part first.'
    );
  const rates = new Set(ids.map((id) => sources[id].sampleRate));
  if (rates.size !== 1)
    throw new MixError('rate', 'These stems have different sample rates and cannot be mixed.');
  const [sampleRate] = rates;
  const frames = Math.max(...ids.map((id) => sources[id].channels[0].length));
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  let peak = 0;
  for (let start = 0; start < frames; start += chunkFrames) {
    signal?.throwIfAborted();
    const end = Math.min(frames, start + chunkFrames);
    for (const lane of active) {
      const [l, r] = lane.channels;
      const stop = Math.min(end, l.length);
      for (let i = start; i < stop; i++) {
        left[i] += l[i] * lane.gain;
        right[i] += r[i] * lane.gain;
      }
    }
    for (let i = start; i < end; i++) {
      const value = Math.max(Math.abs(left[i]), Math.abs(right[i]));
      if (!Number.isFinite(value))
        throw new MixError('invalid', 'The mix contains invalid samples. Export cancelled.');
      if (value > peak) peak = value;
    }
    onProgress(end / frames);
    if (end < frames) await tick();
  }
  signal?.throwIfAborted();
  let outputGain = 1;
  if (headroom === 'prevent-clipping' && peak > CLIP_SAFE_PEAK) {
    outputGain = CLIP_SAFE_PEAK / peak;
    for (let i = 0; i < frames; i++) {
      left[i] *= outputGain;
      right[i] *= outputGain;
    }
  }
  const finalPeak = peak * outputGain;
  let overs = 0;
  if (finalPeak > 1)
    for (let i = 0; i < frames; i++) if (Math.abs(left[i]) > 1 || Math.abs(right[i]) > 1) overs++;
  return {
    channels: [left, right],
    sampleRate,
    frames,
    mix,
    audible: active.map((lane) => lane.id),
    sourcePeak: peak,
    peak: finalPeak,
    peakDb: gainToDb(finalPeak),
    outputGain,
    outputGainDb: gainToDb(outputGain),
    overFrames: overs,
    headroom,
  };
}

/** Exact peak of the current settings without allocating a full render. */
export async function mixPeak(sources, mixInput, { signal, chunkFrames = 1 << 16 } = {}) {
  const mix = normalizeMix(mixInput);
  const active = Object.keys(mix.lanes)
    .filter((id) => sources[id])
    .map((id) => ({ gain: laneGain(mix, id), channels: stereo(sources[id].channels) }))
    .filter((lane) => lane.gain > 0);
  if (!active.length) return 0;
  const frames = Math.max(...active.map((lane) => lane.channels[0].length));
  let peak = 0;
  for (let start = 0; start < frames; start += chunkFrames) {
    signal?.throwIfAborted();
    const end = Math.min(frames, start + chunkFrames);
    for (let i = start; i < end; i++) {
      let l = 0;
      let r = 0;
      for (const lane of active) {
        if (i < lane.channels[0].length) {
          l += lane.channels[0][i] * lane.gain;
          r += lane.channels[1][i] * lane.gain;
        }
      }
      const value = Math.max(Math.abs(l), Math.abs(r));
      if (value > peak) peak = value;
    }
    if (end < frames) await tick();
  }
  return peak;
}

export const MIX_FORMATS = {
  float32: { label: 'WAV · 32-bit float · 44.1 kHz stereo', float: true, ext: 'wav' },
  pcm24: { label: 'WAV · 24-bit PCM · 44.1 kHz stereo', float: false, ext: 'wav' },
  aac: { label: 'M4A · AAC 192 kbps · smaller, for phones', compressed: true, ext: 'm4a' },
};

/**
 * Restrict sources to [start, end) seconds as zero-copy views, for exporting
 * just the A–B loop. Every stem is cut at the same frames, so alignment holds.
 */
export function sliceSources(sources, start, end) {
  return Object.fromEntries(
    Object.entries(sources).map(([id, source]) => {
      const from = Math.max(0, Math.round(start * source.sampleRate));
      const to = Math.max(from, Math.round(end * source.sampleRate));
      return [
        id,
        {
          ...source,
          channels: source.channels.map((channel) =>
            channel.subarray(Math.min(from, channel.length), Math.min(to, channel.length))
          ),
        },
      ];
    })
  );
}

const stamp = (seconds) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m${String(whole % 60).padStart(2, '0')}s`;
};

/** Encode a renderMix() result with the site's existing WAV encoder. */
export function mixWavBlob(render, format = 'float32') {
  const [left, right] = render.channels;
  const bytes = wavBytes(
    {
      numberOfChannels: 2,
      length: render.frames,
      sampleRate: render.sampleRate,
      getChannelData: (index) => (index ? right : left),
    },
    MIX_FORMATS[format]?.float ?? true
  );
  return new Blob([bytes], { type: 'audio/wav' });
}

const SUFFIX = {
  all: 'full',
  'no-vocals': 'no-vocals',
  'no-drums': 'drumless',
  'no-bass': 'bassless',
};

/**
 * File name that says what the mix contains, e.g. "song-drumless-mix.wav" or
 * "song-drumless-loop-0m12s-0m20s.m4a".
 */
export function mixFileName(trackName, mix, { ext = 'wav', range = null } = {}) {
  const { id } = describeMix(mix);
  const label =
    SUFFIX[id] ||
    (id.startsWith('solo:')
      ? `${id.slice(5) === 'other' ? 'instruments' : id.slice(5)}-solo`
      : 'custom');
  return range
    ? `${trackName}-${label}-loop-${stamp(range.start)}-${stamp(range.end)}.${ext}`
    : `${trackName}-${label}-mix.${ext}`;
}
