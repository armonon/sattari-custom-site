import { describe, expect, it } from 'vitest';
import { importMidi, MidiNoteCapture } from './arrangementMidi';
import { validateArrangement } from './arrangementModel';
const midi = (events, format = 0, division = 480) =>
  new Uint8Array([
    ...new TextEncoder().encode('MThd'),
    0,
    0,
    0,
    6,
    0,
    format,
    0,
    1,
    division >> 8,
    division & 255,
    ...new TextEncoder().encode('MTrk'),
    0,
    0,
    events.length >> 8,
    events.length & 255,
    ...events,
  ]);
describe('MIDI file and device capture', () => {
  it('imports running-status polyphonic notes at project tempo', () => {
    const data = midi([0, 144, 60, 100, 0, 64, 80, 131, 96, 128, 60, 0, 0, 64, 0, 0, 255, 47, 0]);
    const { tracks } = importMidi(data, { bpm: 120, start: 3 });
    expect(tracks[0].clips[0]).toMatchObject({
      start: 3,
      timebase: 'beats',
      notes: [
        { pitch: 'C4', time: 0, duration: 0.5 },
        { pitch: 'E4', time: 0, duration: 0.5 },
      ],
    });
    expect(() => validateArrangement({ version: 1, tracks, captures: [] })).not.toThrow();
  });
  it('retains pedal-held notes and closes held notes on stop', () => {
    const capture = new MidiNoteCapture();
    capture.message([144, 60, 127], 0);
    capture.message([176, 64, 127], 0.1);
    capture.message([128, 60, 0], 0.2);
    expect(capture.notes).toHaveLength(0);
    capture.message([176, 64, 0], 0.8);
    capture.message([144, 64, 64], 1);
    expect(capture.stop(2)).toMatchObject([
      { pitch: 'C4', duration: 0.8, velocity: 1 },
      { pitch: 'E4', time: 1, duration: 1 },
    ]);
  });
  it('rejects truncated, SMPTE and malformed running-status files', () => {
    expect(() => importMidi(midi([0, 144, 60]))).toThrow('Truncated');
    expect(() => importMidi(midi([], 0, 0xe728))).toThrow('PPQ');
    expect(() => importMidi(midi([0, 60, 64]))).toThrow('running status');
  });
  it('ignores unsupported controller/program metadata without creating fake notes', () => {
    const result = importMidi(midi([0, 192, 5, 0, 144, 60, 100, 131, 96, 128, 60, 0]));
    expect(result.ignored).toBe(1);
    expect(result.tracks[0].clips[0].notes).toHaveLength(1);
  });
});
