// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { CLASSICS } from './catalog';
import { DEMO, phrasesFor } from './music';
import { scoreMeasures } from './score';
import { rhythmTargets, scoreRhythm } from './rhythm';
import { detectFundamental } from './pitch';
import { noiseThreshold, signalLevel, detectAttack } from './signal';
import { readCheckpoint, saveCheckpoint, clearCheckpoint } from './progress';
import { estimateChordFromChroma, transcribeMelody } from './analyze';

describe('musical lesson structure', () => {
  it('keeps the two Ode to Joy halves aligned to two-bar phrases', () => {
    const ode = CLASSICS[0];
    expect(phrasesFor(ode).map((part) => Math.round((part.start * ode.bpm) / 60))).toEqual([
      0, 8, 16, 24,
    ]);
    expect(phrasesFor(CLASSICS[1]).map((part) => part.notes.length)).toEqual([7, 7, 7, 7, 7, 7]);
  });
  it('engraves a dotted quarter from exact duration, not the shorter audio envelope', () => {
    const ode = CLASSICS[0];
    const bars = scoreMeasures(phrasesFor(ode)[1].notes, ode.bpm);
    const dot = bars.flatMap((bar) => bar.events).find((event) => event.index === 12);
    expect(dot.value).toBe('qd');
    expect(dot.beats).toBe(1.5);
    expect(bars.every((bar) => bar.events.reduce((sum, event) => sum + event.beats, 0) === 4)).toBe(
      true
    );
  });
  it('cancels accidentals, inserts rests and ties notes across the barline', () => {
    const bars = scoreMeasures(
      [
        { midi: 66, beatStart: 0, beatDuration: 1 },
        { midi: 65, beatStart: 1, beatDuration: 1 },
        { midi: 64, beatStart: 3, beatDuration: 3 },
      ],
      60
    );
    expect(bars[0].events.map((event) => event.accidental)).toEqual(['#', 'n', undefined, null]);
    expect(bars[0].events[2].rest).toBe(true);
    expect(bars[1].events[0]).toMatchObject({ value: 'h', tieFromPrevious: true, midi: 64 });
  });
  it.each(CLASSICS)('$title preserves all authored beats in the score', (lesson) => {
    const events = scoreMeasures(lesson.notes, lesson.bpm).flatMap((bar) => bar.events);
    expect(events.reduce((sum, event) => sum + event.beats, 0)).toBeCloseTo(
      (lesson.duration * lesson.bpm) / 60,
      8
    );
  });
});

describe('rhythm scoring', () => {
  const phrase = phrasesFor(CLASSICS[0])[0];
  const targets = rhythmTargets(phrase, 88, 0.75);
  const beat = 60 / 88 / 0.75;
  it('uses the same source timings at the selected speed', () => {
    expect(targets[1].at).toBeCloseTo(beat);
    expect(targets[0].hold).toBeCloseTo(beat);
  });
  it('separates a correct pitch from an on-time note', () => {
    const result = scoreRhythm(
      targets,
      [
        { at: targets[0].at, midi: 52 },
        { at: targets[1].at + 0.26, midi: targets[1].midi },
        { at: targets[2].at - 0.26, midi: targets[2].midi },
        { at: targets[3].at + 0.05, midi: targets[3].midi },
      ],
      beat
    );
    expect(result.notes.slice(0, 5).map((note) => note.status)).toEqual([
      'wrong',
      'late',
      'early',
      'on-time',
      'missed',
    ]);
    expect(result.pitch).toBe(3);
    expect(result.onTime).toBe(1);
  });
  it('does not award a sustained/repeated attack to multiple notes', () => {
    const result = scoreRhythm(
      targets,
      [
        { at: 0, midi: 64 },
        { at: 0.02, midi: 64 },
      ],
      beat
    );
    expect(result.onTime).toBe(1);
    expect(result.extras).toBe(1);
    expect(result.notes[1].status).toBe('missed');
  });
  it('does not mark upcoming notes as missed', () => {
    expect(
      scoreRhythm(targets, [], beat, -1).notes.every((note) => note.status === 'waiting')
    ).toBe(true);
  });
});

describe('input qualification', () => {
  const quietE = Float32Array.from(
    { length: 2048 },
    (_, i) => 0.01 * Math.sin((2 * Math.PI * 329.6276 * i) / 44100)
  );
  it('recognizes a quiet clean note above the calibrated room floor', () => {
    expect(detectFundamental(quietE, 44100, 70, 1320, noiseThreshold([0.0001, 0.0002]))?.midi).toBe(
      64
    );
    expect(signalLevel(quietE).db).toBeLessThan(-40);
  });
  it('does not let a single calibration transient set the noise floor', () => {
    expect(noiseThreshold([...Array(30).fill(0.001), 0.8])).toBeCloseTo(0.0028);
  });
  it('identifies a repluck without counting a sustained envelope twice', () => {
    const first = detectAttack({ rms: 0, at: -Infinity, id: 0 }, 0.05, 0.002, 1000);
    const sustained = detectAttack(first, 0.049, 0.002, 1100);
    const decay = detectAttack(sustained, 0.01, 0.002, 1300);
    const repluck = detectAttack(decay, 0.06, 0.002, 1400);
    expect(first.id).toBe(1);
    expect(sustained.id).toBe(1);
    expect(repluck.id).toBe(2);
  });
  it('rejects flat or single-tone chroma instead of inventing a major chord', () => {
    expect(estimateChordFromChroma(Array(12).fill(1 / 12))).toBeNull();
    expect(estimateChordFromChroma([1, ...Array(11).fill(0)])).toBeNull();
  });
  it('transcribes quiet clean material without amplifying the output waveform', () => {
    const audio = Float32Array.from(
      { length: 8000 },
      (_, i) => 0.01 * Math.sin((2 * Math.PI * 329.6276 * i) / 8000)
    );
    expect(transcribeMelody(audio, 8000).map((n) => n.midi)).toEqual([64]);
  });
});

describe('lesson checkpoints', () => {
  const memory = () => {
    const values = new Map();
    return {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
  };
  const checkpoint = {
    stage: 'play',
    phraseIndex: 1,
    position: 3,
    matched: [0, 1, 9],
    speed: 0.75,
    rhythm: {},
  };
  it('restores a midway checkpoint and invalidates it after a musical edit', () => {
    const storage = memory();
    expect(saveCheckpoint(DEMO, checkpoint, storage)).toBe(true);
    expect(readCheckpoint(DEMO, storage)).toMatchObject(checkpoint);
    expect(readCheckpoint({ ...DEMO, bpm: 99 }, storage)).toBeNull();
    clearCheckpoint(DEMO, storage);
    expect(readCheckpoint(DEMO, storage)).toBeNull();
  });
  it('keeps session progress when device storage is unavailable', () => {
    const storage = {
      getItem() {
        throw Error('blocked');
      },
      setItem() {
        throw Error('quota');
      },
      removeItem() {
        throw Error('blocked');
      },
    };
    const lesson = { ...DEMO, id: 'quota-test' };
    expect(saveCheckpoint(lesson, checkpoint, storage)).toBe(false);
    expect(readCheckpoint(lesson, storage)).toMatchObject(checkpoint);
    clearCheckpoint(lesson, storage);
    expect(readCheckpoint(lesson, storage)).toBeNull();
  });
  it('ignores corrupt storage and deduplicates invalid match indexes', () => {
    expect(readCheckpoint(DEMO, { getItem: () => '{oops' })).toBeNull();
    const storage = memory();
    saveCheckpoint(DEMO, { ...checkpoint, matched: [0, 0, -1, 200, '4'] }, storage);
    expect(readCheckpoint(DEMO, storage).matched).toEqual([0]);
  });
});
