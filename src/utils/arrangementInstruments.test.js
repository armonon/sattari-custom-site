import { it, expect, vi } from 'vitest';
import { instrumentVoice, rollingNotes, VoiceBudget, INSTRUMENTS } from './arrangementInstruments';
function context() {
  const nodes = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const node = () => {
    const n = {
      connect: vi.fn(function () {
        return arguments[0];
      }),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: param(),
      frequency: param(),
      Q: param(),
      playbackRate: param(),
    };
    nodes.push(n);
    return n;
  };
  return {
    createGain: node,
    createOscillator: node,
    createBufferSource: node,
    createBiquadFilter: node,
    sampleRate: 48000,
    nodes,
  };
}
it('schedules every built-in voice with finite velocity-aware envelopes and bounded node counts', () => {
  for (const [instrument] of INSTRUMENTS.filter(([id]) => id !== 'sampler')) {
    const raw = context();
    const voice = instrumentVoice(raw, {}, { instrument }, { pitch: 'C4', velocity: 0.4 }, 2, 0.8);
    expect(voice.sources.length).toBeGreaterThan(0);
    expect(voice.sources.length).toBeLessThanOrEqual(3);
    for (const source of voice.sources) {
      expect(source.start).toHaveBeenCalledWith(2);
      expect(source.stop).toHaveBeenCalledWith(2.8);
    }
    for (const n of raw.nodes)
      for (const call of n.gain.linearRampToValueAtTime.mock.calls)
        expect(call.every(Number.isFinite)).toBe(true);
  }
});
it('sampler transposes from the root and seeks into the sample instead of restarting it', () => {
  const raw = context(),
    clip = { instrument: 'sampler', assetId: 'sample', sampleRoot: 'C4' };
  const result = instrumentVoice(
    raw,
    {},
    clip,
    { pitch: 'C5', velocity: 1 },
    10,
    1,
    0.5,
    new Map([['sample', { duration: 5 }]])
  );
  expect(result.sources[0].playbackRate.value).toBe(2);
  expect(result.sources[0].start).toHaveBeenCalledWith(10, 1);
  expect(() => instrumentVoice(raw, {}, clip, { pitch: 'C4', velocity: 1 }, 0, 1)).toThrow(
    'Load a sample'
  );
});

it('orders offline harmonic sums without adding summing nodes to live voices', () => {
  const live = context(),
    offline = context(),
    output = {};
  offline.startRendering = vi.fn();
  const args = [{ instrument: 'piano' }, { pitch: 'C4', velocity: 0.5 }, 0, 1];
  const liveVoice = instrumentVoice(live, output, ...args);
  const offlineVoice = instrumentVoice(offline, output, ...args);
  expect(offlineVoice.sources).toHaveLength(liveVoice.sources.length);
  expect(offlineVoice.nodes.length - liveVoice.nodes.length).toBe(3);
  const sums = offline.nodes.filter((node) => node.gain.value === 1);
  expect(sums).toHaveLength(3);
  expect(sums[0].disconnect).toHaveBeenCalledWith(output);
  expect(sums[0].connect).toHaveBeenLastCalledWith(sums[1]);
  expect(sums[1].connect).toHaveBeenLastCalledWith(sums[2]);
  expect(sums[2].connect).toHaveBeenLastCalledWith(output);
});
it('schedules only a short horizon from 100,000 future notes and reclaims completed voices', () => {
  const notes = Array.from({ length: 100000 }, (_, i) => ({
    pitch: 'C4',
    time: i * 0.5,
    duration: 0.1,
    velocity: 1,
  }));
  const dispose = vi.fn(),
    emit = vi.fn(() => dispose),
    budget = new VoiceBudget(8);
  const scheduler = rollingNotes(notes, 0, 1, 50000, emit, budget);
  scheduler.pump(0.95);
  expect(emit).toHaveBeenCalledTimes(2);
  scheduler.pump(1.3);
  expect(emit).toHaveBeenCalledTimes(3);
  expect(dispose).toHaveBeenCalledTimes(1);
  scheduler.cancel();
  expect(budget.voices).toHaveLength(0);
  scheduler.pump(2);
  expect(emit).toHaveBeenCalledTimes(3);
});
it('keeps notes queued through a 650ms UI stall without widening the missed-note tolerance', () => {
  const emit = vi.fn(() => () => {});
  const notes = Array.from({ length: 20 }, (_, i) => ({ time: i * 0.1, duration: 0.09 }));
  const scheduler = rollingNotes(notes, 0, 1, 2, emit);
  scheduler.pump(0.95);
  const firstBatch = emit.mock.calls.length;
  expect(firstBatch).toBeGreaterThan(5);
  expect(() => scheduler.pump(1.6)).not.toThrow();
  expect(emit.mock.calls[firstBatch][0].start).toBeGreaterThan(1.6);
  expect(() => scheduler.pump(3)).toThrow('fell behind');
  scheduler.cancel();
});
it('resumes held notes on seek, stops explicitly on underrun, and rejects excessive polyphony', () => {
  const emit = vi.fn(() => () => {});
  const scheduler = rollingNotes([{ pitch: 'C4', time: 0, duration: 4 }], 2, 10, 2, emit);
  scheduler.pump(9.9);
  expect(emit.mock.calls[0][0]).toMatchObject({ start: 10, end: 12, elapsed: 2 });
  const late = rollingNotes([{ time: 0, duration: 1 }], 0, 0, 1, emit);
  expect(() => late.pump(0.2)).toThrow('fell behind');
  const budget = new VoiceBudget(2),
    release = budget.reserve(0, 1);
  budget.reserve(0, 1);
  expect(() => budget.reserve(0.5, 1)).toThrow('voice limit');
  release();
  expect(() => budget.reserve(0.5, 1)).not.toThrow();
});
