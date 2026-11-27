// Reference pages generated from the same theory the Key & BPM tool uses:
// one page per key (/keys/c-major) and one per tempo (/bpm/120). Every value
// on a page is computed here, so the pages and the tool cannot disagree.
import { camelot } from '../labs/keybpm/keyBpm';
import {
  compatibleKeys,
  conventionalKey,
  conventionalKeyLabel,
  diatonicChords,
  scaleNotes,
  tonicFrequency,
} from '../labs/keybpm/keyTheory';

const ANALYZER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_ALIAS = { 'C#': 'D♭', 'D#': 'E♭', 'F#': 'G♭', 'G#': 'A♭', 'A#': 'B♭' };
const SHARP_ALIAS = { 'C#': 'C♯', 'D#': 'D♯', 'F#': 'F♯', 'G#': 'G♯', 'A#': 'A♯' };
const slugify = (label) =>
  label.toLowerCase().replace('♯', '-sharp').replace('♭', '-flat').replace(' ', '-');
const title = (label) =>
  label.replace(/ (major|minor)$/, (_, mode) => ` ${mode[0].toUpperCase()}${mode.slice(1)}`);

// Progressions as scale degrees (0-based) with their usual numerals.
const MAJOR_PROGRESSIONS = [
  ['I – V – vi – IV', [0, 4, 5, 3]],
  ['I – IV – V', [0, 3, 4]],
  ['ii – V – I', [1, 4, 0]],
  ['I – vi – IV – V', [0, 5, 3, 4]],
  ['vi – IV – I – V', [5, 3, 0, 4]],
];
const MINOR_PROGRESSIONS = [
  ['i – VI – III – VII', [0, 5, 2, 6]],
  ['i – iv – v', [0, 3, 4]],
  ['i – VII – VI – VII', [0, 6, 5, 6]],
  ['i – iv – VII – III', [0, 3, 6, 2]],
  ['ii° – v – i', [1, 4, 0]],
];

function keyPage(root, mode) {
  const key = `${ANALYZER[root]} ${mode}`;
  const label = conventionalKeyLabel(key);
  const { tonic } = conventionalKey(key);
  const notes = scaleNotes(key);
  const chords = diatonicChords(key);
  const sharps = notes.filter((note) => note.includes('♯')).length;
  const flats = notes.filter((note) => note.includes('♭')).length;
  const minor = mode === 'minor';
  // The other common spelling of the same pitches, if the tonic is a black key.
  const sharpName = SHARP_ALIAS[ANALYZER[root]];
  const alias = sharpName
    ? `${tonic === sharpName ? FLAT_ALIAS[ANALYZER[root]] : sharpName} ${mode}`
    : null;
  const parallel = `${ANALYZER[root]} ${minor ? 'major' : 'minor'}`;
  return {
    key,
    label,
    name: title(label),
    slug: slugify(label),
    path: `/keys/${slugify(label)}`,
    mode,
    tonic,
    camelot: camelot(key),
    notes,
    chords,
    signature: sharps
      ? `${sharps} sharp${sharps === 1 ? '' : 's'}`
      : flats
        ? `${flats} flat${flats === 1 ? '' : 's'}`
        : 'no sharps or flats',
    alias,
    relative: `${ANALYZER[(root + (minor ? 3 : 9)) % 12]} ${minor ? 'major' : 'minor'}`,
    parallel,
    mixes: compatibleKeys(key),
    tonicHz: Math.round(tonicFrequency(key, 3) * 100) / 100,
    progressions: (minor ? MINOR_PROGRESSIONS : MAJOR_PROGRESSIONS).map(([numerals, degrees]) => ({
      numerals,
      chords: degrees.map((degree) => chords[degree].name),
    })),
  };
}

export const keyPages = ['major', 'minor'].flatMap((mode) =>
  ANALYZER.map((_, root) => keyPage(root, mode))
);
const byKey = new Map(keyPages.map((page) => [page.key, page]));
const bySlug = new Map(keyPages.map((page) => [page.slug, page]));
export const keyPageFor = (key) => byKey.get(key) || null;
export const keyPageBySlug = (slug) => bySlug.get(slug) || null;

// People type "B flat major" and "Bb major" as well as B♭ major.
export const plainKeyName = (page) => page.name.replace('♯', ' Sharp').replace('♭', ' Flat');
export function keyTitle(page) {
  const other = page.mode === 'minor' ? 'Major' : 'Minor';
  const plain = plainKeyName(page);
  return plain === page.name
    ? `${page.name}: Notes, Chords, Relative ${other} & Camelot ${page.camelot}`
    : `${page.name} (${plain}): Notes, Chords & Camelot ${page.camelot}`;
}
export function keyDescription(page) {
  return `${page.name} has the notes ${page.notes.join(' ')} and the chords ${page.chords
    .map((chord) => chord.name)
    .join(', ')}. Relative key ${conventionalKeyLabel(page.relative)}, Camelot ${page.camelot}.`;
}

// ---- Tempo pages ----------------------------------------------------------

export const BPM_PAGE_MIN = 40;
export const BPM_PAGE_MAX = 220;

// Conventional Italian markings. Sources draw the boundaries differently, so
// the pages call these approximate.
const MARKINGS = [
  [40, 'Grave', 'very slow and solemn'],
  [45, 'Largo', 'broad and slow'],
  [60, 'Larghetto', 'rather slow'],
  [66, 'Adagio', 'slow and at ease'],
  [76, 'Andante', 'walking pace'],
  [108, 'Moderato', 'moderate'],
  [120, 'Allegro', 'fast and bright'],
  [156, 'Vivace', 'lively'],
  [176, 'Presto', 'very fast'],
  [200, 'Prestissimo', 'as fast as possible'],
];
export function tempoMarking(bpm) {
  const [from, name, meaning] = [...MARKINGS].reverse().find(([start]) => bpm >= start);
  const next = MARKINGS[MARKINGS.findIndex(([start]) => start === from) + 1];
  return { name, meaning, from, to: next ? next[0] - 1 : BPM_PAGE_MAX };
}

// Rough, overlapping ranges for where styles usually sit. A guide, not a rule.
const STYLES = [
  ['Ballads', 56, 76],
  ['Reggae', 60, 90],
  ['Hip-hop and boom bap', 80, 100],
  ['R&B and soul', 60, 90],
  ['Pop', 96, 130],
  ['Funk and disco', 100, 126],
  ['House', 118, 130],
  ['Techno and trance', 126, 145],
  ['Rock', 110, 150],
  ['Trap (counted in double time)', 130, 170],
  ['Dubstep (felt in half time)', 138, 142],
  ['Punk and metal', 150, 220],
  ['Drum and bass', 165, 180],
];
export const tempoStyles = (bpm) =>
  STYLES.filter(([, from, to]) => bpm >= from && bpm <= to).map(([name]) => name);

const round = (value, places = 1) => Math.round(value * 10 ** places) / 10 ** places;
const NOTE_VALUES = [
  ['Whole note (1/1)', 4],
  ['Half note (1/2)', 2],
  ['Quarter note (1/4)', 1],
  ['Eighth note (1/8)', 0.5],
  ['Sixteenth note (1/16)', 0.25],
  ['Thirty-second note (1/32)', 0.125],
];

export function bpmPage(bpm) {
  if (!Number.isInteger(bpm) || bpm < BPM_PAGE_MIN || bpm > BPM_PAGE_MAX) return null;
  const beatMs = 60000 / bpm;
  const inRange = (value) =>
    Number.isInteger(value) && value >= BPM_PAGE_MIN && value <= BPM_PAGE_MAX ? value : null;
  return {
    bpm,
    path: `/bpm/${bpm}`,
    beatMs: round(beatMs),
    barSeconds: round((beatMs * 4) / 1000, 2),
    beatsPerSecond: round(bpm / 60, 2),
    barsPerMinute: round(bpm / 4, 2),
    marking: tempoMarking(bpm),
    styles: tempoStyles(bpm),
    half: inRange(bpm / 2),
    halfValue: round(bpm / 2),
    double: inRange(bpm * 2),
    doubleValue: bpm * 2,
    previous: inRange(bpm - 1),
    next: inRange(bpm + 1),
    // Delay, pre-delay and LFO times: straight, dotted (×1.5) and triplet (×2/3).
    noteValues: NOTE_VALUES.map(([name, beats]) => ({
      name,
      ms: round(beatMs * beats),
      dottedMs: round(beatMs * beats * 1.5),
      tripletMs: round((beatMs * beats * 2) / 3),
      hz: round(1000 / (beatMs * beats), 2),
    })),
    phrases: [8, 16, 32].map((bars) => ({ bars, seconds: round((beatMs * 4 * bars) / 1000) })),
  };
}

export const bpmPages = Array.from({ length: BPM_PAGE_MAX - BPM_PAGE_MIN + 1 }, (_, index) =>
  bpmPage(BPM_PAGE_MIN + index)
);
export const bpmTitle = (page) => `${page.bpm} BPM: Metronome, Delay Times & Milliseconds per Beat`;
export const bpmDescription = (page) =>
  `At ${page.bpm} BPM one beat lasts ${page.beatMs} ms and a 4/4 bar ${page.barSeconds} s. Play a ${page.bpm} BPM click and get delay times, half and double time and the tempo marking.`;

export const referencePaths = [
  '/keys',
  '/bpm',
  ...keyPages.map((page) => page.path),
  ...bpmPages.map((page) => page.path),
];
