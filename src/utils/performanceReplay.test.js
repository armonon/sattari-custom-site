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
