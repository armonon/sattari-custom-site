import { describe, expect, it } from 'vitest';
import {
  bounceOffset,
  findActiveLine,
  karaokeFillFraction,
  lineSweepProgress,
  typewriterVisibleChars,
  wordPopScale,
} from './lyricRender';

const word = { text: 'hello', start: 1, end: 1.5 };
const line = {
  start: 1,
  end: 2.5,
  words: [
    { text: 'hello', start: 1, end: 1.5 },
    { text: 'world', start: 1.5, end: 2.5 },
  ],
};

describe('wordPopScale', () => {
  it('is 1 (no pop) before the word starts', () => {
    expect(wordPopScale(word, 0.5)).toBe(1);
  });
  it('bumps above 1 shortly after the word starts', () => {
    expect(wordPopScale(word, 1.09)).toBeGreaterThan(1);
  });
  it('settles back to 1 once the pop duration has elapsed', () => {
    expect(wordPopScale(word, 1.3)).toBeCloseTo(1, 5);
  });
});

describe('karaokeFillFraction', () => {
  it('is 0 before the word starts', () => {
    expect(karaokeFillFraction(word, 0.9)).toBe(0);
  });
  it('is a partial fraction mid-word', () => {
    const fraction = karaokeFillFraction(word, 1.25);
    expect(fraction).toBeCloseTo(0.5, 5);
  });
  it('is 1 once the word has fully elapsed', () => {
    expect(karaokeFillFraction(word, 1.6)).toBe(1);
  });
});

describe('bounceOffset', () => {
  it('rests at the full offset before the word starts', () => {
    expect(bounceOffset(word, 0.5)).toBe(24);
  });
  it('is partway toward the resting position mid-bounce', () => {
    const offset = bounceOffset(word, 1.15);
    expect(offset).not.toBe(24);
    expect(offset).not.toBe(0);
  });
  it('settles to 0 once the bounce has finished', () => {
    expect(bounceOffset(word, 1.3)).toBeCloseTo(0, 5);
  });
});

describe('typewriterVisibleChars', () => {
  const text = line.words.map((w) => w.text).join(' ');
  it('reveals nothing before the line starts', () => {
    expect(typewriterVisibleChars(line, 0.5)).toBe(0);
  });
  it('reveals a partial prefix mid-line', () => {
    const visible = typewriterVisibleChars(line, 1.75);
    expect(visible).toBeGreaterThan(0);
    expect(visible).toBeLessThan(text.length);
  });
  it('reveals the full text once the line has finished', () => {
    expect(typewriterVisibleChars(line, 3)).toBe(text.length);
  });
});

describe('lineSweepProgress', () => {
  it('is 0 before the line starts', () => {
    expect(lineSweepProgress(line, 0.5)).toBe(0);
  });
  it('fades in after the line starts', () => {
    const progress = lineSweepProgress(line, 1.1);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThanOrEqual(1);
  });
  it('fades out after the line ends', () => {
    const progress = lineSweepProgress(line, 2.6);
    expect(progress).toBeLessThan(1);
    expect(progress).toBeGreaterThanOrEqual(0);
  });
});

describe('findActiveLine', () => {
  const lines = [
    { id: 'a', start: 0, end: 1 },
    { id: 'b', start: 1, end: 2 },
  ];
  it('returns the line whose start has been reached', () => {
    expect(findActiveLine(lines, 0.5).id).toBe('a');
    expect(findActiveLine(lines, 1.5).id).toBe('b');
  });
  it('returns null before any line has started', () => {
    expect(findActiveLine(lines, -1)).toBe(null);
  });
});
