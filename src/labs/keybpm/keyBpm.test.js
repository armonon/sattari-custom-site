// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { analyzeStemAudio } from '../../utils/stemMusicalAnalysis';
import { camelot, csvCell, keyParts, resultRow, resultsCsv, roughTempo } from './keyBpm';

const rate = 44100;

// C major triad plus a 120 BPM click, like a minimal loop.
function loop(seconds = 12, bpm = 120) {
  const samples = new Float32Array(seconds * rate);
  for (let i = 0; i < samples.length; i++)
    samples[i] = [60, 64, 67].reduce(
      (sum, midi) => sum + 0.1 * Math.sin((2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * i) / rate),
      0
    );
  for (let t = 0.2; t < seconds; t += 60 / bpm)
    for (let i = 0; i < 2000; i++) {
      const at = Math.floor(t * rate) + i;
      if (at < samples.length) samples[at] += 0.8 * Math.exp(-i / 240) * Math.sin(i * 0.225);
    }
  return samples;
}

describe('Camelot codes', () => {
  it.each([
    ['C major', '8B'],
    ['A minor', '8A'],
    ['G major', '9B'],
    ['E minor', '9A'],
    ['F major', '7B'],
    ['B major', '1B'],
    ['G# minor', '1A'],
    ['B♭ major', '6B'],
    ['C♯ minor', '12A'],
  ])('%s is %s', (key, code) => {
    expect(camelot(key)).toBe(code);
  });

  it('ignores unknown keys', () => {
    expect(camelot('')).toBe('');
    expect(camelot(null)).toBe('');
    expect(keyParts('H major')).toBeNull();
  });
});

describe('CSV export', () => {
  it('quotes cells and neutralises spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('"plain"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell(null)).toBe('""');
  });

  it('writes a header and one line per result', () => {
    const csv = resultsCsv([
      { file: 'a.wav', status: 'done', duration: 10, key: 'C major', camelot: '8B', bpm: 120 },
      { file: 'b.mp3', status: 'error', note: 'Could not decode' },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^"File","Duration \(s\)","Key","Camelot"/);
    expect(lines[1]).toContain('"a.wav","10.0","C major","8B"');
    expect(lines[1]).toContain('"120"');
    expect(lines[2]).toContain('"error","Could not decode"');
  });
});

describe('result rows', () => {
  it('measures key and tempo of a synthetic loop with the shared analyzer', () => {
    const samples = loop();
    const row = resultRow('loop.wav', analyzeStemAudio(samples, samples, rate));
    expect(row).toMatchObject({ status: 'done', key: 'C major', camelot: '8B', bpm: 120 });
    expect(row.note).toBe('');
  });

  it('labels a rough tempo and missing key honestly', () => {
    const row = resultRow(
      'pad.wav',
      {
        status: 'ready',
        duration: 30,
        key: null,
        keyReason: 'limited-harmony',
        bpm: null,
        tempoReason: 'variable',
        rmsDb: -20,
        peakDb: -3,
      },
      97
    );
    expect(row).toMatchObject({ key: '', camelot: '', bpm: 97, tempoEvidence: 'rough' });
    expect(row.note).toMatch(/Not enough tonal evidence/);
    expect(row.note).toMatch(/rough value shown/);
    expect(resultRow('x', { status: 'unavailable' })).toMatchObject({ status: 'error' });
  });
});

describe('rough tempo', () => {
  it('reports a folded estimate for a 100 BPM loop the strict estimator declines', () => {
    const samples = loop(14, 100);
    expect(roughTempo(samples, samples, rate)).toBe(100);
  });

  it('declines silence', () => {
    const silence = new Float32Array(rate * 10);
    expect(roughTempo(silence, silence, rate)).toBeNull();
  });
});
