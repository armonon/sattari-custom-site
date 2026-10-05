// Pocket pattern model: plain data, pure helpers. The same timing functions
// drive live playback and the offline WAV render, so exports match what plays.

export const STEPS = 16;
export const STORAGE_KEY = 'sattari-pocket-patterns-v1';
export const MAX_SAVED = 40;

export const DRUM_TRACKS = [
  { id: 'kick', label: 'Kick', color: '#d6b36d' },
  { id: 'snare', label: 'Snare', color: '#ff8a80' },
  { id: 'clap', label: 'Clap', color: '#ffb36b' },
  { id: 'hat', label: 'Hat', color: '#9fd8ff' },
  { id: 'open', label: 'Open', color: '#7cc4ff' },
  { id: 'rim', label: 'Rim', color: '#c4a7ff' },
];
export const BASS_TRACK = { id: 'bass', label: 'Bass', color: '#00e68a' };
export const ALL_TRACKS = [...DRUM_TRACKS, BASS_TRACK];

export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALES = {
  minor: { label: 'Minor', steps: [0, 2, 3, 5, 7, 8, 10] },
  minorPentatonic: { label: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  dorian: { label: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10] },
  major: { label: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
};
export const BASS_ROWS = 8;

export const LIMITS = { bpm: [60, 180], swing: [0, 0.6], volume: [0, 1], cutoff: [120, 4000] };

const clamp = (value, [min, max], fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Semitone offsets above the root for each bass row, lowest first. */
export function bassRowSemitones(scale = 'minor') {
  const steps = (Object.hasOwn(SCALES, scale) ? SCALES[scale] : SCALES.minor).steps;
  return Array.from(
    { length: BASS_ROWS },
    (_, row) => steps[row % steps.length] + 12 * Math.floor(row / steps.length)
  );
}

export function bassRowLabels(key, scale) {
  return bassRowSemitones(scale).map((semi) => KEYS[(key + semi) % 12]);
}

/** Bass pitch: row 0 is the root in octave 1 (A = 55 Hz). */
export function bassFrequency(key, scale, row) {
  const midi = 24 + key + bassRowSemitones(scale)[row];
  return 440 * 2 ** ((midi - 69) / 12);
}

export const stepDuration = (bpm) => 60 / bpm / 4;
export const barDuration = (bpm) => (60 / bpm) * 4;

/** Seconds from the start of the bar to `step`, with swing delaying off-beat 16ths. */
export function stepTime(step, bpm, swing) {
  const duration = stepDuration(bpm);
  return step * duration + (step % 2 ? swing * duration : 0);
}

/** Bass notes with lengths: each lasts until the next note (wrapping), at most 4 steps. */
export function bassNotes(pattern) {
  const steps = pattern.bass
    .map((row, step) => (row === null ? null : { step, row }))
    .filter(Boolean);
  return steps.map((note, index) => {
    const next = steps[(index + 1) % steps.length];
    let gap = next.step - note.step;
    if (gap <= 0) gap += STEPS;
    return { ...note, length: Math.min(4, gap) };
  });
}

const emptySteps = () => Array(STEPS).fill(false);
const fromString = (text) => text.split('').map((c) => c === 'x');

export function emptyPattern(name = 'Untitled') {
  return {
    version: 1,
    name,
    bpm: 92,
    swing: 0.15,
    key: 9,
    scale: 'minor',
    cutoff: 900,
    drums: Object.fromEntries(DRUM_TRACKS.map(({ id }) => [id, emptySteps()])),
    bass: Array(STEPS).fill(null),
    volume: Object.fromEntries(ALL_TRACKS.map(({ id }) => [id, 0.8])),
    muted: Object.fromEntries(ALL_TRACKS.map(({ id }) => [id, false])),
  };
}

/** An original starter groove (written for Pocket; no samples involved). */
export function starterPattern() {
  const pattern = emptyPattern('Starter groove');
  pattern.drums.kick = fromString('x.....x...x..x..');
  pattern.drums.snare = fromString('....x.......x...');
  pattern.drums.clap = fromString('............x...');
  pattern.drums.hat = fromString('x.x.x.x.x.x.x.xx');
  pattern.drums.open = fromString('.......x........');
  pattern.drums.rim = fromString('...x......x.....');
  pattern.bass = [0, null, null, 0, null, null, 2, null, null, null, 4, null, 3, null, 2, null];
  pattern.volume.hat = 0.55;
  pattern.volume.open = 0.5;
  pattern.volume.rim = 0.5;
  pattern.volume.clap = 0.6;
  return pattern;
}

/** Coerces untrusted data (storage, older versions) into a valid pattern. */
export function normalizePattern(raw) {
  const base = emptyPattern();
  if (!raw || typeof raw !== 'object') return base;
  const steps = (value) =>
    Array.from({ length: STEPS }, (_, i) => Boolean(Array.isArray(value) && value[i]));
  return {
    version: 1,
    name: String(raw.name || base.name).slice(0, 60),
    bpm: Math.round(clamp(raw.bpm, LIMITS.bpm, base.bpm)),
    swing: clamp(raw.swing, LIMITS.swing, base.swing),
    key: Math.round(clamp(raw.key, [0, 11], base.key)),
    scale: Object.hasOwn(SCALES, raw.scale) ? raw.scale : base.scale,
    cutoff: clamp(raw.cutoff, LIMITS.cutoff, base.cutoff),
    drums: Object.fromEntries(DRUM_TRACKS.map(({ id }) => [id, steps(raw.drums?.[id])])),
    bass: Array.from({ length: STEPS }, (_, i) => {
      const row = Array.isArray(raw.bass) ? raw.bass[i] : null;
      return Number.isInteger(row) && row >= 0 && row < BASS_ROWS ? row : null;
    }),
    volume: Object.fromEntries(
      ALL_TRACKS.map(({ id }) => [id, clamp(raw.volume?.[id], LIMITS.volume, 0.8)])
    ),
    muted: Object.fromEntries(ALL_TRACKS.map(({ id }) => [id, Boolean(raw.muted?.[id])])),
  };
}

export function trackHasNotes(pattern, id) {
  return id === 'bass' ? pattern.bass.some((row) => row !== null) : pattern.drums[id].some(Boolean);
}

// ---- saved patterns (localStorage) ----

export function listSaved(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizePattern) : [];
  } catch {
    return [];
  }
}

/** Saves by name (replacing a pattern with the same name), newest first. */
export function savePattern(storage, pattern) {
  const clean = normalizePattern(pattern);
  const others = listSaved(storage).filter((item) => item.name !== clean.name);
  const next = [clean, ...others].slice(0, MAX_SAVED);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteSaved(storage, name) {
  const next = listSaved(storage).filter((item) => item.name !== name);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/**
 * Wraps audio that rings past the loop end back onto the start, so the file
 * repeats seamlessly (a cymbal ringing over the bar line is heard on repeat).
 */
export function foldTail(channels, loopFrames) {
  return channels.map((data) => {
    const out = new Float32Array(loopFrames);
    out.set(data.subarray(0, Math.min(loopFrames, data.length)));
    for (let i = loopFrames; i < data.length; i++) out[i % loopFrames] += data[i];
    return out;
  });
}

/** Mix = sum of stems; one shared gain keeps the mix under full scale so stems still sum to it. */
export function mixStems(stems, ceiling = 0.98) {
  const frames = stems[0]?.channels[0]?.length || 0;
  const channelCount = stems[0]?.channels.length || 2;
  const mix = Array.from({ length: channelCount }, () => new Float32Array(frames));
  for (const stem of stems)
    stem.channels.forEach((data, c) => {
      for (let i = 0; i < frames; i++) mix[c][i] += data[i];
    });
  let peak = 0;
  for (const data of mix) for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peak > ceiling ? ceiling / peak : 1;
  if (gain !== 1) {
    for (const data of mix) for (let i = 0; i < frames; i++) data[i] *= gain;
    for (const stem of stems)
      for (const data of stem.channels) for (let i = 0; i < frames; i++) data[i] *= gain;
  }
  return { mix, gain, peak };
}

/** An AudioBuffer-shaped object, accepted by wavBytes(). */
export function bufferLike(channels, sampleRate) {
  return {
    numberOfChannels: channels.length,
    length: channels[0]?.length || 0,
    sampleRate,
    getChannelData: (index) => channels[index],
  };
}
