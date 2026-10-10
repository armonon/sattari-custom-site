import { describe, expect, it } from 'vitest';
import {
  bassFrequency,
  bassNotes,
  bassRowLabels,
  deleteSaved,
  emptyPattern,
  foldTail,
  listSaved,
  mixStems,
  normalizePattern,
  savePattern,
  starterPattern,
  STEPS,
  stepTime,
  STORAGE_KEY,
  DRAFT_KEY,
  MAX_SAVED,
  readDraft,
  saveDraft,
  storageBackup,
} from './pocketPattern';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

describe('timing', () => {
  it('places 16ths and delays only the off-beats by the swing amount', () => {
    expect(stepTime(0, 120, 0.5)).toBe(0);
    expect(stepTime(2, 120, 0.5)).toBeCloseTo(0.25);
    expect(stepTime(1, 120, 0)).toBeCloseTo(0.125);
    expect(stepTime(1, 120, 0.5)).toBeCloseTo(0.1875);
  });
});

describe('bass', () => {
  it('tunes row 0 to the root in octave 1 (A = 55 Hz)', () => {
    expect(bassFrequency(9, 'minor', 0)).toBeCloseTo(55);
    expect(bassFrequency(9, 'minor', 7)).toBeCloseTo(110);
    expect(bassRowLabels(9, 'minorPentatonic')).toEqual(['A', 'C', 'D', 'E', 'G', 'A', 'C', 'D']);
  });

  it('holds each note until the next one, wrapping, at most 4 steps', () => {
    const pattern = emptyPattern();
    pattern.bass[0] = 0;
    pattern.bass[2] = 3;
    pattern.bass[14] = 1;
    expect(bassNotes(pattern)).toEqual([
      { step: 0, row: 0, length: 2 },
      { step: 2, row: 3, length: 4 },
      { step: 14, row: 1, length: 2 },
    ]);
    const single = emptyPattern();
    single.bass[5] = 2;
    expect(bassNotes(single)).toEqual([{ step: 5, row: 2, length: 4 }]);
  });
});

describe('normalizePattern', () => {
  it('keeps a valid pattern unchanged', () => {
    const starter = starterPattern();
    expect(normalizePattern(JSON.parse(JSON.stringify(starter)))).toEqual(starter);
  });

  it('repairs hostile or broken data', () => {
    const fixed = normalizePattern({
      name: 'x'.repeat(500),
      bpm: 9999,
      swing: -3,
      key: 40,
      scale: '__proto__',
      drums: { kick: 'nope', snare: [1, 0, 1] },
      bass: [99, -1, 2.5, 3],
      volume: { kick: 'loud' },
    });
    expect(fixed.name).toHaveLength(60);
    expect(fixed.bpm).toBe(180);
    expect(fixed.swing).toBe(0);
    expect(fixed.key).toBe(11);
    expect(fixed.scale).toBe('minor');
    expect(fixed.drums.kick).toHaveLength(STEPS);
    expect(fixed.drums.kick.every((on) => on === false)).toBe(true);
    expect(fixed.drums.snare.slice(0, 3)).toEqual([true, false, true]);
    expect(fixed.bass.slice(0, 4)).toEqual([null, null, null, 3]);
    expect(fixed.volume.kick).toBe(0.8);
    expect(normalizePattern(null)).toEqual(emptyPattern());
  });
});

describe('saved patterns', () => {
  it('saves by name, newest first, and deletes', () => {
    const storage = memoryStorage();
    savePattern(storage, { ...starterPattern(), name: 'One' });
    savePattern(storage, { ...starterPattern(), name: 'Two', bpm: 120 });
    savePattern(storage, { ...starterPattern(), name: 'One', bpm: 100 });
    const saved = listSaved(storage);
    expect(saved.map((item) => [item.name, item.bpm])).toEqual([
      ['One', 100],
      ['Two', 120],
    ]);
    expect(deleteSaved(storage, 'One').map((item) => item.name)).toEqual(['Two']);
  });

  it('refuses a 41st name without deleting any saved pattern; existing names remain editable', () => {
    const storage = memoryStorage();
    for (let i = 0; i < MAX_SAVED; i++)
      savePattern(storage, { ...starterPattern(), name: `Beat ${i}` });
    const before = storage.getItem(STORAGE_KEY);
    expect(() => savePattern(storage, { ...starterPattern(), name: 'New beat' })).toThrow(
      /slots are full/
    );
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    const saved = savePattern(storage, { ...starterPattern(), name: 'Beat 0', bpm: 135 });
    expect(saved).toHaveLength(MAX_SAVED);
    expect(saved[0].name).toBe('Beat 0');
    expect(saved[0].bpm).toBe(135);
    expect(new Set(saved.map((item) => item.name)).size).toBe(MAX_SAVED);
    deleteSaved(storage, 'Beat 1');
    expect(savePattern(storage, { ...starterPattern(), name: 'New beat' })).toHaveLength(MAX_SAVED);
  });

  it.each(['{not json', '', '{}', 'null', '[null]', '[5]', '[{"name":"future","version":2}]'])(
    'preserves malformed or unsupported saved bytes %s during every mutation',
    (bytes) => {
      const storage = memoryStorage();
      storage.setItem(STORAGE_KEY, bytes);
      expect(() => listSaved(storage)).toThrow();
      expect(() => savePattern(storage, starterPattern())).toThrow();
      expect(() => deleteSaved(storage, 'One')).toThrow();
      expect(storage.getItem(STORAGE_KEY)).toBe(bytes);
    }
  );

  it('refuses ambiguous duplicate names without removing either record', () => {
    const storage = memoryStorage(),
      bytes = JSON.stringify([
        { ...starterPattern(), name: 'Same' },
        { ...starterPattern(), name: 'Same', bpm: 125 },
      ]);
    storage.setItem(STORAGE_KEY, bytes);
    expect(() => savePattern(storage, starterPattern())).toThrow(/unsupported/);
    expect(() => deleteSaved(storage, 'Same')).toThrow(/unsupported/);
    expect(storage.getItem(STORAGE_KEY)).toBe(bytes);
  });

  it('preserves untouched stored fields and libraries larger than the current capacity', () => {
    const storage = memoryStorage(),
      previous = Array.from({ length: MAX_SAVED + 2 }, (_, i) => ({
        ...starterPattern(),
        name: `Legacy ${i}`,
        annotation: { important: i },
      }));
    storage.setItem(STORAGE_KEY, JSON.stringify(previous));
    savePattern(storage, { ...starterPattern(), name: 'Legacy 0', bpm: 135 });
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).slice(1)).toEqual(previous.slice(1));
    expect(() => savePattern(storage, { ...starterPattern(), name: 'Extra' })).toThrow(/full/);
  });

  it('does not write after a failed read and preserves the last save on quota failure', () => {
    let writes = 0;
    const denied = {
      getItem: () => {
        throw new Error('Denied read');
      },
      setItem: () => {
        writes++;
      },
    };
    expect(() => savePattern(denied, starterPattern())).toThrow(/Denied read/);
    expect(() => deleteSaved(denied, 'One')).toThrow(/Denied read/);
    expect(writes).toBe(0);
    const storage = memoryStorage();
    savePattern(storage, starterPattern());
    const before = storage.getItem(STORAGE_KEY);
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => savePattern(storage, { ...starterPattern(), name: 'Later' })).toThrow(/Quota/);
    expect(() => deleteSaved(storage, 'Starter groove')).toThrow(/Quota/);
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
    expect(() => listSaved(null)).toThrow(/blocks local storage/);
  });

  it.each([
    ['missing drums', { ...starterPattern(), drums: null }],
    ['truncated bass', { ...starterPattern(), bass: [0, null] }],
    [
      'invalid step',
      { ...starterPattern(), drums: { ...starterPattern().drums, kick: Array(16).fill(1) } },
    ],
    ['missing mixer', { ...starterPattern(), volume: {} }],
    ['invalid tempo', { ...starterPattern(), bpm: '92' }],
    ['normalized-name alias', { ...starterPattern(), name: 'x'.repeat(61) }],
  ])(
    'preserves semantically malformed %s bytes before draft, save and delete mutations',
    (_label, pattern) => {
      const storage = memoryStorage(),
        raw = JSON.stringify(pattern);
      storage.setItem(DRAFT_KEY, raw);
      storage.setItem(STORAGE_KEY, `[${raw}]`);
      expect(() => readDraft(storage)).toThrow(/unsupported/);
      expect(() => saveDraft(storage, starterPattern())).toThrow(/unsupported/);
      expect(() => savePattern(storage, starterPattern())).toThrow(/unsupported/);
      expect(() => deleteSaved(storage, pattern.name)).toThrow(/unsupported/);
      expect(storage.getItem(DRAFT_KEY)).toBe(raw);
      expect(storage.getItem(STORAGE_KEY)).toBe(`[${raw}]`);
      expect(storageBackup(storage)).toEqual({
        format: 'pocket-storage-backup',
        version: 1,
        library: `[${raw}]`,
        draft: raw,
      });
    }
  );

  it('accepts complete legacy unversioned patterns and preserves additional stored fields on update', () => {
    const storage = memoryStorage(),
      prior = {
        ...starterPattern(),
        note: 'retain me',
        drums: { ...starterPattern().drums, annotation: 'retain nested data' },
      };
    delete prior.version;
    storage.setItem(DRAFT_KEY, JSON.stringify(prior));
    storage.setItem(STORAGE_KEY, JSON.stringify([prior]));
    expect(readDraft(storage)).toEqual(starterPattern());
    saveDraft(storage, { ...starterPattern(), bpm: 110 });
    savePattern(storage, { ...starterPattern(), bpm: 110 });
    for (const updated of [
      JSON.parse(storage.getItem(DRAFT_KEY)),
      JSON.parse(storage.getItem(STORAGE_KEY))[0],
    ]) {
      expect(updated.note).toBe('retain me');
      expect(updated.drums.annotation).toBe('retain nested data');
      expect(updated.bpm).toBe(110);
    }
  });

  it('restores a valid draft and leaves corrupt or newer drafts untouched', () => {
    const storage = memoryStorage();
    expect(readDraft(storage)).toBeNull();
    saveDraft(storage, starterPattern());
    expect(readDraft(storage)).toEqual(starterPattern());
    for (const bytes of ['{broken draft', 'null', '[]', '{"name":"future","version":2}']) {
      storage.setItem(DRAFT_KEY, bytes);
      expect(() => saveDraft(storage, emptyPattern())).toThrow();
      expect(storage.getItem(DRAFT_KEY)).toBe(bytes);
    }
  });
});

describe('rendering helpers', () => {
  it('folds the ring-out past the loop end back onto the start', () => {
    const [out] = foldTail([new Float32Array([1, 2, 3, 4, 5, 6, 7])], 4);
    expect(Array.from(out)).toEqual([1 + 5, 2 + 6, 3 + 7, 4]);
  });

  it('mixes stems and scales mix and stems together when the sum would clip', () => {
    const stems = [
      { channels: [new Float32Array([0.8, 0.1]), new Float32Array([0, 0])] },
      { channels: [new Float32Array([0.8, -0.1]), new Float32Array([0, 0])] },
    ];
    const { mix, gain } = mixStems(stems, 0.98);
    expect(gain).toBeCloseTo(0.98 / 1.6);
    expect(mix[0][0]).toBeCloseTo(0.98);
    expect(stems[0].channels[0][0] + stems[1].channels[0][0]).toBeCloseTo(mix[0][0]);
  });
});
