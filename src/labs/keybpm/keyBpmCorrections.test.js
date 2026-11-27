// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  ALL_KEYS,
  camelot,
  cleanCorrection,
  correctedResultsCsv,
  createTapTempo,
  effectiveValues,
  normalizeBpm,
  resultsCsv,
  tempoInterpretation,
} from './keyBpm';
import { createKeyBpmReport, parseKeyBpmReport } from './keyBpmReport';

const when = '2026-11-20T10:00:00.000Z';
const result = {
  file: 'Groove.wav',
  status: 'done',
  note: '',
  duration: 30,
  key: 'A minor',
  camelot: '8A',
  keyConfidence: 0.05,
  keyEvidence: 'tentative',
  alternative: 'C major',
  bpm: 140,
  tempoEvidence: 'supported',
  rmsDb: -16,
  peakDb: -1,
};
const row = (extra = {}) => ({
  file: { name: 'Groove.wav', size: 10, type: 'audio/wav', lastModified: 1 },
  measuredAt: when,
  result: { ...result },
  ...extra,
});

describe('BPM validation', () => {
  it.each([
    ['92', 92],
    ['87.456', 87.46],
    [' 120,5 ', 120.5],
    [70, 70],
  ])('accepts %s', (input, expected) => expect(normalizeBpm(input)).toBe(expected));
  it.each(['', 'abc', '0', '-90', '19.9', '401', 'Infinity', NaN, null, undefined])(
    'rejects %s',
    (input) => expect(normalizeBpm(input)).toBeNull()
  );
  it('interprets half and double time of the detected tempo', () => {
    expect(tempoInterpretation(140, 'half')).toBe(70);
    expect(tempoInterpretation(140, 'double')).toBe(280);
    expect(tempoInterpretation(87.5, 'half')).toBe(43.75);
    expect(tempoInterpretation(250, 'double')).toBeNull();
    expect(tempoInterpretation(null, 'half')).toBeNull();
  });
});

describe('tap tempo', () => {
  it('averages intervals and needs three taps', () => {
    const tap = createTapTempo();
    expect(tap.tap(0)).toBeNull();
    expect(tap.tap(500)).toBeNull();
    expect(tap.tap(1000)).toBe(120);
    expect(tap.tap(1500)).toBe(120);
  });
  it('restarts after a pause and ignores non-increasing taps', () => {
    const tap = createTapTempo({ resetMs: 2000 });
    [0, 600, 1200].forEach((at) => tap.tap(at));
    expect(tap.value()).toBe(100);
    tap.tap(1200);
    expect(tap.count()).toBe(3);
    tap.tap(9000);
    expect(tap.count()).toBe(1);
    expect(tap.value()).toBeNull();
  });
});

describe('corrections', () => {
  it('keep the detection and label the effective source', () => {
    const user = cleanCorrection({ bpm: 70, bpmChoice: 'half', key: 'C major', editedAt: when });
    const values = effectiveValues(result, user);
    expect(values).toMatchObject({
      key: 'C major',
      camelot: '8B',
      bpm: 70,
      keySource: 'user',
      bpmSource: 'half',
    });
    expect(result.bpm).toBe(140);
    expect(effectiveValues(result, null)).toMatchObject({ bpm: 140, bpmSource: 'detected' });
  });
  it('drop invalid or empty corrections instead of half-applying them', () => {
    expect(cleanCorrection({ key: 'H major', bpm: 'fast' })).toBeNull();
    expect(cleanCorrection({ key: 'B♭ major' }).key).toBe('B♭ major');
    expect(cleanCorrection({ key: 'A# major' }).key).toBe('A# major');
    expect(cleanCorrection({ key: null, bpm: null })).toBeNull();
    expect(cleanCorrection({ bpm: 90 })).toMatchObject({ bpm: 90, bpmChoice: 'manual' });
  });
  it('map every selectable key to a Camelot code consistently', () => {
    expect(ALL_KEYS).toHaveLength(24);
    const codes = new Set(ALL_KEYS.map(camelot));
    expect(codes.size).toBe(24);
    expect(camelot('A minor')).toBe('8A');
    expect(camelot('C major')).toBe('8B');
    expect(camelot('F# minor')).toBe('11A');
    expect(camelot('E major')).toBe('12B');
  });
});

describe('CSV with corrections', () => {
  it('keeps the original columns first and escapes trailing user fields', () => {
    const user = cleanCorrection({ bpm: 70, bpmChoice: 'half', editedAt: when });
    const csv = correctedResultsCsv([{ result, user, origin: { label: '=cmd|calc' } }]);
    const [header, line] = csv.trim().split('\r\n');
    expect(header.startsWith(resultsCsv([]).trim())).toBe(true);
    expect(header).toContain('"Corrected BPM","BPM correction"');
    expect(line).toContain('"140"');
    expect(line).toContain('"70","half"');
    expect(line).toContain(`"'=cmd|calc"`);
  });
});

describe('report v2', () => {
  it('round trips corrections separately from the measurement', () => {
    const user = cleanCorrection({ key: 'C major', bpm: 70, bpmChoice: 'half', editedAt: when });
    const decoded = parseKeyBpmReport(
      createKeyBpmReport(
        [row({ user, origin: { kind: 'stem', label: 'Bass stem of Groove.wav' } })],
        when
      )
    );
    expect(decoded.version).toBe(2);
    expect(decoded.tracks[0].result).toEqual(result);
    expect(decoded.tracks[0].user).toEqual(user);
    expect(decoded.tracks[0].origin).toEqual({ kind: 'stem', label: 'Bass stem of Groove.wav' });
  });
  it('opens version 1 reports unchanged and without corrections', () => {
    const v1 = JSON.parse(createKeyBpmReport([row()], when));
    v1.version = 1;
    const decoded = parseKeyBpmReport(JSON.stringify(v1));
    expect(decoded.sourceVersion).toBe(1);
    expect(decoded.tracks[0].user).toBeUndefined();
    expect(decoded.tracks[0].result).toEqual(result);
  });
  it.each([
    ['unknown key', { key: 'H major', bpm: null, bpmChoice: null, editedAt: when }],
    ['bpm without choice', { key: null, bpm: 90, bpmChoice: null, editedAt: when }],
    ['out of range bpm', { key: null, bpm: 900, bpmChoice: 'manual', editedAt: when }],
    ['empty correction', { key: null, bpm: null, bpmChoice: null, editedAt: when }],
    ['missing time', { key: 'C major', bpm: null, bpmChoice: null }],
  ])('rejects a malformed correction (%s) atomically', (_, user) => {
    const report = JSON.parse(createKeyBpmReport([row(), row()], when));
    report.tracks[1].user = user;
    expect(() => parseKeyBpmReport(JSON.stringify(report))).toThrow(
      /Existing tracks were not changed/
    );
  });
  it('rejects a version 3 report', () => {
    const report = JSON.parse(createKeyBpmReport([row()], when));
    report.version = 3;
    expect(() => parseKeyBpmReport(JSON.stringify(report))).toThrow();
  });
});

describe('notes on a result', async () => {
  const { cleanCorrection, cleanNotes, correctedResultsCsv } = await import('./keyBpm');
  const { createKeyBpmReport, parseKeyBpmReport } = await import('./keyBpmReport');
  it('keeps one safe line of text and allows notes without other corrections', () => {
    expect(cleanNotes('  swung\n feel\u0000 ')).toBe('swung feel');
    expect(cleanNotes('x'.repeat(900))).toHaveLength(500);
    const user = cleanCorrection({ notes: 'Count in 2', editedAt: '2026-11-21T00:00:00.000Z' });
    expect(user).toEqual({
      key: null,
      bpm: null,
      bpmChoice: null,
      editedAt: '2026-11-21T00:00:00.000Z',
      notes: 'Count in 2',
    });
    expect(cleanCorrection({ notes: '   ' })).toBeNull();
  });

  it('round-trips notes through the report and exports them formula-safe in the CSV', () => {
    const result = {
      file: 'a.wav',
      status: 'done',
      duration: 10,
      key: 'A minor',
      camelot: '8A',
      keyConfidence: 0.2,
      keyEvidence: 'supported',
      alternative: 'C major',
      bpm: 120,
      tempoEvidence: 'supported',
      rmsDb: -20,
      peakDb: -1,
      note: '',
    };
    const row = {
      file: { name: 'a.wav', size: 10, type: 'audio/wav', lastModified: 0 },
      result,
      measuredAt: '2026-11-21T00:00:00.000Z',
      user: {
        key: null,
        bpm: null,
        bpmChoice: null,
        editedAt: '2026-11-21T00:00:00.000Z',
        notes: '=SUM(A1)',
      },
    };
    const back = parseKeyBpmReport(createKeyBpmReport([row]));
    expect(back.tracks[0].user.notes).toBe('=SUM(A1)');
    const csv = correctedResultsCsv([row]);
    const [header, line] = csv.trim().split('\r\n');
    expect(header.endsWith('"Your notes"')).toBe(true);
    expect(line.endsWith(`"'=SUM(A1)"`)).toBe(true);
    const tampered = JSON.parse(createKeyBpmReport([row]));
    tampered.tracks[0].user.notes = 'two\nlines';
    expect(() => parseKeyBpmReport(JSON.stringify(tampered))).toThrow();
  });
});
