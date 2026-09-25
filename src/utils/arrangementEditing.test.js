import { describe, expect, it } from 'vitest';
import {
  audioClip,
  audioTrack,
  emptyArrangement,
  splitClip,
  resizeClip,
  trimClipStart,
  clipWaveform,
  clipRows,
  retimeMidi,
  validateArrangement,
  automationAt,
  arrangementGridPixels,
  compRegion,
  updatePatternClip,
  moveClips,
} from './arrangementModel';
import { newEffect } from './arrangementEffects';

const projectWith = (clips) => ({ ...emptyArrangement(), tracks: [{ ...audioTrack(), clips }] });
describe('arrangement editing boundaries', () => {
  it('moves a selection across tracks with relative offsets and clamps as a group', () => {
    const a = { ...audioTrack('A'), clips: [audioClip('a', 'A', 1, 2)] };
    const b = { ...audioTrack('B'), clips: [audioClip('b', 'B', 1, 4)] };
    const c = audioTrack('C');
    const result = moveClips(
      { ...emptyArrangement(), tracks: [a, b, c] },
      [a.clips[0].id, b.clips[0].id],
      -3,
      a.id,
      b.id
    );
    expect(result.tracks.map((track) => track.clips.map((clip) => clip.start))).toEqual([
      [],
      [0],
      [2],
    ]);
    expect(a.clips[0].start).toBe(2);
  });
  it('retains hidden MIDI notes, note tails and envelopes when either trim is extended', () => {
    const original = {
      ...audioClip('', 'notes', 8),
      kind: 'midi',
      notes: [
        { pitch: 'C4', time: 1, duration: 6, velocity: 0.7 },
        { pitch: 'D4', time: 6, duration: 1, velocity: 0.5 },
      ],
    };
    original.automation.volume = [
      { time: 0, value: 100 },
      { time: 8, value: 200 },
    ];
    const short = resizeClip(original, 3);
    const edited = updatePatternClip(projectWith([short]), short.id, {
      notes: short.notes.map((note) => ({ ...note, velocity: 0.9 })),
    }).tracks[0].clips[0];
    const restored = resizeClip(edited, 8);
    expect(restored.notes).toEqual([
      expect.objectContaining({ pitch: 'C4', time: 1, duration: 6, velocity: 0.9 }),
      expect.objectContaining({ pitch: 'D4', time: 6, duration: 1, velocity: 0.5 }),
    ]);
    expect(automationAt(restored.automation.volume, 8)).toBe(200);
    const right = trimClipStart(restored, 4);
    const left = trimClipStart(right, 0);
    expect(left.notes).toEqual(restored.notes);
    expect(left.offset).toBe(0);
    expect(() => validateArrangement(projectWith([left]))).not.toThrow();
  });
  it('keeps different comp processing and stem routing on independent buses without doubling regions', () => {
    const a = {
      ...audioTrack('A'),
      gain: 170,
      effects: [newEffect('echo')],
      stemRole: 'vocals',
      clips: [audioClip('a', 'A', 10)],
    };
    const b = { ...audioTrack('B'), stemRole: 'drums', clips: [audioClip('b', 'B', 10)] };
    const next = compRegion(
      compRegion({ ...emptyArrangement(), tracks: [a, b] }, a.id, 0, 10),
      b.id,
      3,
      5
    );
    const comps = next.tracks.filter((track) => track.compLane);
    expect(comps).toHaveLength(2);
    const wet = comps.find((track) => track.stemRole === 'vocals');
    expect(wet.effects).toEqual(a.effects);
    expect(wet.gain).toBe(170);
    expect(wet.clips.map((clip) => [clip.start, clip.duration, clip.mixGain])).toEqual([
      [0, 3, 1],
      [5, 5, 1],
    ]);
    expect(comps.find((track) => track.stemRole === 'drums').clips[0].duration).toBe(2);
  });
  it('comps selected regions without erasing outside regions or source clips', () => {
    const source = audioTrack('Take A');
    source.gain = 150;
    source.pan = -0.2;
    source.clips = [audioClip('a', 'A', 10)];
    const second = audioTrack('Take B');
    second.clips = [audioClip('b', 'B', 10)];
    const original = { ...emptyArrangement(), tracks: [source, second] };
    const initial = compRegion(original, source.id, 0, 10);
    const next = compRegion(initial, second.id, 3, 5);
    const comp = next.tracks.find((track) => track.compLane);
    expect(
      comp.clips.map((clip) => [clip.assetId, clip.start, clip.duration, clip.offset])
    ).toEqual([
      ['a', 0, 3, 0],
      ['b', 3, 2, 3],
      ['a', 5, 5, 5],
    ]);
    expect(comp.clips[0].mixGain).toBe(1.5);
    expect(comp.clips[0].automation.pan[0].value).toBe(-0.2);
    expect(original.tracks[0].clips[0].duration).toBe(10);
    expect(next.tracks.find((track) => track.id === second.id).muted).toBe(true);
    expect(() => validateArrangement(next)).not.toThrow();
  });
  it('keeps low-zoom grid lines aligned to power-of-two musical subdivisions', () => {
    for (const zoom of [0.1, 1, 40, 160]) {
      const step = (60 / 127 / 4) * zoom;
      const pixels = arrangementGridPixels(127, 4, zoom);
      expect(pixels).toBeGreaterThanOrEqual(8);
      expect(Math.log2(pixels / step) % 1).toBeCloseTo(0);
    }
  });
  it('can shorten a split clip and preserves envelope values at the new boundary', () => {
    const clip = audioClip('a', 'song', 10);
    clip.fadeOut = 4;
    clip.automation.volume = [
      { time: 0, value: 0 },
      { time: 10, value: 200 },
    ];
    const right = splitClip(clip, 4)[1];
    const trimmed = resizeClip(right, 3);
    expect(() => validateArrangement(projectWith([trimmed]))).not.toThrow();
    expect(automationAt(trimmed.fadeOutCurve, 3)).toBeCloseTo(0.75);
    expect(automationAt(trimmed.automation.volume, 3)).toBeCloseTo(140);
    expect(trimmed.offset).toBe(4);
  });
  it('limits extension to the remaining source at the clip playback rate', () => {
    const clip = { ...audioClip('a', 'song', 10), offset: 4, rate: 2, duration: 2 };
    expect(resizeClip(clip, 20).duration).toBe(3);
  });
  it('trims start with source and automation offsets, keeping the clip ID', () => {
    const clip = { ...audioClip('a', 'song', 10, 8), rate: 1 };
    const trimmed = trimClipStart(clip, 10);
    expect(trimmed).toMatchObject({ id: clip.id, start: 10, duration: 8, offset: 2 });
    expect(() => validateArrangement(projectWith([trimmed]))).not.toThrow();
  });
  it('crops waveform peaks instead of repeating the whole source after splitting', () => {
    const clip = { ...audioClip('a', 'song', 10), waveform: [0, 25, 50, 75, 100] };
    const [left, right] = splitClip(clip, 5);
    expect(clipWaveform(left)[0]).toBe(0);
    expect(clipWaveform(left).at(-1)).toBe(50);
    expect(clipWaveform(right)[0]).toBe(50);
    expect(clipWaveform(right).at(-1)).toBe(100);
  });
  it('assigns distinct rows to overlaps and reuses rows after clips end', () => {
    const clips = [
      audioClip('a', 'a', 4),
      audioClip('a', 'b', 4, 1),
      audioClip('a', 'c', 1, 2),
      audioClip('a', 'd', 1, 5),
    ];
    const { rows, count } = clipRows(clips);
    expect(count).toBe(3);
    expect(new Set(clips.slice(0, 3).map((clip) => rows.get(clip.id))).size).toBe(3);
    expect(rows.get(clips[3].id)).toBe(0);
  });
  it('retimes beat-following MIDI including its automation but leaves audio absolute', () => {
    const midi = {
      ...audioClip('', 'notes', 2, 2),
      kind: 'midi',
      timebase: 'beats',
      notes: [{ pitch: 'C4', time: 1, duration: 0.5, velocity: 0.7 }],
    };
    const audio = audioClip('a', 'audio', 10, 2);
    const next = retimeMidi(projectWith([midi, audio]), 120, 60);
    expect(next.tracks[0].clips[0]).toMatchObject({
      start: 4,
      duration: 4,
      notes: [{ time: 2, duration: 1 }],
    });
    expect(next.tracks[0].clips[1]).toEqual(audio);
    expect(() => validateArrangement(next)).not.toThrow();
  });
});
