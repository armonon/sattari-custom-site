// Deck, lane and pad factories plus the normalisation applied to every saved,
// imported or new session. Pure functions only: no engine or React access.
import { normalizeInserts, normalizeSends } from '../mixer/mixerModel';

export const DECK_SEEDS = [
  { id: 'A', accent: '#4ad9c4', side: 'left' },
  { id: 'B', accent: '#4a9eff', side: 'right' },
  { id: 'C', accent: '#b47aff', side: 'left' },
  { id: 'D', accent: '#e8a54a', side: 'right' },
];

export const DECK_IDS = DECK_SEEDS.map((seed) => seed.id);

export const LANE_DEFINITIONS = [
  { id: 'fullMix', label: 'Full mix' },
  { id: 'drums', label: 'Drums' },
  { id: 'bass', label: 'Bass' },
  { id: 'music', label: 'Music' },
  { id: 'vocals', label: 'Vocals' },
];

export const STEM_IDS = ['drums', 'bass', 'music', 'vocals'];

const PAD_SEEDS = [
  ['Kick', 72, '#26d9ff'],
  ['Snare', 180, '#62f5c8'],
  ['Hat', 420, '#4a90e2'],
  ['Clap', 260, '#9b7bff'],
  ['Low', 110, '#ffb020'],
  ['Rise', 760, '#e0742b'],
  ['Perc', 330, '#e03030'],
  ['Tone', 610, '#d44fc8'],
];

const AUTOMATION_DEFAULTS = {
  volume: [
    { position: 0, value: 100 },
    { position: 1, value: 100 },
  ],
  filter: [
    { position: 0, value: 50 },
    { position: 1, value: 50 },
  ],
  reverb: [
    { position: 0, value: 15 },
    { position: 1, value: 15 },
  ],
};

export function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function createLane(definition) {
  return {
    ...definition,
    assetId: '',
    name: '',
    level: 100,
    muted: false,
    solo: false,
    pitch: 0,
    duration: 0,
    status: 'empty',
  };
}

export function createArrangement(duration = 0) {
  return {
    enabled: true,
    start: 0,
    trimStart: 0,
    trimEnd: Math.max(0, duration),
    gain: 100,
    fadeIn: 0,
    fadeOut: 0,
    automationTarget: 'volume',
    automation: Object.fromEntries(
      Object.entries(AUTOMATION_DEFAULTS).map(([target, points]) => [
        target,
        points.map((point) => ({ ...point })),
      ])
    ),
  };
}

function createDeck(seed) {
  return {
    ...seed,
    cfSide: seed.side,
    title: 'Empty deck',
    keyName: '--',
    sourceKeyName: '--',
    bpm: 120,
    beatOffset: 0,
    downbeat: 1,
    gain: 100,
    fader: 100,
    pitch: 0,
    filter: 50,
    eq: { low: 50, mid: 50, high: 50 },
    fx: { reverb: 15, echo: 0, macro: 0 },
    stemFx: Object.fromEntries(
      STEM_IDS.map((stemId) => [stemId, { filter: 50, send: 0, pitch: 0 }])
    ),
    looping: false,
    loopStart: 0,
    loopEnd: 2.5,
    synced: false,
    keyLock: true,
    liveKey: false,
    slip: false,
    tempoInterpretation: 'Straight',
    syncMode: 'BPM',
    activeToolTab: 'CUES',
    hotCues: Array(8).fill(null),
    introEnd: null,
    outroStart: null,
    muted: false,
    solo: false,
    // Return sends and the insert chain restore with the session; headphone cue starts off.
    sends: { a: 0, b: 0 },
    inserts: [],
    cue: false,
    playing: false,
    duration: 0,
    waveform: Array.from({ length: 96 }, (_, index) => 10 + ((index * 17) % 18)),
    analysis: null,
    arrangement: createArrangement(),
    lanes: Object.fromEntries(
      LANE_DEFINITIONS.map((definition) => [definition.id, createLane(definition)])
    ),
  };
}

function normalizeAutomationPoints(points, fallback) {
  const normalized = (Array.isArray(points) && points.length ? points : fallback)
    .map((point) => ({
      position: clampNumber(point?.position, 0, 1),
      value: Number(point?.value) || 0,
    }))
    .sort((a, b) => a.position - b.position);
  return normalized.length > 1 ? normalized : fallback.map((point) => ({ ...point }));
}

function normalizeArrangement(saved, duration = 0) {
  const base = createArrangement(duration);
  if (duration <= 0) {
    return {
      ...base,
      ...saved,
      trimStart: 0,
      trimEnd: 0,
      automation: Object.fromEntries(
        Object.entries(AUTOMATION_DEFAULTS).map(([target, fallback]) => [
          target,
          normalizeAutomationPoints(saved?.automation?.[target], fallback),
        ])
      ),
    };
  }
  const trimStart = clampNumber(saved?.trimStart, 0, Math.max(0, duration - 0.05));
  const savedTrimEnd = Number(saved?.trimEnd);
  const trimEnd = clampNumber(
    savedTrimEnd > 0 ? savedTrimEnd : duration,
    Math.min(duration, trimStart + 0.05),
    Math.max(duration, trimStart + 0.05)
  );
  return {
    ...base,
    ...saved,
    enabled: saved?.enabled !== false,
    start: Math.max(0, Number(saved?.start) || 0),
    trimStart,
    trimEnd,
    gain: clampNumber(saved?.gain ?? 100, 0, 200),
    fadeIn: clampNumber(saved?.fadeIn, 0, Math.max(0, trimEnd - trimStart)),
    fadeOut: clampNumber(saved?.fadeOut, 0, Math.max(0, trimEnd - trimStart)),
    automationTarget: ['volume', 'filter', 'reverb'].includes(saved?.automationTarget)
      ? saved.automationTarget
      : 'volume',
    automation: Object.fromEntries(
      Object.entries(AUTOMATION_DEFAULTS).map(([target, fallback]) => [
        target,
        normalizeAutomationPoints(saved?.automation?.[target], fallback),
      ])
    ),
  };
}

export function normalizeDeck(saved, index) {
  const base = createDeck(DECK_SEEDS[index]);
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    id: base.id,
    playing: false,
    cue: false,
    accent: base.accent,
    activeToolTab:
      saved.activeToolTab === 'CUE'
        ? 'CUES'
        : saved.activeToolTab === 'SRC' || saved.activeToolTab === 'SYNC'
          ? 'STEMS'
          : saved.activeToolTab || base.activeToolTab,
    sourceKeyName: saved.sourceKeyName || saved.keyName || base.sourceKeyName,
    eq: { ...base.eq, ...saved.eq },
    fx: { ...base.fx, ...saved.fx },
    sends: normalizeSends(saved.sends),
    inserts: normalizeInserts(saved.inserts),
    hotCues: Array.from({ length: 8 }, (_, cueIndex) => saved.hotCues?.[cueIndex] ?? null),
    stemFx: Object.fromEntries(
      STEM_IDS.map((stemId) => [stemId, { ...base.stemFx[stemId], ...saved.stemFx?.[stemId] }])
    ),
    lanes: Object.fromEntries(
      LANE_DEFINITIONS.map((definition) => [
        definition.id,
        { ...base.lanes[definition.id], ...saved.lanes?.[definition.id] },
      ])
    ),
    arrangement: normalizeArrangement(saved.arrangement, saved.duration || base.duration),
  };
}

/** Four decks with stable A-D identities, whatever the saved list contains. */
export function normalizeDecks(savedDecks) {
  return DECK_SEEDS.map((_, index) => normalizeDeck(savedDecks?.[index], index));
}

export function createEmptyDecks() {
  return DECK_SEEDS.map(createDeck);
}

export function createPads(saved = []) {
  return PAD_SEEDS.map(([name, frequency, accent], index) => ({
    name,
    frequency,
    accent,
    gain: 82,
    assetId: '',
    ...saved[index],
  }));
}

export function stemIdForFile(file, fallbackIndex) {
  const name = file.name.toLowerCase();
  return STEM_IDS.find((stemId) => name.includes(stemId)) || STEM_IDS[fallbackIndex % 4];
}

export function keyPitchClass(keyName) {
  const root = String(keyName).match(/^[A-G](?:#|b)?/)?.[0];
  const pitchClasses = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
  };
  return root ? pitchClasses[root] : undefined;
}

export function nearestSemitoneShift(from, to) {
  const distance = ((to - from + 18) % 12) - 6;
  return distance === -6 ? 6 : distance;
}

export function buildMidiPattern(kind, bpm) {
  if (kind === 'drums') {
    return Array.from({ length: 16 }, (_, step) => ({
      pitch: step % 4 === 0 ? 'C4' : step % 4 === 2 ? 'D4' : 'F#4',
      step,
      velocity: step % 4 === 0 ? 112 : 84,
    }));
  }
  return ['C4', 'E4', 'G4', 'B4', 'G4', 'E4', 'D4', 'G4'].map((pitch, index) => ({
    pitch,
    step: index * 2,
    velocity: 78 + ((bpm + index * 7) % 32),
  }));
}

/** A deck is loaded once any lane has audio or is still decoding. */
export function deckIsFree(deck) {
  return (
    !deck.duration &&
    !Object.values(deck.lanes).some((lane) => lane.status === 'loading' || lane.duration > 0)
  );
}
