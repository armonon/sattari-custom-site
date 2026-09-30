import { NOTE_NAMES, TUNING } from './music.js';

export const CHORD_TYPES = [
  { suffix: '', intervals: [0, 4, 7], label: 'major' },
  { suffix: 'm', intervals: [0, 3, 7], label: 'minor' },
  { suffix: '7', intervals: [0, 4, 7, 10], label: 'dominant seventh' },
  { suffix: 'maj7', intervals: [0, 4, 7, 11], label: 'major seventh' },
  { suffix: 'm7', intervals: [0, 3, 7, 10], label: 'minor seventh' },
  { suffix: 'sus2', intervals: [0, 2, 7], label: 'suspended second' },
  { suffix: 'sus4', intervals: [0, 5, 7], label: 'suspended fourth' },
  { suffix: '5', intervals: [0, 7], label: 'power chord' },
];

// Cluster strummed attacks without allowing the group to grow indefinitely.
export function groupAttacks(notes, tolerance = 0.12) {
  const groups = [];
  for (const note of [...notes].sort((a, b) => a.start - b.start || a.midi - b.midi)) {
    let group = groups.at(-1);
    if (!group || note.start - group.start > tolerance) {
      group = { start: note.start, end: note.end, notes: [] };
      groups.push(group);
    }
    group.notes.push(note);
    group.end = Math.max(group.end, note.end);
  }
  return groups;
}

// Assign a whole attack jointly. A guitar cannot sound two frets on one string,
// and a suggested shape should fit a hand. Reject impossible groups explicitly.
export function voiceGuitar(notes, tuning = TUNING) {
  const unique = [...new Map(notes.map((n) => [n.midi, n])).values()];
  if (unique.length > 6 || !unique.length) return null;
  const choices = unique.map((note) =>
    tuning.flatMap((open, string) => {
      const fret = note.midi - open;
      return fret >= 0 && fret <= 20 ? [{ ...note, string, fret }] : [];
    })
  );
  let best = null,
    bestCost = Infinity;
  const search = (i, selected, strings) => {
    if (i === choices.length) {
      const held = selected.filter((n) => n.fret > 0).map((n) => n.fret);
      const span = held.length ? Math.max(...held) - Math.min(...held) : 0;
      if (span > 4) return;
      const cost = selected.reduce((sum, n) => sum + n.fret, 0) + span * 3;
      if (cost < bestCost) {
        best = [...selected];
        bestCost = cost;
      }
      return;
    }
    for (const note of choices[i]) {
      if (strings & (1 << note.string)) continue;
      search(i + 1, [...selected, note], strings | (1 << note.string));
    }
  };
  search(0, [], 0);
  return best?.sort((a, b) => a.string - b.string) || null;
}

export function chordFromNotes(notes) {
  const classes = new Set(notes.map((n) => ((n.midi % 12) + 12) % 12));
  if (classes.size < 2) return null;
  const bass = Math.min(...notes.map((n) => n.midi)) % 12;
  const matches = [];
  for (let root = 0; root < 12; root++)
    for (const type of CHORD_TYPES) {
      const tones = type.intervals.map((interval) => (interval + root) % 12);
      // Abstain on missing thirds, extensions we cannot name, or unexplained tones.
      if (classes.size === tones.length && tones.every((tone) => classes.has(tone)))
        matches.push({ name: NOTE_NAMES[root] + type.suffix, root, bass });
    }
  if (!matches.length) return null;
  const rooted = matches.filter((item) => item.root === bass);
  if (matches.length > 1 && rooted.length !== 1) return null;
  const chosen = rooted[0] || matches[0];
  return { ...chosen, bassName: NOTE_NAMES[bass], inversion: chosen.root !== bass };
}

export function chordsFromPolyphonic(notes, duration, bpm) {
  const chords = [];
  const step = Math.max(0.2, 60 / bpm);
  for (let start = 0; start < duration; start += step) {
    const end = Math.min(duration, start + step);
    // Require substantial overlap. A very short passing tone must not rename a chord.
    const sounding = notes.filter(
      (n) => Math.min(n.end, end) - Math.max(n.start, start) >= Math.min(0.12, (end - start) * 0.35)
    );
    const chord = chordFromNotes(sounding);
    if (!chord) continue;
    const confidence = sounding.reduce((sum, n) => sum + n.confidence, 0) / sounding.length;
    const previous = chords.at(-1);
    if (
      previous?.name === chord.name &&
      previous.bass === chord.bass &&
      Math.abs(previous.end - start) < 0.01
    )
      previous.end = end;
    else chords.push({ ...chord, start, end, confidence, method: 'note-evidence' });
  }
  return chords;
}

export function coveredDuration(notes) {
  let total = 0,
    end = 0;
  for (const n of [...notes].sort((a, b) => a.start - b.start)) {
    total += Math.max(0, n.end - Math.max(end, n.start));
    end = Math.max(end, n.end);
  }
  return total;
}
