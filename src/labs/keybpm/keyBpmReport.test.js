// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createKeyBpmReport, parseKeyBpmReport, KEYBPM_REPORT_MAX_BYTES } from './keyBpmReport';
const when = '2026-10-08T02:00:00.000Z';
const row = () => ({
  file: { name: 'Measured mix.wav', size: 100, type: 'audio/wav', lastModified: 1 },
  measuredAt: when,
  result: {
    file: 'Measured mix.wav',
    status: 'done',
    note: '',
    duration: 12,
    key: 'C major',
    camelot: '8B',
    keyConfidence: 0.2,
    keyEvidence: 'supported',
    alternative: 'A minor',
    bpm: 120,
    tempoEvidence: 'supported',
    rmsDb: -18,
    peakDb: -3,
  },
});
const report = () => JSON.parse(createKeyBpmReport([row()], when));
describe('portable analysis reports', () => {
  it('round trips measurements, confidence, source metadata and measurement time without audio', () => {
    const original = row(),
      decoded = parseKeyBpmReport(createKeyBpmReport([original], when));
    expect(decoded.tracks).toEqual([
      { source: original.file, result: original.result, measuredAt: when },
    ]);
    expect(decoded.limits.join(' ')).toContain('Source audio is not included');
    expect(decoded.tracks[0].source.arrayBuffer).toBeUndefined();
  });
  it('preserves quiet/insufficient results and per-file failures', () => {
    const quiet = row();
    Object.assign(quiet.result, {
      key: '',
      camelot: '',
      keyConfidence: null,
      keyEvidence: 'insufficient',
      alternative: '',
      bpm: null,
      tempoEvidence: 'insufficient',
      rmsDb: null,
      peakDb: null,
      note: 'Too quiet',
    });
    const failure = row();
    failure.result = { file: failure.file.name, status: 'error', note: 'Could not decode' };
    const decoded = parseKeyBpmReport(createKeyBpmReport([quiet, failure], when));
    expect(decoded.tracks.map((t) => t.result)).toEqual([quiet.result, failure.result]);
  });
  it.each([
    ['unsupported version', (r) => (r.version = 2)],
    ['mismatched key/Camelot', (r) => (r.tracks[0].result.camelot = '12A')],
    ['fake success shape', (r) => delete r.tracks[0].result.duration],
    ['invalid confidence', (r) => (r.tracks[0].result.keyConfidence = 99)],
    ['bad time', (r) => (r.tracks[0].measuredAt = 'not-a-time')],
    ['renamed result', (r) => (r.tracks[0].result.file = 'different.wav')],
    ['over-limit track list', (r) => (r.tracks = Array(201).fill(r.tracks[0]))],
    ['bad last row', (r) => r.tracks.push({ source: {}, result: {} })],
  ])('rejects %s atomically', (_, mutate) => {
    const original = report();
    mutate(original);
    expect(() => parseKeyBpmReport(JSON.stringify(original))).toThrow(
      /Existing tracks were not changed/
    );
  });
  it('rejects oversized and malformed input before restoring results', () => {
    expect(() => parseKeyBpmReport(' '.repeat(KEYBPM_REPORT_MAX_BYTES + 1))).toThrow();
    expect(() => parseKeyBpmReport('{')).toThrow();
  });
  it('does not import arbitrary claims or unknown object keys', () => {
    const value = report();
    value.limits = ['100% accurate'];
    value.tracks[0].result.claim = 'certified';
    const decoded = parseKeyBpmReport(JSON.stringify(value));
    expect(decoded.limits).not.toContain('100% accurate');
    expect(decoded.tracks[0].result.claim).toBeUndefined();
  });
});
