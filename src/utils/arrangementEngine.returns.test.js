import { describe, expect, it, vi } from 'vitest';
import { returnsTail, scheduleArrangement, usedReturnBuses } from './arrangementEngine';
import { audioClip, audioTrack, emptyArrangement, validateArrangement } from './arrangementModel';
import { DEFAULT_RETURNS, returnTail, sendGain } from './mixerReturns';
vi.mock('tone', () => ({ connect: (source, output) => source.connect(output) }));
vi.mock('./audioProjectStore', () => ({ getAudioAsset: vi.fn() }));

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  setTargetAtTime: vi.fn(),
});
function context() {
  const node = () => ({
    connect: vi.fn(function () {
      return arguments[0];
    }),
    disconnect: vi.fn(),
  });
  const rawContext = {
    currentTime: 10,
    createGain: () => ({ ...node(), gain: param() }),
    createStereoPanner: () => ({ ...node(), pan: param() }),
    createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param(), gain: param() }),
    createBufferSource: () => ({ ...node(), playbackRate: param(), start: vi.fn(), stop: vi.fn() }),
  };
  return { rawContext };
}
function project(sends = {}) {
  const data = emptyArrangement();
  for (const name of ['lead', 'bass', 'pad']) {
    const track = { ...audioTrack(name), id: name };
    track.clips.push({ ...audioClip('asset', name, 4, 0), id: `${name}-clip` });
    if (sends[name]) track.sends = sends[name];
    data.tracks.push(track);
  }
  return data;
}

describe('return usage', () => {
  it('lists only buses an audible-in-principle track sends to', () => {
    expect(usedReturnBuses(project())).toEqual([]);
    const data = project({ lead: { a: 40, b: 0 }, bass: { b: 10 }, pad: { a: 0 } });
    expect(usedReturnBuses(data)).toEqual(['a', 'b']);
    expect(usedReturnBuses(data, 'bass')).toEqual(['b']);
    expect(usedReturnBuses(data, 'pad')).toEqual([]);
    data.tracks[0].offline = true;
    expect(usedReturnBuses(data)).toEqual(['b']);
  });

  it('adds no tail without sends and follows the session tempo with them', () => {
    expect(returnsTail(project(), { bpm: 90 })).toBe(0);
    const data = project({ lead: { a: 40 }, bass: { b: 10 } });
    const returns = { a: { decay: 1 }, b: { division: '1/2', feedback: 60 } };
    const expected = Math.max(
      returnTail('a', { ...DEFAULT_RETURNS.a, decay: 1 }, 90),
      returnTail('b', { ...DEFAULT_RETURNS.b, division: '1/2', feedback: 60 }, 90)
    );
    expect(returnsTail(data, { bpm: 90, returns })).toBeCloseTo(expected, 12);
    expect(returnsTail(data, { bpm: 90, returns })).toBeGreaterThan(
      returnsTail(data, { bpm: 180, returns })
    );
    expect(returnsTail(data, { returns }, 'lead')).toBeCloseTo(
      returnTail('a', { ...DEFAULT_RETURNS.a, decay: 1 }),
      12
    );
  });
});

describe('track sends', () => {
  it('validates send amounts in saved projects', () => {
    expect(() => validateArrangement(project({ lead: { a: 0, b: 100 } }))).not.toThrow();
    for (const sends of [{ c: 10 }, { a: 101 }, { a: NaN }, { b: -1 }, 'loud'])
      expect(() => validateArrangement(project({ lead: sends }))).toThrow(
        'Project contains invalid arrangement data.'
      );
  });

  it('taps sending tracks after pan and leaves the rest on their original graph', () => {
    const ctx = context(),
      output = { id: 'master' };
    const inputs = { a: { id: 'return-a' }, b: { id: 'return-b' } };
    const graph = scheduleArrangement(
      ctx,
      project({ lead: { a: 50, b: 0 } }),
      new Map([['asset', { duration: 10 }]]),
      0,
      0,
      output,
      { returnInputs: (bus) => inputs[bus] }
    );
    expect([...graph.buses.keys()]).toEqual(['lead']);
    const rack = graph.buses.get('lead');
    expect(rack.trackPan.connect).toHaveBeenCalledWith(rack.sends.a);
    expect(rack.sends.a.connect).toHaveBeenCalledWith(inputs.a);
    expect(rack.sends.a.gain.value).toBe(sendGain(50));
    expect(rack.sends.b).toBeUndefined();
    expect(rack.nodes).toContain(rack.sends.a);
  });

  it('builds no track buses for sends when no returns are available', () => {
    const graph = scheduleArrangement(
      context(),
      project({ lead: { a: 50 } }),
      new Map([['asset', { duration: 10 }]]),
      0,
      0,
      { id: 'master' },
      {}
    );
    expect(graph.buses.size).toBe(0);
  });
});
