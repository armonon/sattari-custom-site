import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CueRouter,
  DEFAULT_CUE,
  glide,
  headphoneGains,
  normalizeCue,
  outputCapabilities,
} from './cueRouting';

const param = (value = 1) => ({
  value,
  cancelAndHoldAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(function (next) {
    this.value = next;
  }),
});
const node = (kind) => ({
  kind,
  gain: param(1),
  connect: vi.fn((target) => target),
  disconnect: vi.fn(),
});
function fakeRaw(maxChannelCount = 2) {
  const destination = {
    kind: 'destination',
    maxChannelCount,
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  };
  return {
    currentTime: 3,
    destination,
    createGain: () => node('gain'),
    createChannelMerger: () => node('merger'),
    createChannelSplitter: () => node('splitter'),
  };
}
function router(maxChannelCount) {
  const raw = fakeRaw(maxChannelCount);
  const links = new Set();
  const connect = vi.fn((from, to) => links.add(`${from.kind}>${to.kind}`));
  const disconnect = vi.fn((from, to) => links.delete(`${from.kind}>${to.kind}`));
  const speaker = { ...node('speaker'), gain: param(1) };
  const cue = new CueRouter({
    raw,
    program: node('program'),
    monitor: node('monitor'),
    cue: node('cue'),
    speaker,
    speakers: raw.destination,
    connect,
    disconnect,
  });
  return { raw, cue, speaker, connect, disconnect, links };
}

afterEach(() => vi.useRealTimers());

describe('cue settings', () => {
  it('normalizes mode, mix and level, keeping current values for damaged input', () => {
    expect(normalizeCue()).toEqual(DEFAULT_CUE);
    expect(normalizeCue({ mode: 'split', mix: '25', level: 140 })).toEqual({
      mode: 'split',
      mix: 25,
      level: 100,
    });
    expect(normalizeCue({ mode: 'tape', mix: NaN }, { mode: 'split', mix: 40, level: 60 })).toEqual(
      { mode: 'split', mix: 40, level: 60 }
    );
  });

  it('blends cue and program for the headphones', () => {
    expect(headphoneGains({ mix: 0, level: 100 })).toEqual({ cue: 1, program: 0, level: 1 });
    expect(headphoneGains({ mix: 100, level: 0 })).toEqual({ cue: 0, program: 1, level: 0 });
  });

  it('reports a four-channel device as multichannel', () => {
    expect(outputCapabilities(fakeRaw(2)).multichannel).toBe(false);
    expect(outputCapabilities(fakeRaw(4))).toMatchObject({
      maxChannelCount: 4,
      multichannel: true,
      sinkSelectable: false,
    });
  });

  it('glides from the sounding value', () => {
    const gain = param(0.4);
    glide(gain, 1, 2);
    expect(gain.cancelAndHoldAtTime).toHaveBeenCalledWith(2);
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 2.02);
  });
});

describe('cue router', () => {
  it('builds nothing while cue is off, so the speaker path is untouched', () => {
    const { cue, connect } = router();
    expect(cue.set({ mode: 'off', mix: 30 })).toBe('off');
    expect(cue.nodes).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });

  it('connects only the active route and detaches the idle one after the fade', () => {
    vi.useFakeTimers();
    const { cue, speaker, links } = router();
    expect(cue.set({ mode: 'split' })).toBe('split');
    expect(links.has('gain>destination')).toBe(true);
    expect(speaker.gain.value).toBe(0);
    expect(cue.nodes.split.gain.value).toBe(1);
    expect(cue.set({ mode: 'off' })).toBe('off');
    expect(speaker.gain.value).toBe(1);
    vi.advanceTimersByTime(100);
    expect(cue.connected.split).toBe(false);
    expect(links.has('gain>destination')).toBe(false);
  });

  it('falls back to off when the device has fewer than four outputs', () => {
    const { cue } = router(2);
    expect(cue.set({ mode: 'multichannel' })).toBe('off');
    expect(cue.state.mode).toBe('off');
  });

  it('reconfigures a four-channel device for outputs 3-4 and restores it when leaving', () => {
    vi.useFakeTimers();
    const { cue, raw } = router(4);
    expect(cue.set({ mode: 'multichannel', mix: 20, level: 90 })).toBe('multichannel');
    vi.advanceTimersByTime(100);
    expect(raw.destination.channelCount).toBe(4);
    expect(raw.destination.channelInterpretation).toBe('discrete');
    expect(cue.connected.multichannel).toBe(true);
    expect(cue.set({ mode: 'off' })).toBe('off');
    vi.advanceTimersByTime(100);
    expect(raw.destination.channelCount).toBe(2);
    expect(raw.destination.channelInterpretation).toBe('speakers');
    expect(cue.connected.multichannel).toBe(false);
  });

  it('stays off without a speaker path (offline or unmonitored engines)', () => {
    const raw = fakeRaw(4);
    const cue = new CueRouter({ raw, speaker: null, connect: vi.fn(), disconnect: vi.fn() });
    expect(cue.set({ mode: 'split', mix: 50 })).toBe('off');
    expect(cue.state).toMatchObject({ mode: 'off', mix: 50 });
  });

  it('drops multichannel after switching to a stereo device', () => {
    vi.useFakeTimers();
    const { cue, raw } = router(4);
    cue.set({ mode: 'multichannel' });
    vi.advanceTimersByTime(100);
    cue.duck();
    raw.destination.maxChannelCount = 2;
    expect(cue.refresh()).toBe('off');
    vi.advanceTimersByTime(100);
    expect(cue.connected.multichannel).toBe(false);
  });

  it('disposes pending timers and every node', () => {
    vi.useFakeTimers();
    const { cue } = router();
    cue.set({ mode: 'split' });
    const nodes = Object.values(cue.nodes);
    cue.dispose();
    expect(cue.nodes).toBeNull();
    for (const item of nodes) expect(item.disconnect).toHaveBeenCalled();
    expect(() => vi.advanceTimersByTime(100)).not.toThrow();
  });
});
