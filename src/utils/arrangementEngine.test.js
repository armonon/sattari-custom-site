import { describe, expect, it, vi } from 'vitest';
import {
  ArrangementEngine,
  pitchFrequency,
  scheduleArrangement,
  scheduleParameter,
} from './arrangementEngine';
import { audioClip, audioTrack, emptyArrangement } from './arrangementModel';
import { getAudioAsset } from './audioProjectStore';
import { newEffect, rackTopology } from './arrangementEffects';
vi.mock('tone', () => ({ connect: (source, output) => source.connect(output) }));
vi.mock('./audioProjectStore', () => ({ getAudioAsset: vi.fn() }));
function param() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
}
function context() {
  const sources = [],
    gains = [];
  const node = () => ({
    connect: vi.fn(function () {
      return arguments[0];
    }),
    disconnect: vi.fn(),
  });
  const rawContext = {
    currentTime: 10,
    createGain: () => {
      const gain = { ...node(), gain: param() };
      gains.push(gain);
      return gain;
    },
    createStereoPanner: () => ({ ...node(), pan: param() }),
    createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param(), gain: param() }),
    createBufferSource: () => {
      const source = { ...node(), playbackRate: param(), start: vi.fn(), stop: vi.fn() };
      sources.push(source);
      return source;
    },
    createOscillator: () => {
      const source = { ...node(), frequency: param(), start: vi.fn(), stop: vi.fn() };
      sources.push(source);
      return source;
    },
  };
  return { rawContext, sources, gains };
}
function project() {
  const result = emptyArrangement(),
    track = audioTrack('One');
  track.clips.push(audioClip('asset', 'One', 4, 2));
  result.tracks.push(track);
  return result;
}
describe('audio-clock scheduling', () => {
  it('ends a streamed source at its window without restarting the original clip fade', () => {
    const ctx = context(),
      data = project();
    Object.assign(data.tracks[0].clips[0], {
      start: 0,
      duration: 60,
      sourceDuration: 60,
      fadeIn: 12,
      fadeOut: 12,
    });
    scheduleArrangement(
      ctx,
      data,
      new Map([['asset', { duration: 60 }]]),
      8,
      20,
      {},
      { windowDuration: 8 }
    );
    expect(ctx.sources[0].start).toHaveBeenCalledWith(20, 8);
    expect(ctx.sources[0].stop).toHaveBeenCalledWith(28);
    // The attack completes at original t=12 (four seconds into this window).
    expect(
      ctx.gains.some((node) =>
        node.gain.linearRampToValueAtTime.mock.calls.some(
          ([value, time]) => value === 1 && time === 24
        )
      )
    ).toBe(true);
    // An artificial release at the t=16 chunk boundary would cause a dropout.
    expect(
      ctx.gains.every(
        (node) =>
          !node.gain.linearRampToValueAtTime.mock.calls.some(
            ([value, time]) => value === 0 && time === 28
          )
      )
    ).toBe(true);
  });
  it('applies assigned master stem groups to scheduling and live mixer updates', () => {
    const ctx = context(),
      data = project();
    data.tracks[0].stemRole = 'vocals';
    const graph = scheduleArrangement(
      ctx,
      data,
      new Map([['asset', { duration: 20 }]]),
      0,
      20,
      {},
      { masterStems: { vocals: { level: 150 } } }
    );
    expect(graph.controls[0].gain.value).toBe(1.5);
    const engine = new ArrangementEngine(ctx, {});
    engine.graph = graph;
    engine.liveProject = data;
    engine.setMasterSettings({ processing: { stems: { drums: { solo: true } } } });
    expect(graph.controls[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 10, 0.01);
    engine.setMasterSettings({ processing: {} });
    expect(graph.controls[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 10, 0.01);
  });
  it('wraps loop position with the audio clock and schedules contiguous repeated regions', () => {
    const ctx = context(),
      engine = new ArrangementEngine(ctx, {}),
      data = project();
    data.tracks[0].clips[0].start = 0;
    Object.assign(engine, {
      playing: true,
      cursor: 0,
      startedAt: 10,
      loop: { start: 0, end: 1 },
      nextLoopAt: 10,
      nextLoopCursor: 0,
      liveProject: data,
      loopGraphs: [],
      graph: { master: { input: {} } },
      buffers: new Map([['asset', { duration: 20 }]]),
    });
    engine.queueLoops();
    expect(ctx.sources.map((source) => source.start.mock.calls[0][0])).toEqual([10, 11]);
    expect(ctx.sources.map((source) => source.stop.mock.calls[0][0])).toEqual([11, 12]);
    ctx.rawContext.currentTime = 11.25;
    expect(engine.position()).toBe(0.25);
    engine.queueLoops();
    expect(ctx.sources.at(-1).start).toHaveBeenCalledWith(12, 0);
    engine.pause();
    expect(engine.loopGraphs).toHaveLength(0);
  });
  it('keeps muted sources scheduled for live unmute and updates mixer gains without stopping sources', () => {
    const ctx = context(),
      data = project();
    data.tracks[0].muted = true;
    const graph = scheduleArrangement(
      ctx,
      data,
      new Map([['asset', { duration: 20 }]]),
      0,
      20,
      {},
      { liveMix: true }
    );
    expect(ctx.sources).toHaveLength(1);
    expect(graph.controls[0].gain.value).toBe(1);
    const bus = graph.buses.get(data.tracks[0].id);
    expect(bus.output.gain.value).toBe(0);
    const engine = new ArrangementEngine(ctx, {});
    engine.graph = graph;
    data.tracks[0].muted = false;
    data.tracks[0].gain = 150;
    engine.updateMix(data);
    expect(bus.output.gain.setTargetAtTime).toHaveBeenCalledWith(1.5, 10, 0.01);
    expect(ctx.sources[0].stop).toHaveBeenCalledTimes(1);
  });
  it('adds, reorders and removes live inserts without restarting sources or losing automation', () => {
    const ctx = context(),
      data = project(),
      track = data.tracks[0];
    const graph = scheduleArrangement(
      ctx,
      data,
      new Map([['asset', { duration: 20 }]]),
      0,
      10,
      {},
      { liveMix: true }
    );
    const engine = new ArrangementEngine(ctx, {});
    Object.assign(engine, { graph, playing: true, startedAt: 10, cursor: 0, end: 6 });
    const bus = graph.buses.get(track.id),
      mix = bus.output,
      pan = bus.trackPan;
    const first = newEffect('eq'),
      second = newEffect('eq');
    track.effects = [first, second];
    track.automation = {
      volume: [
        { time: 0, value: 100 },
        { time: 4, value: 50 },
      ],
      [`fx:${first.id}:low`]: [
        { time: 0, value: 0 },
        { time: 4, value: 12 },
      ],
    };
    ctx.rawContext.currentTime = 11;
    engine.updateMix(data);
    expect(bus.topology).toBe(rackTopology(track.effects));
    expect(
      bus.automationBindings[`fx:${first.id}:low`][0].param.setValueAtTime
    ).toHaveBeenLastCalledWith(3, 11);
    expect(
      bus.automationBindings[`fx:${first.id}:low`][0].param.linearRampToValueAtTime
    ).toHaveBeenCalledWith(12, 14);
    track.effects.reverse();
    engine.updateMix(data);
    expect(bus.topology).toBe(rackTopology(track.effects));
    expect(
      bus.automationBindings[`fx:${first.id}:low`][0].param.setValueAtTime
    ).toHaveBeenLastCalledWith(3, 11);
    track.effects = [];
    track.automation = { volume: track.automation.volume };
    engine.updateMix(data);
    expect(bus.output).toBe(mix);
    expect(bus.trackPan).toBe(pan);
    expect(mix.gain.setValueAtTime).toHaveBeenLastCalledWith(0.875, 11);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0].start).toHaveBeenCalledTimes(1);
    expect(ctx.sources[0].stop).toHaveBeenCalledTimes(1);
    engine.pause();
  });
  it('does not publish a rejected insert edit to the next streaming window', () => {
    const ctx = context(),
      data = project();
    const graph = scheduleArrangement(
      ctx,
      data,
      new Map([['asset', { duration: 20 }]]),
      0,
      10,
      {},
      { liveMix: true }
    );
    const engine = new ArrangementEngine(ctx, {});
    Object.assign(engine, {
      graph,
      liveProject: data,
      playing: true,
      startedAt: 10,
      cursor: 0,
      end: 6,
    });
    const rejected = structuredClone(data);
    rejected.tracks[0].effects = [{ id: 'bad', type: 'native', bypass: false, params: {} }];
    expect(() => engine.updateMix(rejected)).toThrow();
    expect(engine.liveProject).toBe(data);
    expect(engine.end).toBe(6);
    expect(graph.buses.get(data.tracks[0].id).topology).toBe('[]');
    engine.pause();
  });
  it('schedules start, source offset and hard stop using audio time', () => {
    const ctx = context(),
      data = project();
    data.tracks[0].clips.push(audioClip('asset', 'Two', 2, 10));
    scheduleArrangement(ctx, data, new Map([['asset', { duration: 20 }]]), 3, 20, {});
    expect(ctx.sources[0].start).toHaveBeenCalledWith(20, 1);
    expect(ctx.sources[0].stop).toHaveBeenCalledWith(23);
    expect(ctx.sources[1].start).toHaveBeenCalledWith(27, 0);
    expect(ctx.sources[1].stop).toHaveBeenCalledWith(29);
  });
  it('interpolates automation on seek and holds its final value beyond the last point', () => {
    const target = param();
    scheduleParameter(
      target,
      [
        { time: 0, value: 0 },
        { time: 2, value: 200 },
      ],
      1,
      3,
      10,
      100,
      (v) => v / 100
    );
    expect(target.setValueAtTime).toHaveBeenCalledWith(1, 10);
    expect(target.linearRampToValueAtTime).toHaveBeenCalledWith(2, 11);
    expect(target.linearRampToValueAtTime).toHaveBeenLastCalledWith(2, 13);
  });
  it('does not start partial audio if any scheduled source is missing or too short', () => {
    const ctx = context(),
      data = project();
    data.tracks[0].clips.push(audioClip('missing', 'Missing', 2));
    expect(() =>
      scheduleArrangement(ctx, data, new Map([['asset', { duration: 20 }]]), 0, 20, {})
    ).toThrow('Missing audio');
    expect(ctx.sources).toHaveLength(0);
    expect(() =>
      scheduleArrangement(ctx, project(), new Map([['asset', { duration: 1 }]]), 0, 20, {})
    ).toThrow('exceeds');
    expect(ctx.sources).toHaveLength(0);
  });
  it('schedules actual polyphonic oscillator notes and resumes notes spanning a seek', () => {
    const ctx = context(),
      data = project();
    Object.assign(data.tracks[0].clips[0], {
      kind: 'midi',
      notes: [
        { pitch: 'A4', time: 0, duration: 2, velocity: 0.7 },
        { pitch: 'C4', time: 1, duration: 1, velocity: 0.5 },
      ],
    });
    scheduleArrangement(ctx, data, new Map(), 3, 20, {});
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0].frequency.value).toBe(440);
    expect(ctx.sources[0].start).toHaveBeenCalledWith(20);
    expect(ctx.sources[0].stop).toHaveBeenCalledWith(21);
    expect(pitchFrequency('C4')).toBeCloseTo(261.626, 2);
  });
  it('reads transport position from the audio clock, including initial scheduling lead', () => {
    const ctx = context(),
      engine = new ArrangementEngine(ctx, {});
    Object.assign(engine, { playing: true, cursor: 3, startedAt: 11, end: 12 });
    expect(engine.position()).toBe(3);
    ctx.rawContext.currentTime = 13;
    expect(engine.position()).toBe(5);
    expect(engine.pause()).toBe(5);
    ctx.rawContext.currentTime = 99;
    expect(engine.position()).toBe(5);
  });
  it('fails missing-asset preparation and cancels a late decode after pause', async () => {
    const ctx = context(),
      engine = new ArrangementEngine(ctx, {});
    getAudioAsset.mockResolvedValueOnce(null);
    await expect(engine.play(project())).rejects.toThrow('missing');
    let resolve;
    engine.prepare = () =>
      new Promise((done) => {
        resolve = done;
      });
    const pending = engine.play(project());
    engine.pause();
    resolve();
    expect(await pending).toBe(false);
    expect(engine.playing).toBe(false);
  });
  it('refuses unsafe export allocations before decoding audio', async () => {
    const engine = new ArrangementEngine(context(), {});
    engine.prepare = vi.fn();
    await expect(engine.render(project(), {}, null, 48000, 9000)).rejects.toThrow('render budget');
    expect(engine.prepare).not.toHaveBeenCalled();
  });
});
