import { describe, expect, it } from 'vitest';
import {
  audioClip,
  audioTrack,
  emptyArrangement,
  repairArrangement,
  sanitizeArrangement,
  validateArrangement,
} from './arrangementModel';

const project = (...tracks) => ({ ...emptyArrangement(), tracks });
const track = (name, ...clips) => ({ ...audioTrack(name), clips });

describe('short clips', () => {
  it('never gives a clip fades longer than itself', () => {
    const clip = audioClip('a', 'Blip', 0.002);
    expect(clip.fadeIn).toBe(0.002);
    expect(clip.fadeOut).toBe(0.002);
    expect(() => validateArrangement(project(track('Song', clip)))).not.toThrow();
  });
});

describe('sanitizeArrangement', () => {
  it('returns the same project when nothing needs repair', () => {
    const valid = project(track('Song', audioClip('a', 'A', 10)));
    expect(sanitizeArrangement(valid)).toBe(valid);
  });

  it('keeps fades, curves, automation and notes inside their clip', () => {
    const clip = {
      ...audioClip('a', 'A', 1),
      fadeIn: 2,
      fadeOut: -1,
      fadeInCurve: [
        { time: 0, value: 0 },
        { time: 1.5, value: 1 },
      ],
      automation: {
        volume: [
          { time: 0.5, value: 90 },
          { time: 3, value: 50 },
        ],
        pan: [],
        filter: [],
      },
    };
    const kept = track('Keep', audioClip('b', 'B', 4));
    const repaired = sanitizeArrangement(project(track('Song', clip), kept));
    const fixed = repaired.tracks[0].clips[0];
    expect(fixed).toMatchObject({ fadeIn: 1, fadeOut: 0 });
    expect(fixed.fadeInCurve[1]).toEqual({ time: 1, value: 1 });
    expect(fixed.automation.volume).toEqual([{ time: 0.5, value: 90 }]);
    expect(repaired.tracks[1]).toBe(kept);
    expect(() => validateArrangement(repaired)).not.toThrow();
  });

  it("drops a capture's sub-millisecond final chunk", () => {
    const chunk = { ...audioClip('tail', 'Tail', 44 / 44100), fadeIn: 0, fadeOut: 0 };
    const repaired = sanitizeArrangement(project(track('Deck A', audioClip('a', 'A', 5), chunk)));
    expect(repaired.tracks[0].clips.map((clip) => clip.name)).toEqual(['A']);
  });
});

describe('repairArrangement', () => {
  it('returns a valid arrangement unchanged', () => {
    const valid = project(track('Song', audioClip('a', 'A', 10)));
    expect(repairArrangement(valid)).toBe(valid);
  });

  it('sets aside only the damaged clip, with its track name, and keeps the rest', () => {
    const good = audioClip('a', 'Verse', 10),
      bad = { ...audioClip('b', 'Chorus', 10), gain: Number.NaN };
    const repaired = repairArrangement(project(track('Vocals', good, bad)));
    expect(repaired.tracks[0].clips).toEqual([good]);
    expect(repaired.setAside).toEqual([
      { kind: 'clip', name: 'Chorus', track: 'Vocals', part: bad },
    ]);
    expect(() => validateArrangement(repaired)).not.toThrow();
  });

  it('sets aside damaged tracks, duplicate ids, bad takes and missing saved parts', () => {
    const song = track('Song', audioClip('a', 'A', 10));
    const broken = { ...track('Broken'), pan: 7 };
    const duplicate = { ...track('Copy'), id: song.id };
    const missing = { name: 'Missing saved part', missingPart: 'track:gone' };
    const take = { assetId: 'take', events: [{ time: -1, type: 'x', args: [] }] };
    const repaired = repairArrangement({
      ...project(song, broken, duplicate, missing),
      captures: [take],
    });
    expect(repaired.tracks).toEqual([song]);
    expect(repaired.captures).toEqual([]);
    expect(repaired.setAside.map(({ kind, name }) => [kind, name])).toEqual([
      ['track', 'Broken'],
      ['track', 'Copy'],
      ['track', 'Missing saved part'],
      ['take', 'take'],
    ]);
  });

  it('keeps parts set aside earlier and adds new ones after them', () => {
    const earlier = [{ kind: 'clip', name: 'Old', part: {} }];
    const bad = { ...audioClip('b', 'New', 10), rate: 0 };
    const repaired = repairArrangement({ ...project(track('T', bad)), setAside: earlier });
    expect(repaired.setAside.map((item) => item.name)).toEqual(['Old', 'New']);
  });

  it('sets aside an arrangement it cannot read at all', () => {
    const repaired = repairArrangement({ version: 9, tracks: 'nope' });
    expect(repaired.tracks).toEqual([]);
    expect(repaired.setAside).toEqual([
      { kind: 'arrangement', name: 'Arrangement', part: { version: 9, tracks: 'nope' } },
    ]);
  });
});

describe('validation cache', () => {
  it('still rejects duplicate ids and missing patterns across already-checked tracks', () => {
    const song = track('Song', audioClip('a', 'A', 10));
    validateArrangement(project(song));
    expect(() => validateArrangement(project(song, song))).toThrow('invalid arrangement');
    const pattern = {
      ...audioClip('', 'Beat', 2),
      kind: 'midi',
      notes: [],
      patternId: 'p1',
    };
    const beats = { ...track('Beats', pattern), kind: 'midi' };
    validateArrangement({ ...project(beats), patterns: { p1: { notes: [] } } });
    expect(() => validateArrangement({ ...project(beats), patterns: {} })).toThrow(
      'invalid arrangement'
    );
  });

  it('re-checks take fields every time, and an event list that grew in place', () => {
    const take = { assetId: 'take', events: [{ time: 0, type: 'x', args: [] }] };
    const withTake = { ...emptyArrangement(), captures: [take] };
    validateArrangement(withTake);
    take.events.push({ time: -5, type: 'x', args: [] });
    expect(() => validateArrangement(withTake)).toThrow('invalid arrangement');
    take.events.pop();
    validateArrangement(withTake);
    take.duration = Infinity;
    expect(() => validateArrangement(withTake)).toThrow('invalid arrangement');
  });

  it('re-checks a track whose clip list grew in place, and track fields edited in place', () => {
    const song = track('Song', audioClip('a', 'A', 10));
    validateArrangement(project(song));
    song.clips.push({ ...audioClip('b', 'B', 10), gain: -1 });
    expect(() => validateArrangement(project(song))).toThrow('invalid arrangement');
    song.clips.pop();
    validateArrangement(project(song));
    song.pan = 5;
    expect(() => validateArrangement(project(song))).toThrow('invalid arrangement');
  });
});
