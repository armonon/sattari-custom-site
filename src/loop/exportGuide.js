import { downloadLesson, noteName } from './music.js';
import { openStrings, profileLabel, profileNotes, profileChord } from './guitarProfile';
import { groupAttacks, voiceGuitar } from './harmony.js';

export function polyphonicText(lesson, profile = lesson.guitarProfile) {
  if (!lesson.polyphonicNotes) return '';
  const tuning = openStrings(profile);
  const lines = [
    'CHORD TONES — DRAFT',
    'Attack times in seconds; simultaneous notes share a column.',
    `Suggested positions in ${profileLabel(profile).toLowerCase()}; frets relative to capo. Verify by ear. Sustains may overlap.`,
    '',
  ];
  for (const group of groupAttacks(lesson.polyphonicNotes)) {
    const voicing = voiceGuitar(group.notes, tuning);
    lines.push(
      `${group.start.toFixed(2)}s  ${group.notes.map((n) => `${noteName(n.midi)} (${n.start.toFixed(2)}–${n.end.toFixed(2)}s)`).join(', ')}`
    );
    if (voicing)
      for (let string = 5; string >= 0; string--)
        lines.push(
          `${noteName(tuning[string]).replace(/\d/g, '')}|--${String(voicing.find((n) => n.string === string)?.fret ?? '-').padStart(2, '-')}--|`
        );
    else lines.push('No playable six-string shape: review the detected pitches.');
    lines.push('');
  }
  return lines.join('\n');
}

export function downloadPracticeGuide(lesson, profile = lesson.guitarProfile) {
  return [
    downloadLesson(
      { ...lesson, notes: profileNotes(lesson.notes, profile) },
      {
        strings: openStrings(profile).map((n) => noteName(n).replace(/\d/g, '')),
        label: `${profileLabel(profile)} · frets relative to capo · sounding pitches preserved`,
        shapeFor: (name) => profileChord(name, profile),
      }
    ),
    polyphonicText(lesson, profile),
  ]
    .filter(Boolean)
    .join('\n\n');
}

// Standard MIDI file, type 0. Constant 120 BPM / 480 PPQ preserves source seconds
// without imposing the uncertain beat grid on polyphonic notes.
export function midiGuide(lesson) {
  const notes = lesson.polyphonicNotes ?? lesson.notes;
  const events = [];
  notes.forEach((n) => {
    if (
      !Number.isInteger(n.midi) ||
      n.midi < 0 ||
      n.midi > 127 ||
      !Number.isFinite(n.start) ||
      !Number.isFinite(n.end) ||
      n.start < 0 ||
      n.end <= n.start
    )
      return;
    events.push({ tick: Math.round(n.start * 960), type: 0x90, midi: n.midi });
    events.push({
      tick: Math.max(Math.round(n.start * 960) + 1, Math.round(n.end * 960)),
      type: 0x80,
      midi: n.midi,
    });
  });
  events.sort((a, b) => a.tick - b.tick || a.type - b.type || a.midi - b.midi);
  const variable = (number) => {
    let n = number,
      out = [n & 127];
    while ((n = Math.floor(n / 128)) > 0) out.unshift((n & 127) | 128);
    return out;
  };
  const track = [0, 0xff, 0x51, 3, 7, 0xa1, 0x20, 0, 0xc0, 24];
  let previous = 0;
  for (const event of events) {
    track.push(
      ...variable(event.tick - previous),
      event.type,
      event.midi,
      event.type === 0x90 ? 88 : 0
    );
    previous = event.tick;
  }
  track.push(0, 0xff, 0x2f, 0);
  const header = [
    77,
    84,
    104,
    100,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    1,
    224,
    77,
    84,
    114,
    107,
    (track.length >>> 24) & 255,
    (track.length >>> 16) & 255,
    (track.length >>> 8) & 255,
    track.length & 255,
  ];
  return new Uint8Array([...header, ...track]);
}
