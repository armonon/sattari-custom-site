// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cleanPracticeState, cleanSectionName, MAX_SECTIONS } from './practiceState';
import { createMix } from './stemMix';

const ids = ['vocals', 'drums', 'bass', 'other'];
const base = () => ({
  v: 1,
  mix: { ...createMix(ids), master: 0.8 },
  speed: 0.75,
  semitones: -2,
  loop: { a: 4, b: 12 },
  sections: [{ id: 's1', name: ' Verse\n1 ', a: 4, b: 12 }],
  click: true,
  countIn: true,
  snap: false,
  barOffset: 2,
  headroom: 'prevent-clipping',
});

describe('cleanPracticeState', () => {
  it('keeps a valid setup and tidies names', () => {
    const state = cleanPracticeState(base(), ids, 60);
    expect(state).toMatchObject({
      speed: 0.75,
      semitones: -2,
      loop: { a: 4, b: 12 },
      click: true,
      countIn: true,
      snap: false,
      barOffset: 2,
      headroom: 'prevent-clipping',
    });
    expect(state.mix.master).toBe(0.8);
    expect(state.sections).toEqual([{ id: 's1', name: 'Verse 1', a: 4, b: 12 }]);
  });

  it('rejects other versions and non-objects', () => {
    expect(cleanPracticeState(null, ids)).toBeNull();
    expect(cleanPracticeState({ ...base(), v: 2 }, ids)).toBeNull();
    expect(cleanPracticeState('x', ids)).toBeNull();
  });

  it('clamps numbers, drops bad loops and falls back to defaults', () => {
    const dirty = {
      v: 1,
      mix: {
        lanes: Object.fromEntries(ids.map((id) => [id, { gain: 99, muted: 'yes' }])),
        master: -3,
      },
      speed: 9,
      semitones: 40,
      loop: { a: 50, b: 50.1 },
      sections: [
        { id: 'ok', name: '', a: 1, b: 3 },
        { id: 'ok', name: 'duplicate id', a: 2, b: 5 },
        { id: 'past', name: 'beyond the song', a: 70, b: 90 },
        { id: 'nan', name: 'x', a: Number.NaN, b: 4 },
        'junk',
      ],
      barOffset: 9,
      headroom: 'loud',
      extra: 'dropped',
    };
    const state = cleanPracticeState(dirty, ids, 60);
    expect(state.mix.lanes.drums).toEqual({ gain: 2, muted: false, solo: false });
    expect(state.mix.master).toBe(0);
    expect(state.speed).toBe(1.25);
    expect(state.semitones).toBe(6);
    expect(state.loop).toBeNull();
    expect(state.sections).toEqual([{ id: 'ok', name: 'Loop 1', a: 1, b: 3 }]);
    expect(state.barOffset).toBe(3);
    expect(state.headroom).toBe('none');
    expect(state).not.toHaveProperty('extra');
  });

  it('does not apply a mix saved for a different set of parts', () => {
    const state = cleanPracticeState(base(), ['vocals', 'drums', 'bass', 'other', 'piano'], 60);
    expect(state.mix).toBeNull();
    expect(state.speed).toBe(0.75);
  });

  it('caps the number of saved loops', () => {
    const many = {
      ...base(),
      sections: Array.from({ length: 30 }, (_, i) => ({
        id: `s${i}`,
        name: `L${i}`,
        a: i,
        b: i + 1,
      })),
    };
    expect(cleanPracticeState(many, ids, 600).sections).toHaveLength(MAX_SECTIONS);
  });
});

it('cleanSectionName gives one short line', () => {
  expect(cleanSectionName('  Solo\t\tpart ', 'x')).toBe('Solo part');
  expect(cleanSectionName('a'.repeat(100))).toHaveLength(40);
  expect(cleanSectionName('   ', 'Loop 3')).toBe('Loop 3');
  expect(cleanSectionName(7, 'Loop 1')).toBe('Loop 1');
});
