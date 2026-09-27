import { it, expect, vi } from 'vitest';
import {
  reconstructPerformance,
  performanceAssetIds,
  relinkPerformanceAssets,
} from './performanceReplay';
import { emptyArrangement, validateArrangement } from './arrangementModel';
const capture = () => ({
  assetId: 'safety',
  name: 'Set',
  duration: 8,
  timelineStart: 10,
  events: [
    {
      time: 0,
      type: 'initialState',
      args: [
        {
          crossfader: 0,
          decks: [
            {
              id: 'A',
              playing: true,
              position: 2,
              gain: 100,
              fader: 100,
              side: 'left',
              lanes: {
                vocals: { assetId: 'dry', name: 'Vocal', duration: 30, level: 100 },
              },
            },
          ],
        },
      ],
    },
    { time: 2, type: 'setDeckGain', args: ['A', 50] },
    { time: 3, type: 'deckTransport', args: ['A', { position: 12, playing: true, rate: 1 }] },
    { time: 5, type: 'deckTransport', args: ['A', { position: 14, playing: false, rate: 1 }] },
  ],
});
it('reconstructs loop boundaries at confirmed audible time after a save/reopen round trip', () => {
  const take = capture();
  take.timelineStart = 0;
  take.duration = 2;
  take.events = take.events.slice(0, 1);
  take.events[0].args[0].decks[0].position = 0;
  take.events.push({
    type: 'setLoopRegion',
    time: 1,
    scheduledTime: 1.1,
    sampleRate: 48000,
    scheduledFrame: 52800,
    args: ['A', true, 0, 0.5],
  });
  const saved = JSON.stringify(take);
  const result = reconstructPerformance(emptyArrangement(), JSON.parse(saved));
  expect(result.tracks[0].clips[0].duration).toBeCloseTo(1.1, 8);
  expect(result.tracks[0].clips[1].start).toBeCloseTo(1.1, 8);
  expect(JSON.stringify(take)).toBe(saved);
});
it('orders mix changes by audible time and excludes changes after the take ends', () => {
  const take = capture();
  take.timelineStart = 0;
  take.duration = 3;
  take.events = take.events.slice(0, 1);
  take.events.push(
    { type: 'setDeckGain', time: 0.8, scheduledTime: 1.2, args: ['A', 10] },
    { type: 'setDeckGain', time: 1, scheduledTime: 1.1, args: ['A', 50] },
    { type: 'setDeckGain', time: 2.9, scheduledTime: 3.1, args: ['A', 0] }
  );
  const result = reconstructPerformance(emptyArrangement(), take);
  const points = result.tracks[0].automation.volume;
  expect(points.some((p) => Math.abs(p.time - 1.125) < 1e-8)).toBe(true);
  expect(points.at(-1).time).toBeCloseTo(1.225, 8);
  expect(points.at(-1).value).toBeGreaterThan(0);
  expect(points.every((p, i) => !i || p.time >= points[i - 1].time)).toBe(true);
});
it('preserves valid continuous automation when rapid knob moves interrupt a ramp', () => {
  const take = capture();
  take.timelineStart = 0;
  take.events = take.events.slice(0, 1);
  take.events.push(
    { type: 'setDeckGain', time: 1, args: ['A', 0] },
    { type: 'setDeckGain', time: 1.01, args: ['A', 100] },
    { type: 'setDeckGain', time: 1.01, args: ['A', 50] }
  );
  const result = reconstructPerformance(emptyArrangement(), take);
  const points = result.tracks[0].automation.volume;
  expect(points.every((p, i) => !i || p.time > points[i - 1].time)).toBe(true);
  const held = points.find((p) => p.time === 1.01);
  expect(held.value).toBeGreaterThan(0);
  expect(held.value).toBeLessThan(points[0].value);
  expect(() => validateArrangement(result.project)).not.toThrow();
});
it('reopens stored events into editable source intervals and absolute gain automation', () => {
  const take = JSON.parse(JSON.stringify(capture()));
  const result = reconstructPerformance(emptyArrangement(), take);
  const track = result.project.tracks[0];
  expect(track.muted).toBe(true);
  expect(track.stemRole).toBe('vocals');
  expect(track.clips.map((clip) => [clip.start, clip.offset, clip.duration])).toEqual([
    [10, 2, 3],
    [13, 12, 2],
  ]);
  expect(track.automation.volume.at(-1).time).toBe(12.025);
  expect(() => validateArrangement(result.project)).not.toThrow();
  take.events[2].args[1].position = 17;
  expect(reconstructPerformance(emptyArrangement(), take).project.tracks[0].clips[1].offset).toBe(
    17
  );
});
it('keeps referenced source assets in portable backups and relinks event snapshots', () => {
  const take = capture();
  expect(performanceAssetIds([take]).sort()).toEqual(['dry', 'safety']);
  relinkPerformanceAssets([take], new Map([['dry', 'restored-dry']]));
  expect(performanceAssetIds([take])).toContain('restored-dry');
});
it('reports unsupported effect replay without silently replacing the safety take', () => {
  const take = capture();
  take.events.push({ time: 2, type: 'setDeckFx', args: ['A', { echo: 40 }] });
  expect(reconstructPerformance(emptyArrangement(), take).warnings).toContain('setDeckFx');
});

it('uses the canonical editability report and warns about opening key-locked rate processing', () => {
  const take = capture();
  Object.assign(take.events[0].args[0].decks[0], { keyLock: true, playbackRate: 1.25 });
  const result = reconstructPerformance(emptyArrangement(), take);
  expect(result.support.qualified).toBe(false);
  expect(result.warnings).toContain('Printed audio required: Opening key-locked tempo processing');
  expect(result.tracks.every((track) => track.muted)).toBe(true);
  expect(take.assetId).toBe('safety');
});
it('validates retained original event history and capture bounds when reopening', () => {
  const take = capture();
  take.originalEvents = structuredClone(take.events);
  const project = { ...emptyArrangement(), captures: [take] };
  expect(() => validateArrangement(project)).not.toThrow();
  take.originalEvents[0].time = -1;
  expect(() => validateArrangement(project)).toThrow();
  take.originalEvents[0].time = 0;
  take.duration = Infinity;
  expect(() => validateArrangement(project)).toThrow();
});
it('rejects corrupted optional audio-clock metadata without breaking legacy captures', () => {
  const take = capture();
  const project = { ...emptyArrangement(), captures: [take] };
  take.events[1].scheduledTime = Infinity;
  expect(() => validateArrangement(project)).toThrow();
  take.events[1].scheduledTime = 2.1;
  take.events[1].sampleRate = 48000;
  take.events[1].scheduledFrame = 100800;
  expect(() => validateArrangement(project)).not.toThrow();
});
it('retains songs loaded into an initially empty lane during a set', () => {
  const take = capture();
  take.events[0].args[0].decks[0].lanes.vocals = { assetId: '', duration: 0 };
  take.events.splice(1, 0, {
    time: 1,
    type: 'setLaneState',
    args: [
      'A',
      'vocals',
      { assetId: 'loaded-later', duration: 30, name: 'Next song', status: 'ready' },
    ],
  });
  const result = reconstructPerformance(emptyArrangement(), take);
  expect(result.project.tracks[0].clips[0]).toMatchObject({ start: 11, assetId: 'loaded-later' });
  expect(performanceAssetIds([take])).toContain('loaded-later');
});

it('expands loop passes into source-correct editable regions and exits at the current loop position', () => {
  const take = capture();
  take.duration = 7;
  take.timelineStart = 0;
  take.events = take.events.slice(0, 1);
  Object.assign(take.events[0].args[0].decks[0], {
    position: 2,
    looping: true,
    loopStart: 2,
    loopEnd: 4,
  });
  take.events.push({ time: 5, type: 'setLoopRegion', args: ['A', false, 2, 4] });
  const result = reconstructPerformance(emptyArrangement(), take);
  expect(result.tracks[0].clips.map((c) => [c.start, c.offset, c.duration])).toEqual([
    [0, 2, 2],
    [2, 2, 2],
    [4, 2, 1],
    [5, 3, 2],
  ]);
  expect(result.warnings).not.toContain('setLoopRegion');
});

it('creates late lanes and stops removed lanes instead of retaining stale audio', () => {
  const take = capture();
  take.timelineStart = 0;
  take.events = take.events.slice(0, 1);
  take.events.push(
    { time: 1, type: 'setLaneState', args: ['A', 'drums', { assetId: 'drums', duration: 30 }] },
    { time: 4, type: 'removeLane', args: ['A', 'drums'] }
  );
  const result = reconstructPerformance(emptyArrangement(), take);
  const row = result.tracks.find((t) => t.stemRole === 'drums');
  expect(row.clips).toHaveLength(1);
  expect(row.clips[0]).toMatchObject({ start: 1, duration: 3, offset: 3 });
});

it('preserves master stem mute in editable volume automation', () => {
  const take = capture();
  take.events.push({ time: 4, type: 'setMasterStems', args: [{ vocals: { muted: true } }] });
  const row = reconstructPerformance(emptyArrangement(), take).tracks[0];
  expect(row.automation.volume.at(-1)).toMatchObject({ time: 14.025, value: 0 });
});

it('reports sub-millisecond loop fragments without creating an invalid project', () => {
  const take = capture();
  take.duration = 6.0005;
  take.events = take.events.slice(0, 1);
  Object.assign(take.events[0].args[0].decks[0], {
    position: 0,
    looping: true,
    loopStart: 0,
    loopEnd: 2,
  });
  const result = reconstructPerformance(emptyArrangement(), take);
  expect(result.tracks[0].clips).toHaveLength(3);
  expect(result.warnings.join(' ')).toContain('Sub-millisecond');
});

it('re-derives journaled sync intent into tempo- and phase-locked follower regions', () => {
  // A leads at 120 BPM. B (100 BPM grid) opens 0.25 beat early and later lands a
  // user seek 0.35 beat off; only intent and user transport are journaled.
  const lane = (assetId) => ({ fullMix: { assetId, duration: 600 } });
  const grid = (id, bpm) => ({ id, bpm, beatOffset: 0, syncQuantum: 1, followTempoMap: false });
  const take = {
    assetId: 'safety',
    duration: 40,
    timelineStart: 0,
    events: [
      {
        time: 0,
        type: 'initialState',
        args: [
          {
            decks: [
              { id: 'A', playing: true, position: 0, playbackRate: 1, lanes: lane('a') },
              { id: 'B', playing: true, position: 0.15, playbackRate: 1.2, lanes: lane('b') },
            ],
          },
        ],
      },
      { time: 0, scheduledTime: 0, type: 'setProjectTempo', args: [120, 0] },
      {
        time: 0,
        scheduledTime: 0,
        type: 'setDeckSync',
        args: ['B', true, grid('B', 100), grid('A', 120)],
      },
      { time: 0, type: 'deckTransport', args: ['A', { position: 0, playing: true, rate: 1 }] },
      {
        time: 20,
        type: 'deckTransport',
        args: ['B', { action: 'seek', position: 60.21, playing: true, rate: 1.2034 }],
      },
    ],
  };
  const { tracks } = reconstructPerformance(emptyArrangement(), take);
  const clips = tracks.find((track) => track.name.includes('Replay B')).clips;
  const positionAt = (time) => {
    const clip = clips.findLast((item) => item.start <= time);
    return clip.offset + (time - clip.start) * clip.rate;
  };
  const phase = (time) => {
    const error = ((time * 120) / 60 - (positionAt(time) * 100) / 60) % 1;
    return Math.min(Math.abs(error), 1 - Math.abs(error));
  };
  expect(phase(0)).toBeCloseTo(0.25, 6); // as journaled
  expect(phase(19)).toBeLessThan(0.005); // slewed into phase, not left 0.25 beat early
  expect(phase(20)).toBeCloseTo(0.35, 6); // the user's seek is kept exactly
  expect(phase(39.9)).toBeLessThan(0.005);
  // Tempo lock is the leader's tempo on B's grid, not the instantaneous
  // correction journaled with the seek, and slews stay within +/-2%.
  expect(clips.at(-1).rate).toBeCloseTo(1.2, 4);
  expect(
    clips.every((clip) => clip.rate >= 1.2 * 0.98 - 1e-9 && clip.rate <= 1.2 * 1.02 + 1e-9)
  ).toBe(true);
  expect(clips.length).toBeLessThan(80);
  // Contiguous regions: every piece starts where the previous one ended.
  for (let i = 1; i < clips.length; i++)
    if (clips[i].start !== 20)
      expect(clips[i].offset).toBeCloseTo(
        clips[i - 1].offset + clips[i - 1].duration * clips[i - 1].rate,
        9
      );
  expect(() => validateArrangement({ ...emptyArrangement(), tracks })).not.toThrow();
});

it('reconstructs a tempo-following leader from its journaled tempo map, not per-step events', () => {
  const beats = Array.from({ length: 200 }, (_, i) => ({
    time: i * 0.6 + (i > 50 ? (i - 50) * 0.01 : 0),
  }));
  const take = {
    assetId: 'safety',
    duration: 30,
    timelineStart: 0,
    events: [
      {
        time: 0,
        type: 'initialState',
        args: [
          {
            decks: [
              {
                id: 'A',
                playing: true,
                position: 0,
                playbackRate: 1.2,
                lanes: { fullMix: { assetId: 'a', duration: 600 } },
              },
            ],
          },
        ],
      },
      { time: 0, type: 'deckTransport', args: ['A', { position: 0, playing: true, rate: 1.2 }] },
      { time: 0, scheduledTime: 0, type: 'setTempoFollow', args: ['A', beats, 120] },
    ],
  };
  const clips = reconstructPerformance(emptyArrangement(), take).tracks[0].clips;
  // 100 BPM until beat 50 (30 s of source = 25 s), then gradually slower.
  expect(clips[0].rate).toBeCloseTo(1.2, 3);
  expect(clips.at(-1).rate).toBeGreaterThan(1.2);
  expect(clips.length).toBeLessThan(40);
});

it('skips damaged journal rows when reopening a take, like replay does', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const clean = reconstructPerformance(emptyArrangement(), capture());
    const damaged = capture();
    damaged.events.push(
      { time: 4, type: 'deckTransport', args: ['A', { position: NaN, playing: true, rate: 1 }] },
      { time: 4.5, type: 'setDeckGain', args: ['A', Infinity] },
      { time: NaN, type: 'setDeckGain', args: ['A', 20] }
    );
    const result = reconstructPerformance(emptyArrangement(), damaged);
    expect(result.warnings).toContain('3 damaged event(s) with invalid values were skipped.');
    expect(result.tracks.map((track) => [track.clips, track.automation])).toEqual(
      clean.tracks
        .map((track) => [track.clips, track.automation])
        .map(([clips, automation]) => [
          clips.map((clip) => ({ ...clip, id: expect.any(String) })),
          automation,
        ])
    );
    expect(() => validateArrangement(result.project)).not.toThrow();
    expect(warn).toHaveBeenCalled();
  } finally {
    warn.mockRestore();
  }
});
