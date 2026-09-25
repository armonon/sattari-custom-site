import { describe, it, expect } from 'vitest';
import {
  audioClip,
  audioTrack,
  emptyArrangement,
  repeatLinkedPattern,
  updatePatternClip,
  resizeClip,
  splitClip,
  retimeMidi,
  validateArrangement,
} from './arrangementModel';

function fixture() {
  const track = { ...audioTrack('Keys'), kind: 'midi' };
  track.clips = [
    {
      ...audioClip('', 'Pattern', 2),
      kind: 'midi',
      timebase: 'beats',
      instrument: 'piano',
      notes: [{ pitch: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
    },
  ];
  return { ...emptyArrangement(), tracks: [track] };
}
describe('linked instrument patterns', () => {
  it('stores a shared definition, repeats in place and updates every instance without moving it', () => {
    const original = fixture(),
      id = original.tracks[0].clips[0].id;
    const linked = repeatLinkedPattern(original, id);
    expect(original.tracks[0].clips).toHaveLength(1);
    expect(linked.tracks[0].clips.map((c) => c.start)).toEqual([0, 2]);
    const notes = [{ pitch: 'E4', time: 0.5, duration: 1, velocity: 0.3 }];
    const edited = updatePatternClip(linked, id, { notes, instrument: 'electric' });
    expect(
      edited.tracks[0].clips.every(
        (clip) => clip.notes[0].pitch === 'E4' && clip.instrument === 'electric'
      )
    ).toBe(true);
    expect(Object.values(edited.patterns)[0].notes).toEqual(notes);
    expect(validateArrangement(JSON.parse(JSON.stringify(edited)))).toBeTruthy();
  });
  it('detaches a trimmed/split instance and leaves the others intact', () => {
    const project = fixture(),
      id = project.tracks[0].clips[0].id;
    const linked = repeatLinkedPattern(project, id);
    expect(resizeClip(linked.tracks[0].clips[0], 1).patternId).toBeUndefined();
    const trimmed = updatePatternClip(linked, id, resizeClip(linked.tracks[0].clips[0], 0.25));
    expect(trimmed.tracks[0].clips[1].notes[0].duration).toBe(0.5);
    expect(trimmed.tracks[0].clips[0].patternId).toBeUndefined();
    expect(splitClip(linked.tracks[0].clips[0], 0.25).every((clip) => !clip.patternId)).toBe(true);
    const detached = updatePatternClip(linked, id, { patternId: undefined });
    const edited = updatePatternClip(detached, id, { notes: [] });
    expect(edited.tracks[0].clips[1].notes).toHaveLength(1);
  });
  it('retimes definitions and all beat-based instances together', () => {
    const project = fixture(),
      id = project.tracks[0].clips[0].id;
    const retimed = retimeMidi(repeatLinkedPattern(project, id), 120, 60);
    expect(retimed.tracks[0].clips.map((c) => c.start)).toEqual([0, 4]);
    expect(Object.values(retimed.patterns)[0].notes[0].duration).toBe(1);
    expect(validateArrangement(retimed)).toBeTruthy();
  });
});
