// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  chordMidis,
  chordShape,
  CHORD_NAMES,
  DEMO,
  downloadLesson,
  NOTE_NAMES,
  phrasesFor,
  positionForMidi,
  TUNING,
} from './music';
import { detectFundamental } from './pitch';
import { analyzeSong, estimateChordFromChroma, transcribeMelody } from './analyze';

function tone(midi, duration = 0.5, rate = 8000, harmonics = false) {
  const hz = 440 * 2 ** ((midi - 69) / 12);
  return Float32Array.from(
    { length: duration * rate },
    (_, i) =>
      0.2 * Math.sin((2 * Math.PI * hz * i) / rate) +
      (harmonics
        ? 0.32 * Math.sin((4 * Math.PI * hz * i) / rate) +
          0.1 * Math.sin((6 * Math.PI * hz * i) / rate)
        : 0)
  );
}

describe('guitar pitch recognition', () => {
  it.each([40, 45, 50, 55, 59, 64, 69, 76, 83])(
    'finds MIDI %i, including a stronger second harmonic',
    (midi) => {
      const result = detectFundamental(tone(midi, 0.128, 8000, true), 8000);
      expect(result?.midi).toBe(midi);
      expect(Math.abs(result.cents)).toBeLessThan(15);
    }
  );
  it('rejects silence and unpitched noise', () => {
    expect(detectFundamental(new Float32Array(1024), 8000)).toBeNull();
    let seed = 23;
    const noise = Float32Array.from({ length: 1024 }, () => {
      seed = Math.imul(seed, 1664525) + 1013904223;
      return ((seed >>> 0) / 4294967296 - 0.5) * 0.3;
    });
    expect(detectFundamental(noise, 8000)).toBeNull();
  });
  it('keeps octaves distinct for feedback', () => {
    expect(detectFundamental(tone(52, 0.128), 8000).midi).not.toBe(64);
  });
});

describe('local transcription', () => {
  it('finds an ascending melody and repeated notes separated by silence', () => {
    const input = new Float32Array(8000 * 3);
    [40, 43, 45, 45].forEach((midi, i) => input.set(tone(midi, 0.48), Math.round(i * 0.7 * 8000)));
    const notes = transcribeMelody(input, 8000);
    expect(notes.map((n) => n.midi)).toEqual([40, 43, 45, 45]);
    notes.forEach((n, i) => {
      expect(n.start).toBeCloseTo(i * 0.7, 0);
      expect(TUNING[n.string] + n.fret).toBe(n.midi);
      if (i) expect(n.start).toBeGreaterThanOrEqual(notes[i - 1].end);
    });
  });
  it('does not invent melody or chords for silence', () => {
    const analysis = analyzeSong(new Float32Array(16000), 8000);
    expect(analysis.notes).toEqual([]);
    expect(analysis.chords).toEqual([]);
    expect(analysis.waveform.every((v) => Number.isFinite(v))).toBe(true);
  });
  it('recognizes a clear minor chord chroma', () => {
    const chroma = Array(12).fill(0);
    chroma[4] = 0.4;
    chroma[7] = 0.3;
    chroma[11] = 0.3;
    expect(estimateChordFromChroma(chroma).name).toBe('Em');
  });
  it('transcribes the shipped original WAV as the intended lesson', () => {
    const bytes = readFileSync('public/audio/loop-night-shift.wav');
    const rate = bytes.readUInt32LE(24);
    const samples = Float32Array.from(
      { length: (bytes.length - 44) / 2 },
      (_, i) => bytes.readInt16LE(44 + i * 2) / 32768
    );
    const result = transcribeMelody(samples, rate);
    const expected = DEMO.notes.map((n) => n.midi);
    expect(result.map((n) => n.midi)).toEqual(expected);
  });
});

describe('guitar guides', () => {
  it.each(CHORD_NAMES)('%s fingering contains only the named chord tones', (name) => {
    const root = NOTE_NAMES.indexOf(name.replace(/m$/, ''));
    const pcs = [root, (root + (name.endsWith('m') ? 3 : 4)) % 12, (root + 7) % 12];
    const pitches = chordMidis(name).map((n) => n % 12);
    expect(pitches.every((pc) => pcs.includes(pc))).toBe(true);
    expect(pcs.every((pc) => pitches.includes(pc))).toBe(true);
    const shape = chordShape(name);
    shape.frets
      .filter((f) => f > 0)
      .forEach((f) => expect(f).toBeGreaterThanOrEqual(shape.startFret));
  });
  it('maps every supported note to a real fret', () => {
    for (let midi = 40; midi <= 84; midi++) {
      const p = positionForMidi(midi);
      expect(TUNING[p.string] + p.fret).toBe(midi);
    }
    expect(positionForMidi(20)).toBeNull();
  });
  it('makes phrases cover the entire demo and exports correct string orientation', () => {
    const phrases = phrasesFor(DEMO);
    expect(phrases[0].start).toBe(0);
    expect(phrases.at(-1).end).toBe(DEMO.duration);
    expect(phrases.flatMap((p) => p.notes)).toHaveLength(DEMO.notes.length);
    const sheet = downloadLesson(DEMO);
    expect(sheet).toContain('Em');
    expect(sheet).toContain('0 2 2 0 0 0');
    expect(sheet.indexOf('e|')).toBeLessThan(sheet.indexOf('E|'));
  });
});
