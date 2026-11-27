import { describe, expect, it } from 'vitest';
import { audioAllowance, hydrateRow, rowRecord } from './keyBpmStore';

const when = '2026-11-21T10:00:00.000Z';
const result = {
  file: 'song.wav',
  status: 'done',
  note: '',
  duration: 30,
  key: 'A minor',
  camelot: '8A',
  keyConfidence: 0.2,
  keyEvidence: 'supported',
  alternative: 'C major',
  bpm: 140,
  tempoEvidence: 'supported',
  rmsDb: -16,
  peakDb: -1,
};
const file = (size = 4, name = 'song.wav') =>
  new File([new Uint8Array(size)], name, { type: 'audio/wav', lastModified: 1 });
const row = (extra = {}) => ({
  id: 'a',
  file: file(),
  status: 'done',
  result: { ...result },
  measuredAt: when,
  ...extra,
});

describe('Key & BPM browser saving', () => {
  it('round trips a measured row with its correction, origin and audio', () => {
    const user = { key: 'C major', bpm: 70, bpmChoice: 'half', editedAt: when };
    const origin = { from: 'Stem Separator', kind: 'stem', label: 'Bass stem of X' };
    const restored = hydrateRow(rowRecord(row({ user, origin }), 0, true));
    expect(restored.file).toBeInstanceOf(Blob);
    expect(restored.result).toEqual(result);
    expect(restored.user).toEqual(user);
    expect(restored.origin).toEqual(origin);
    expect(restored.audioNotSaved).toBeUndefined();
  });

  it('saves a row without audio when over budget and labels it', () => {
    const restored = hydrateRow(rowRecord(row(), 0, false));
    expect(restored.file).not.toBeInstanceOf(Blob);
    expect(restored.file.name).toBe('song.wav');
    expect(restored.audioNotSaved).toBe(true);
  });

  it('restores interrupted work as waiting, and drops waiting rows without audio', () => {
    const record = rowRecord(row({ status: 'analyzing', result: null }), 0, true);
    expect(record.status).toBe('queued');
    expect(hydrateRow(record).status).toBe('queued');
    expect(() =>
      hydrateRow(rowRecord(row({ status: 'queued', result: null }), 0, false))
    ).toThrow();
  });

  it('rejects tampered or invalid records', () => {
    const bad = rowRecord(row(), 0, true);
    bad.result = { ...result, camelot: '1B' };
    expect(() => hydrateRow(bad)).toThrow();
    const badUser = rowRecord(
      row({ user: { key: 'H major', bpm: null, bpmChoice: null, editedAt: when } }),
      0,
      true
    );
    expect(() => hydrateRow(badUser)).toThrow();
    expect(() => hydrateRow({ id: '', file: file() })).toThrow();
  });

  it('keeps audio for rows in list order until the budget is spent', () => {
    const rows = [
      { id: '1', file: file(60) },
      { id: '2', file: file(50) },
      { id: '3', file: file(30) },
      { id: '4', file: { name: 'report.wav' }, fromReport: true },
    ];
    expect([...audioAllowance(rows, 100)]).toEqual(['1', '3']);
  });
});
