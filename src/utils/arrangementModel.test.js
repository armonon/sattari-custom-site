import { describe, expect, it } from 'vitest';
import {
  audioClip,
  audioTrack,
  automationAt,
  arrangementSchedule,
  emptyArrangement,
  linearGain,
  migrateArrangement,
  rulerMarks,
  splitClip,
  validateArrangement,
} from './arrangementModel';
import { gainFromPercent } from './studioAudioEngine';

function fixture() {
  const project = emptyArrangement(),
    track = audioTrack('Song');
  track.clips.push(audioClip('asset', 'Song', 12, 4));
  project.tracks.push(track);
  return project;
}
describe('arrangement time and gain contracts', () => {
  it('holds automation endpoints and interpolates unsorted points', () => {
    const points = [
      { time: 5, value: 150 },
      { time: 1, value: 50 },
    ];
    expect(automationAt(points, 0)).toBe(50);
    expect(automationAt(points, 3)).toBe(100);
    expect(automationAt(points, 99)).toBe(150);
    expect(automationAt([], 9, 100)).toBe(100);
  });
  it('supports unity, doubling and tripling without clipping the gain control', () => {
    for (const gain of [linearGain, gainFromPercent]) {
      expect(gain(0)).toBe(0);
      expect(gain(100)).toBe(1);
      expect(gain(200)).toBe(2);
      expect(gain(300)).toBe(3);
    }
    expect(gainFromPercent(NaN)).toBe(1);
  });
  it('schedules future clips after seeking into an empty gap and omits exact ended clips', () => {
    const project = fixture();
    project.tracks[0].clips[0].offset = 2;
    expect(arrangementSchedule(project, 2)[0]).toMatchObject({ delay: 2, offset: 2, duration: 12 });
    expect(arrangementSchedule(project, 8)[0]).toMatchObject({ delay: 0, offset: 6, duration: 8 });
    expect(arrangementSchedule(project, 16)).toEqual([]);
  });
  it('honors source rate and simultaneous clips independently', () => {
    const project = fixture();
    project.tracks[0].clips[0].rate = 2;
    project.tracks[0].clips.push(audioClip('other', 'Layer', 10, 4));
    expect(arrangementSchedule(project, 6).map((item) => item.offset)).toEqual([4, 2]);
  });
  it('computes bars from real tempo and timeline scale', () => {
    expect(rulerMarks(10, 120, 40)[1]).toEqual({ time: 2, label: '2' });
    expect(rulerMarks(10, 60, 40)[1]).toEqual({ time: 4, label: '2' });
    const visible = rulerMarks(86400, 120, 400, { left: 40000, width: 1000 });
    expect(visible.length).toBeLessThan(5);
    expect(visible[0]).toEqual({ time: 100, label: '51' });
  });
  it('respects mute and solo across independent tracks', () => {
    const project = fixture(),
      second = audioTrack('Second');
    second.solo = true;
    second.clips.push(audioClip('b', 'B', 2));
    project.tracks.push(second);
    expect(arrangementSchedule(project).map((item) => item.track.name)).toEqual(['Second']);
    second.muted = true;
    expect(arrangementSchedule(project)).toEqual([]);
  });
});
describe('non-destructive editing and migration', () => {
  it('splits into two source-correct clips and divides automation at the exact boundary', () => {
    const clip = audioClip('asset', 'Song', 12, 4);
    clip.offset = 3;
    clip.rate = 2;
    clip.automation.volume = [
      { time: 0, value: 0 },
      { time: 12, value: 240 },
    ];
    const [left, right] = splitClip(clip, 10);
    expect(left.duration).toBe(6);
    expect(right).toMatchObject({ start: 10, offset: 15, duration: 6 });
    expect(right.id).not.toBe(left.id);
    expect(right.automation.volume[0]).toEqual({ time: 0, value: 120 });
    expect(clip.duration).toBe(12);
    expect(clip.automation.volume).toHaveLength(2);
  });
  it('preserves a fade when splitting inside it and on repeated splits', () => {
    const clip = audioClip('asset', 'Song', 12);
    clip.fadeIn = 8;
    const [left, right] = splitClip(clip, 4);
    expect(automationAt(left.fadeInCurve, 2)).toBeCloseTo(0.25);
    expect(automationAt(right.fadeInCurve, 0)).toBeCloseTo(0.5);
    expect(automationAt(right.fadeInCurve, 2)).toBeCloseTo(0.75);
    const again = splitClip(right, 6);
    expect(automationAt(again[1].fadeInCurve, 0)).toBeCloseTo(0.75);
    const project = emptyArrangement(),
      track = audioTrack();
    track.clips = [left, ...again];
    project.tracks.push(track);
    expect(() => validateArrangement(project)).not.toThrow();
  });
  it('splits MIDI note overlaps into independently editable segments', () => {
    const clip = {
      ...audioClip('', 'Pattern', 4),
      kind: 'midi',
      notes: [{ pitch: 'C4', time: 1, duration: 2, velocity: 0.7 }],
    };
    const [left, right] = splitClip(clip, 2);
    expect(left.notes[0]).toMatchObject({ time: 1, duration: 1 });
    expect(right.notes[0]).toMatchObject({ time: 0, duration: 1 });
  });
  it('migrates old deck edits and velocity-127 piano notes without modifying the old project', () => {
    const old = {
      decks: [
        {
          id: 'A',
          title: 'Old',
          duration: 20,
          arrangement: { start: 4, trimStart: 2, trimEnd: 10 },
          lanes: { fullMix: { assetId: 'legacy' } },
        },
      ],
      pianoNotes: [{ pitch: 'C4', step: 4, velocity: 96 }],
      masterBpm: 120,
    };
    const migrated = migrateArrangement(old);
    expect(migrated.tracks).toHaveLength(2);
    expect(migrated.tracks[0].clips[0]).toMatchObject({
      start: 4,
      offset: 2,
      duration: 8,
      assetId: 'legacy',
    });
    expect(migrated.tracks[1].clips[0].notes[0].velocity).toBeCloseTo(96 / 127);
    expect(old.arranger).toBeUndefined();
    expect(() => validateArrangement(migrated)).not.toThrow();
  });
  it('round trips new projects without remigrating or duplicating clips', () => {
    const project = fixture();
    expect(migrateArrangement({ arranger: project, decks: [] })).toBe(project);
    expect(validateArrangement(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });
  it.each([
    'negative-duration',
    'duplicate-id',
    'bad-note',
    'unknown-version',
    'invalid-automation',
  ])('rejects malformed data: %s', (kind) => {
    const project = fixture(),
      clip = project.tracks[0].clips[0];
    if (kind === 'negative-duration') clip.duration = -1;
    if (kind === 'duplicate-id') project.tracks.push(project.tracks[0]);
    if (kind === 'bad-note') {
      clip.kind = 'midi';
      clip.notes = [{ pitch: 'invalid', time: 0, duration: 1, velocity: 0.5 }];
    }
    if (kind === 'unknown-version') project.version = 99;
    if (kind === 'invalid-automation') clip.automation.volume = [{ time: Infinity, value: 100 }];
    expect(() => validateArrangement(project)).toThrow('invalid arrangement');
  });
});
