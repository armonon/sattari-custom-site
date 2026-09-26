import { it, expect } from 'vitest';
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
