import { describe, expect, it } from 'vitest';
import {
  audioClip,
  audioTrack,
  automationAt,
  arrangementDuration,
  arrangementRange,
  arrangementSchedule,
  clipRows,
  clipWaveform,
  compRegion,
  cropEnvelope,
  emptyArrangement,
  linearGain,
  mapChanged,
  migrateArrangement,
  moveClips,
  repeatLinkedPattern,
  resizeClip,
  retimeMidi,
  rulerMarks,
  splitClip,
  trimClipStart,
  updatePatternClip,
  validateArrangement,
} from './arrangementModel';
import { gainFromPercent } from './studioAudioEngine';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

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

// Every clip shape the operations branch on: a trimmed audio clip whose trim
// window has no fade curve yet, automation, fades, and linked beat patterns.
function richProject() {
  const vocal = audioTrack('Vocal');
  vocal.effects = [];
  vocal.automation = {
    volume: [
      { time: 0, value: 100 },
      { time: 20, value: 150 },
    ],
  };
  const take = {
    ...audioClip('take', 'Take', 12, 2),
    fadeIn: 1,
    fadeOut: 2,
    waveform: Array.from({ length: 64 }, (_, i) => i % 100),
  };
  take.automation.volume = [
    { time: 0, value: 50 },
    { time: 12, value: 250 },
  ];
  vocal.clips = [resizeClip(take, 10), audioClip('pad', 'Pad', 4, 14)];
  const keys = { ...audioTrack('Keys'), kind: 'midi' };
  keys.clips = [
    {
      ...audioClip('', 'Riff', 2),
      kind: 'midi',
      timebase: 'beats',
      instrument: 'piano',
      notes: [
        { pitch: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
        { pitch: 'E4', time: 1, duration: 0.5, velocity: 0.6 },
      ],
    },
  ];
  const linked = repeatLinkedPattern(
    { ...emptyArrangement(), tracks: [vocal, keys] },
    keys.clips[0].id
  );
  linked.locators = [{ id: 'marker', name: 'Drop', time: 4 }];
  linked.captures = [{ assetId: 'safety', name: 'Take', duration: 4, events: [] }];
  return validateArrangement(linked);
}

describe('model operations are pure', () => {
  it('never mutates deep-frozen inputs, including a trimmed clip whose trim window lacks a fade curve', () => {
    const project = deepFreeze(richProject());
    const snapshot = JSON.stringify(project);
    const [vocal, keys] = project.tracks;
    const [trimmed, pad] = vocal.clips;
    const riff = keys.clips[0];
    expect(trimmed.trimSource.fadeInCurve).toBeUndefined();
    const results = [
      repeatLinkedPattern(project, riff.id),
      updatePatternClip(project, riff.id, { notes: [riff.notes[0]] }),
      updatePatternClip(project, riff.id, { instrument: 'synth' }),
      updatePatternClip(project, trimmed.id, { fadeIn: 0.5, fadeInCurve: undefined }),
      updatePatternClip(project, trimmed.id, {
        automation: { ...trimmed.automation, volume: [{ time: 1, value: 90 }] },
      }),
      updatePatternClip(project, riff.id, resizeClip(riff, 1)),
      cropEnvelope(trimmed.automation.volume, 1, 3),
      resizeClip(trimmed, 12),
      resizeClip(riff, 1),
      trimClipStart(trimmed, trimmed.start + 1),
      trimClipStart(trimClipStart(trimmed, trimmed.start + 1), trimmed.start),
      trimClipStart(riff, 0.5),
      clipRows(vocal.clips),
      moveClips(project, [trimmed.id, pad.id], 1, vocal.id, keys.id),
      clipWaveform(trimmed),
      retimeMidi(project, 120, 90),
      automationAt(trimmed.automation.volume, 2),
      splitClip(trimmed, trimmed.start + 3),
      splitClip(riff, 1),
      arrangementDuration(project),
      arrangementRange(project, 1, 8),
      arrangementSchedule(project, 3),
      compRegion(project, vocal.id, 3, 6),
      rulerMarks(40, 120, 40, { left: 0, width: 800 }),
      migrateArrangement({ arranger: project }),
      validateArrangement(project),
    ];
    expect(results.every((result) => result !== undefined)).toBe(true);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it('trims a previously trimmed start into a new window instead of editing the old one', () => {
    const clip = deepFreeze(resizeClip({ ...audioClip('a', 'Song', 10), fadeIn: 1 }, 8));
    const trimmed = trimClipStart(clip, 2);
    expect(clip.trimSource.fadeInCurve).toBeUndefined();
    expect(trimmed.trimSource).not.toBe(clip.trimSource);
    expect(trimmed.trimSource.fadeInCurve).toEqual([
      { time: 0, value: 0 },
      { time: 1, value: 1 },
    ]);
    expect(trimmed).toMatchObject({ start: 2, offset: 2, duration: 6 });
    expect(trimClipStart(trimmed, 0)).toMatchObject({ start: 0, offset: 0, duration: 8 });
  });

  it('shares every untouched track, clip and array with the input project', () => {
    const project = deepFreeze(richProject());
    const [vocal, keys] = project.tracks;
    const pad = vocal.clips[1];
    const edited = updatePatternClip(project, pad.id, { gain: 80 });
    expect(edited.tracks[1]).toBe(keys);
    expect(edited.tracks[0].clips[0]).toBe(vocal.clips[0]);
    expect(edited.tracks[0].clips[1]).toMatchObject({ gain: 80 });
    expect(updatePatternClip(project, 'missing', { gain: 80 })).toBe(project);
    const moved = moveClips(project, [pad.id], 1, vocal.id, vocal.id);
    expect(moved.tracks[1]).toBe(keys);
    expect(moved.tracks[0].clips[0]).toBe(vocal.clips[0]);
    const retimed = retimeMidi(project, 120, 60);
    expect(retimed.tracks[0]).toBe(vocal);
    expect(retimed.tracks[1]).not.toBe(keys);
    const repeated = repeatLinkedPattern(project, keys.clips[0].id);
    expect(repeated.tracks[0]).toBe(vocal);
    const items = [1, 2, 3];
    expect(mapChanged(items, (item) => item)).toBe(items);
    expect(mapChanged(items, (item) => (item === 2 ? 20 : item))).toEqual([1, 20, 3]);
  });
});
