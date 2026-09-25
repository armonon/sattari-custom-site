import { it, expect } from 'vitest';
import { playbackWindow, needsStreaming } from './arrangementStreaming';
it('streams dense short projects but counts linked source assets only once', () => {
  const clips = Array.from({ length: 8 }, (_, i) => ({
    assetId: `asset-${i}`,
    start: 0,
    duration: 60,
  }));
  expect(needsStreaming({ tracks: [{ clips }] })).toBe(true);
  expect(
    needsStreaming({ tracks: [{ clips: clips.map((clip) => ({ ...clip, assetId: 'shared' })) }] })
  ).toBe(false);
  expect(needsStreaming({ tracks: [{ clips: [{ duration: 900, disabled: true }] }] })).toBe(false);
});
it('retains original fades, note phase and coordinates while excluding distant/offline clips', () => {
  const clip = { id: 'long', kind: 'audio', start: 0, duration: 7200, fadeIn: 12 };
  const project = {
    tracks: [
      { id: 'a', clips: [clip, { start: 9000, duration: 8 }] },
      { id: 'b', offline: true, clips: [clip] },
    ],
  };
  expect(needsStreaming(project)).toBe(true);
  const result = playbackWindow(project, 500, 508);
  expect(result.tracks).toHaveLength(1);
  expect(result.tracks[0].clips).toEqual([clip]);
  expect(result.tracks[0].clips[0]).toBe(clip);
});
it('does not duplicate a clip that ends exactly at a window boundary', () => {
  expect(
    playbackWindow(
      {
        tracks: [
          {
            clips: [
              { start: 0, duration: 8 },
              { start: 8, duration: 8 },
            ],
          },
        ],
      },
      8,
      16
    ).tracks[0].clips
  ).toEqual([{ start: 8, duration: 8 }]);
});
