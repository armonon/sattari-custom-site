// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bpmDescription,
  bpmPage,
  bpmPages,
  bpmTitle,
  keyDescription,
  keyPageFor,
  keyPages,
  keyTitle,
  referencePaths,
  tempoMarking,
} from './musicReference';

describe('key reference pages', () => {
  it('covers all 24 keys with unique, crawlable paths and metadata', () => {
    expect(keyPages).toHaveLength(24);
    for (const list of [
      keyPages.map((page) => page.path),
      keyPages.map(keyTitle),
      keyPages.map(keyDescription),
    ])
      expect(new Set(list).size).toBe(24);
    for (const page of keyPages) {
      expect(page.path).toMatch(/^\/keys\/[a-g](-sharp|-flat)?-(major|minor)$/);
      expect(keyDescription(page).length).toBeLessThanOrEqual(180);
      expect(new Set(page.mixes.map((mix) => keyPageFor(mix.key).camelot)).size).toBe(3);
    }
  });

  it('computes each key from the tool theory', () => {
    const page = keyPageFor('A# major');
    expect(page).toMatchObject({
      label: 'B♭ major',
      slug: 'b-flat-major',
      camelot: '6B',
      signature: '2 flats',
      alias: 'A♯ major',
      relative: 'G minor',
      parallel: 'A# minor',
    });
    expect(page.progressions[0]).toEqual({
      numerals: 'I – V – vi – IV',
      chords: ['B♭', 'F', 'Gm', 'E♭'],
    });
    expect(keyPageFor('C major')).toMatchObject({ signature: 'no sharps or flats', alias: null });
    expect(keyPageFor('D# minor').signature).toBe('6 flats');
    expect(keyPageFor('A minor').tonicHz).toBe(220);
    expect(keyPageFor('Bb major').slug).toBe('b-flat-major');
    expect(keyPageFor('B♭ major').slug).toBe('b-flat-major');
    expect(keyPageFor('nonsense')).toBeNull();
  });
});

describe('tempo reference pages', () => {
  it('covers 40 to 220 BPM with unique metadata', () => {
    expect(bpmPages).toHaveLength(181);
    expect(new Set(bpmPages.map(bpmTitle)).size).toBe(181);
    expect(new Set(bpmPages.map(bpmDescription)).size).toBe(181);
    for (const page of bpmPages) expect(bpmDescription(page).length).toBeLessThanOrEqual(180);
    expect(new Set(referencePaths).size).toBe(24 + 181 + 2);
    expect(bpmPage(39)).toBeNull();
    expect(bpmPage(120.5)).toBeNull();
  });

  it('computes beat lengths, note values and half/double links', () => {
    const page = bpmPage(120);
    expect(page).toMatchObject({
      beatMs: 500,
      barSeconds: 2,
      beatsPerSecond: 2,
      half: 60,
      double: null,
      doubleValue: 240,
      previous: 119,
      next: 121,
    });
    expect(page.marking.name).toBe('Allegro');
    expect(page.noteValues.find((note) => note.name.startsWith('Eighth'))).toEqual({
      name: 'Eighth note (1/8)',
      ms: 250,
      dottedMs: 375,
      tripletMs: 166.7,
      hz: 4,
    });
    expect(page.phrases).toEqual([
      { bars: 8, seconds: 16 },
      { bars: 16, seconds: 32 },
      { bars: 32, seconds: 64 },
    ]);
    expect(bpmPage(85).half).toBeNull();
    expect(bpmPage(40).previous).toBeNull();
    expect(tempoMarking(220).name).toBe('Prestissimo');
    expect(tempoMarking(40)).toMatchObject({ name: 'Grave', from: 40, to: 44 });
  });
});
