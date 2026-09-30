export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const TUNING = [40, 45, 50, 55, 59, 64];
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const CHORD_NAMES = NOTE_NAMES.flatMap((root) =>
  ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', '5'].map((suffix) => root + suffix)
);

export function noteName(midi) {
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function formatTime(seconds = 0) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function positionForMidi(midi, previous = null) {
  const options = TUNING.flatMap((open, string) => {
    const fret = midi - open;
    return fret >= 0 && fret <= 20 ? [{ string, fret }] : [];
  });
  options.sort((a, b) => {
    const cost = (p) =>
      p.fret * 0.25 +
      (previous
        ? Math.abs(p.fret - previous.fret) * 0.7 + Math.abs(p.string - previous.string) * 0.9
        : 0);
    return cost(a) - cost(b);
  });
  return options[0] || null;
}

const OPEN_CHORDS = {
  C: { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  D: { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  Dm: { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  E: { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  Em: { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  G: { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  A: { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  Am: { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  Cmaj7: { frets: [-1, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0] },
  A7: { frets: [-1, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0] },
  Am7: { frets: [-1, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0] },
  E7: { frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0] },
  Em7: { frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0] },
  D7: { frets: [-1, -1, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3] },
  Dsus2: { frets: [-1, -1, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 3, 0] },
  Dsus4: { frets: [-1, -1, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4] },
};

export function chordShape(name) {
  if (!CHORD_NAMES.includes(name)) return null;
  const [, rootName, suffix] = name.match(/^([A-G]#?)(.*)$/);
  const minor = suffix === 'm';
  const root = NOTE_NAMES.indexOf(rootName);
  const fullName = `${rootName} ${{ '': 'major', m: 'minor', 7: 'dominant seventh', maj7: 'major seventh', m7: 'minor seventh', sus2: 'suspended second', sus4: 'suspended fourth', 5: 'power chord' }[suffix]}`;
  if (OPEN_CHORDS[name]) return { ...OPEN_CHORDS[name], name, fullName, startFret: 1 };
  const eFret = (root - 4 + 12) % 12;
  const aFret = (root - 9 + 12) % 12;
  if (!['', 'm'].includes(suffix)) {
    const patterns = {
      7: [
        [0, 2, 0, 1, 0, 0],
        [1, 3, 1, 2, 1, 1],
      ],
      maj7: [
        [0, 2, 1, 1, 0, 0],
        [1, 4, 2, 3, 1, 1],
      ],
      m7: [
        [0, 2, 0, 0, 0, 0],
        [1, 3, 1, 1, 1, 1],
      ],
      sus2: [
        [-1, 0, 2, 2, 0, 0],
        [0, 1, 3, 4, 1, 1],
      ],
      sus4: [
        [0, 2, 2, 2, 0, 0],
        [1, 2, 3, 4, 1, 1],
      ],
      5: [
        [0, 2, 2, -1, -1, -1],
        [1, 3, 4, 0, 0, 0],
      ],
    };
    const base = suffix === 'sus2' ? aFret : eFret;
    const [frets, fingers] = patterns[suffix];
    return {
      name,
      fullName,
      startFret: Math.max(1, base),
      ...(base && suffix !== '5' ? { barre: [suffix === 'sus2' ? 1 : 0, 5, base] } : {}),
      frets: frets.map((f) => (f < 0 ? -1 : f + base)),
      fingers: fingers.map((f, i) => (frets[i] + base === 0 ? 0 : f)),
    };
  }
  if (aFret > 0 && aFret < eFret) {
    return {
      name,
      fullName,
      startFret: aFret,
      barre: [1, 5, aFret],
      frets: [-1, aFret, aFret + 2, aFret + 2, aFret + (minor ? 1 : 2), aFret],
      fingers: [0, 1, minor ? 3 : 2, minor ? 4 : 3, minor ? 2 : 4, 1],
    };
  }
  return {
    name,
    fullName,
    startFret: eFret || 1,
    barre: [0, 5, eFret],
    frets: [eFret, eFret + 2, eFret + 2, eFret + (minor ? 0 : 1), eFret, eFret],
    fingers: [1, 3, 4, minor ? 1 : 2, 1, 1],
  };
}

export function chordMidis(name) {
  const shape = chordShape(name);
  return shape
    ? shape.frets.flatMap((fret, string) => (fret < 0 ? [] : [TUNING[string] + fret]))
    : [];
}

const beat = 60 / 84;
const melody = [
  64, 67, 69, 67, 67, 71, 69, 67, 69, 72, 71, 69, 67, 64, 67, 64, 64, 67, 71, 69, 67, 64, 62, 64,
  67, 69, 71, 67, 66, 64, 62, 64,
];
export const DEMO = {
  id: 'night-shift',
  meter: 4,
  phraseStarts: [0, 8, 16, 24],
  title: 'Night shift',
  artist: 'An original Sattari Learn lesson',
  source: 'demo',
  audioUrl: '/audio/loop-night-shift.wav',
  bpm: 84,
  key: 'E minor',
  duration: melody.length * beat,
  notes: melody
    .map((midi, i) => ({
      midi,
      beatStart: i,
      beatDuration: 1,
      start: i * beat,
      end: (i + 0.88) * beat,
      confidence: 1,
      string: 5,
      fret: midi - 64 >= 0 ? midi - 64 : 0,
    }))
    .map((n) => (n.midi < 64 ? { ...n, ...positionForMidi(n.midi) } : n)),
  chords: ['Em', 'G', 'Am', 'C', 'Em', 'C', 'G', 'D'].map((name, i) => ({
    name,
    start: i * beat * 4,
    end: (i + 1) * beat * 4,
    confidence: 1,
  })),
  waveform: Array.from(
    { length: 128 },
    (_, i) => 0.12 + Math.exp(-(i % 4) * 0.75) * (0.6 + Math.sin(i * 1.8) * 0.2)
  ),
};

export function phrasesFor(lesson) {
  const notes = lesson.notes || [];
  if (!notes.length)
    return Array.from({ length: Math.max(1, Math.ceil(lesson.duration / 12)) }, (_, i) => ({
      start: i * 12,
      end: Math.min((i + 1) * 12, lesson.duration),
      notes: [],
    }));
  // Authored melodies use musical boundaries. Imports use short practice chunks;
  // an estimated beat grid must not masquerade as an authored phrase structure.
  const starts =
    lesson.phraseStarts?.filter((index) => index < notes.length) ||
    Array.from({ length: Math.ceil(notes.length / 8) }, (_, i) => i * 8);
  return starts.map((offset, i) => {
    const next = starts[i + 1] ?? notes.length;
    const group = notes.slice(offset, next);
    return {
      start: i === 0 ? lesson.practiceStart || 0 : group[0].start,
      end: notes[next]?.start ?? lesson.duration,
      notes: group.map((note, j) => ({ ...note, index: offset + j })),
    };
  });
}

export function activeIndex(items, time) {
  if (!items.length) return -1;
  let lo = 0,
    hi = items.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (items[mid].start <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function downloadLesson(lesson, setup = {}) {
  const strings = setup.strings || STRING_NAMES;
  const shapeFor = setup.shapeFor || chordShape;
  const rows = [
    'SATTARI LEARN — ' + lesson.title,
    setup.label || 'Standard tuning: E A D G B e',
    `${lesson.bpm} BPM · ${lesson.key}`,
    lesson.source === 'demo'
      ? lesson.category === 'classic'
        ? 'Sattari teaching arrangement — suggested chord accompaniment'
        : 'Original practice lesson'
      : lesson.source === 'score'
        ? 'Imported written score — verify alignment with your recording.'
        : 'Estimated transcription — review against the recording.',
    '',
    'CHORD CHART',
  ];
  lesson.chords.forEach((c) => {
    const shape = shapeFor(c.name);
    rows.push(
      `${formatTime(c.start)}–${formatTime(c.end)}  ${c.name.padEnd(4)}  ${shape ? shape.frets.map((f) => (f < 0 ? 'x' : f)).join(' ') : 'No comfortable shape for this setup'}  (string 6 → string 1)`
    );
  });
  rows.push('', 'TABLATURE — times shown above each note');
  for (const phrase of phrasesFor(lesson)) {
    rows.push('', '  ' + phrase.notes.map((n) => formatTime(n.start).padStart(6)).join(''));
    for (let s = 5; s >= 0; s--)
      rows.push(
        `${strings[s]}|` +
          phrase.notes
            .map((n) =>
              n.string === s ? String(n.fret).padStart(3, '-').padEnd(6, '-') : '------'
            )
            .join('') +
          '|'
      );
  }
  if (lesson.notes.some((n) => n.unplayable))
    rows.push(
      'Some pitches cannot be played with this setup and are omitted from the tab. Change your capo or tuning.'
    );
  return rows.join('\n');
}
