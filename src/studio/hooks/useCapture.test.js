import { describe, expect, it } from 'vitest';
import { withCapturedTake } from './useCapture';

describe('finished capture timeline', () => {
  it.each([0.312, 15.2])(
    'preserves the source/event clock independently of reference duration %s',
    (duration) => {
      const event = { type: 'transport', time: 14.9, deckId: 'D' };
      const capture = { assetId: 'new-master', duration: 15, events: [event] };
      const previous = { assetId: 'previous-master', duration: 9, events: [] };
      const project = { tracks: [], captures: [previous] };
      const reference = {
        duration,
        track: { id: 'master', role: 'reference', clips: [{ duration }] },
      };
      const result = withCapturedTake(project, { blob: {}, sourceTracks: [], capture, reference });
      expect(result.captures).toEqual([previous, capture]);
      expect(result.captures[1].events[0].time).toBeLessThanOrEqual(result.captures[1].duration);
      expect(result.tracks[0].clips[0].duration).toBe(duration);
      expect(project).toEqual({ tracks: [], captures: [previous] });
    }
  );
});
