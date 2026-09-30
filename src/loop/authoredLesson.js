import { positionForMidi } from './music.js';

// Short, original teaching arrangements of public-domain melodies. The audio,
// tabs and practice targets all come from these same note events.
export function arrangement({ melody, harmony, phraseStarts, ...info }) {
  const beat = 60 / info.bpm;
  let cursor = 0;
  const notes = melody.flatMap(([midi, beats = 1]) => {
    const start = cursor;
    cursor += beats * beat;
    if (midi == null) return [];
    return [
      {
        midi,
        beatStart: start / beat,
        beatDuration: beats,
        start,
        end: cursor - Math.min(0.1, beats * beat * 0.15),
        confidence: 1,
        ...positionForMidi(midi),
      },
    ];
  });
  return {
    ...info,
    source: 'demo',
    meter: 4,
    phraseStarts,
    category: info.category || 'classic',
    duration: cursor,
    notes,
    audioUrl: `/audio/loop-${info.id}.wav`,
    chords: harmony.map(([name, start, end]) => ({
      name,
      start: start * beat,
      end: end * beat,
      confidence: 1,
    })),
    waveform: Array.from(
      { length: 128 },
      (_, i) => 0.16 + Math.exp(-(i % 5) * 0.6) * (0.55 + Math.sin(i * 1.3) * 0.15)
    ),
  };
}
