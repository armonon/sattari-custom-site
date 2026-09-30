// Keep notated duration separate from the shorter sounding envelope in the audio.
// Imported recordings have an explicitly approximate sixteenth-note grid.
const VALUES = [
  [4, 'w'],
  [3, 'hd'],
  [2, 'h'],
  [1.5, 'qd'],
  [1, 'q'],
  [0.75, '8d'],
  [0.5, '8'],
  [0.25, '16'],
];
const quantize = (beats) => Math.round(beats * 4) / 4;

// Chord slices preserve each note's release with ties as other pitches enter or
// leave. This is a quantized draft, not inferred independent rhythmic voices.
export function polyphonicScoreMeasures(notes, bpm, meter = 4) {
  if (!notes.length || !Number.isFinite(bpm) || bpm <= 0) return [];
  const sources = notes
    .filter(
      (n) =>
        Number.isInteger(n.midi) &&
        Number.isFinite(n.start) &&
        Number.isFinite(n.end) &&
        n.end > n.start
    )
    .map((n, index) => {
      const start = Math.max(0, quantize((n.start * bpm) / 60));
      return {
        midi: n.midi,
        index: n.index ?? index,
        source: index,
        start,
        end: Math.max(start + 0.25, quantize((n.end * bpm) / 60)),
      };
    });
  if (!sources.length) return [];
  sources.sort((a, b) => a.start - b.start);
  sources.forEach((source, index) => {
    const next = sources.slice(index + 1).find((n) => n.midi === source.midi);
    if (next) source.end = Math.min(source.end, next.start);
  });
  const first = Math.floor(Math.min(...sources.map((n) => n.start)) / meter) * meter;
  const boundaries = [...new Set([first, ...sources.flatMap((n) => [n.start, n.end])])].sort(
    (a, b) => a - b
  );
  const measures = new Map();
  let previous = new Map();
  for (let i = 0; i + 1 < boundaries.length; i++) {
    let cursor = boundaries[i];
    const end = boundaries[i + 1];
    // A repeated attack on the same pitch ends its prior voice; never tie it.
    const sounding = new Map();
    sources
      .filter((n) => n.start <= cursor && n.end > cursor)
      .sort((a, b) => a.start - b.start)
      .forEach((n) => sounding.set(n.midi, n));
    const pitches = [...sounding.values()].sort((a, b) => a.midi - b.midi);
    while (end - cursor >= 0.249) {
      const bar = Math.floor((cursor + 0.0001) / meter);
      const room = Math.min(end, (bar + 1) * meter) - cursor;
      const [beats, value] = VALUES.find(([length]) => length <= room + 0.0001) || VALUES.at(-1);
      if (!measures.has(bar)) measures.set(bar, { number: bar + 1, events: [] });
      measures.get(bar).events.push({
        beat: cursor,
        beats,
        value,
        rest: !pitches.length,
        pitches: pitches.map((n) => ({
          ...n,
          tieFromPrevious: previous.get(n.midi) === n.source,
        })),
      });
      previous = new Map(pitches.map((n) => [n.midi, n.source]));
      cursor += beats;
    }
  }
  const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  return [...measures.values()].map((bar) => {
    const accidentals = new Map();
    return {
      ...bar,
      events: bar.events.map((event) => ({
        ...event,
        pitches: event.pitches.map((pitch) => {
          const name = names[pitch.midi % 12];
          const octave = Math.floor(pitch.midi / 12);
          const key = `${name[0]}/${octave}`;
          const accidental = name.includes('#') ? '#' : 'n';
          const previous = accidentals.get(key) || 'n';
          const collision = event.pitches.some(
            (other) =>
              other.midi !== pitch.midi &&
              `${names[other.midi % 12][0]}/${Math.floor(other.midi / 12)}` === key
          );
          accidentals.set(key, accidental);
          return {
            ...pitch,
            key: `${name}/${octave}`,
            accidental: collision || accidental !== previous ? accidental : null,
          };
        }),
      })),
    };
  });
}

export function scoreMeasures(notes, bpm, meter = 4) {
  if (!notes.length) return [];
  const events = notes.map((note, index) => ({
    ...note,
    index: note.index ?? index,
    beat: note.beatStart ?? quantize((note.start * bpm) / 60),
    beats: note.beatDuration ?? Math.max(0.25, quantize(((note.end - note.start) * bpm) / 60)),
  }));
  const measures = new Map();
  const append = (start, duration, note = null) => {
    let cursor = start;
    let left = duration;
    let part = 0;
    while (left >= 0.249) {
      const bar = Math.floor((cursor + 0.0001) / meter);
      const room = Math.min(left, (bar + 1) * meter - cursor);
      const [beats, value] = VALUES.find(([length]) => length <= room + 0.0001) || VALUES.at(-1);
      if (!measures.has(bar)) measures.set(bar, { number: bar + 1, events: [] });
      measures.get(bar).events.push({
        beat: cursor,
        beats,
        value,
        rest: !note,
        midi: note?.midi,
        index: note?.index,
        tieFromPrevious: !!note && part > 0,
      });
      cursor += beats;
      left -= beats;
      part++;
    }
  };
  let cursor = events[0].beat;
  events.forEach((note, i) => {
    if (note.beat > cursor) append(cursor, note.beat - cursor);
    const end = Math.min(note.beat + note.beats, events[i + 1]?.beat ?? Infinity);
    append(note.beat, Math.max(0.25, end - note.beat), note);
    cursor = end;
  });
  // Explicit accidentals, including natural cancellation, reset at each barline.
  return [...measures.values()].map((bar) => {
    const accidentals = new Map();
    return {
      ...bar,
      events: bar.events.map((event) => {
        if (event.rest) return event;
        const names = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
        const name = names[event.midi % 12];
        const octave = Math.floor(event.midi / 12); // guitar written one octave higher
        const key = `${name[0]}/${octave}`;
        const accidental = name.includes('#') ? '#' : 'n';
        const previous = accidentals.get(key) || 'n';
        accidentals.set(key, accidental);
        return {
          ...event,
          key: `${name}/${octave}`,
          accidental: accidental !== previous ? accidental : null,
        };
      }),
    };
  });
}
