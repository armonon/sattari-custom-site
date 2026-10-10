import { describe, expect, it } from 'vitest';
import { alignLyricsToAsr, buildLyricLines, nudgeWord, tokenizeLyrics } from './lyricAlign';
import { normalizeAsrWords } from './normalizeWords';

function asrWords(entries) {
  return normalizeAsrWords(entries.map(([text, start, end]) => ({ text, start, end })));
}

function expectMonotonic(words) {
  for (let i = 1; i < words.length; i++) {
    expect(words[i].start).toBeGreaterThanOrEqual(words[i - 1].start);
    expect(words[i].end).toBeGreaterThanOrEqual(words[i].start);
  }
  for (let i = 0; i < words.length - 1; i++) {
    expect(words[i].end).toBeLessThanOrEqual(words[i + 1].start + 1e-6);
  }
}

describe('tokenizeLyrics', () => {
  it('splits lines and words, skipping blank lines entirely', () => {
    const tokens = tokenizeLyrics('hello world\n\nsecond line  here\n');
    expect(tokens.map((t) => [t.lineIndex, t.wordIndex, t.text])).toEqual([
      [0, 0, 'hello'],
      [0, 1, 'world'],
      [1, 0, 'second'],
      [1, 1, 'line'],
      [1, 2, 'here'],
    ]);
  });
});

describe('alignLyricsToAsr', () => {
  it('1. perfect match: every word is matched with exact ASR times', () => {
    const lyricTokens = tokenizeLyrics('hello there world');
    const asr = asrWords([
      ['hello', 0.0, 0.3],
      ['there', 0.3, 0.6],
      ['world', 0.6, 1.0],
    ]);
    const aligned = alignLyricsToAsr(lyricTokens, asr);
    expect(aligned).toHaveLength(3);
    aligned.forEach((word, i) => {
      expect(word.matched).toBe(true);
      expect(word.start).toBeCloseTo(asr[i].start, 6);
      expect(word.end).toBeCloseTo(asr[i].end, 6);
    });
  });

  it('2. one missing word is interpolated strictly within its matched neighbours', () => {
    // "quiet" is mumbled and never recognized by ASR.
    const lyricTokens = tokenizeLyrics('hello quiet world');
    const asr = asrWords([
      ['hello', 0.0, 0.3],
      ['world', 1.0, 1.3],
    ]);
    const aligned = alignLyricsToAsr(lyricTokens, asr);
    expect(aligned.map((w) => w.text)).toEqual(['hello', 'quiet', 'world']);
    const [hello, quiet, world] = aligned;
    expect(hello.matched).toBe(true);
    expect(world.matched).toBe(true);
    expect(quiet.matched).toBe(false);
    expect(quiet.start).toBeGreaterThanOrEqual(hello.end);
    expect(quiet.end).toBeLessThanOrEqual(world.start);
    expect(quiet.start).toBeLessThan(quiet.end);
    expectMonotonic(aligned);
  });

  it('3. an extra ASR filler word is excluded and does not shift later words', () => {
    // ASR hallucinated "uh" which never appears in the pasted lyrics.
    const lyricTokens = tokenizeLyrics('hello world');
    const asr = asrWords([
      ['hello', 0.0, 0.3],
      ['uh', 0.3, 0.5],
      ['world', 0.8, 1.2],
    ]);
    const aligned = alignLyricsToAsr(lyricTokens, asr);
    expect(aligned).toHaveLength(2);
    expect(aligned.map((w) => w.text)).toEqual(['hello', 'world']);
    expect(aligned[0].matched).toBe(true);
    expect(aligned[0].start).toBeCloseTo(0.0, 6);
    expect(aligned[0].end).toBeCloseTo(0.3, 6);
    expect(aligned[1].matched).toBe(true);
    // "world" keeps its own ASR timing untouched by the skipped filler word.
    expect(aligned[1].start).toBeCloseTo(0.8, 6);
    expect(aligned[1].end).toBeCloseTo(1.2, 6);
  });

  it('5. normalizeAsrWords repairs out-of-order, zero-length and overlapping timestamps', () => {
    const raw = [
      { text: 'world', start: 1.0, end: 1.4 },
      { text: 'hello', start: 0.0, end: 0.5 },
      { text: 'zero', start: 0.5, end: 0.5 },
      { text: 'overlap', start: 0.3, end: 0.9 },
    ];
    const cleaned = normalizeAsrWords(raw);
    expect(cleaned.map((w) => w.text)).toEqual(['hello', 'overlap', 'world']);
    expectMonotonic(cleaned);
    expect(cleaned[0].start).toBe(0);
    expect(cleaned[0].end).toBe(0.5);
    // "overlap" started before hello ended, so it gets nudged forward.
    expect(cleaned[1].start).toBeCloseTo(0.5, 6);
    expect(cleaned[2].start).toBeCloseTo(1.0, 6);
  });
});

describe('buildLyricLines', () => {
  it('4. groups multi-line lyrics in order with correct word membership and line bounds', () => {
    const lyricTokens = tokenizeLyrics('one two\nthree four five\nsix');
    const asr = asrWords([
      ['one', 0.0, 0.2],
      ['two', 0.2, 0.4],
      ['three', 0.4, 0.6],
      ['four', 0.6, 0.8],
      ['five', 0.8, 1.0],
      ['six', 1.0, 1.2],
    ]);
    const aligned = alignLyricsToAsr(lyricTokens, asr);
    const lines = buildLyricLines(aligned);

    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.words.map((w) => w.text))).toEqual([
      ['one', 'two'],
      ['three', 'four', 'five'],
      ['six'],
    ]);
    lines.forEach((line) => {
      expect(line.start).toBe(line.words[0].start);
      expect(line.end).toBe(line.words[line.words.length - 1].end);
    });
    expect(lines[0].start).toBeCloseTo(0.0, 6);
    expect(lines[0].end).toBeCloseTo(0.4, 6);
    expect(lines[1].start).toBeCloseTo(0.4, 6);
    expect(lines[1].end).toBeCloseTo(1.0, 6);
    expect(lines[2].start).toBeCloseTo(1.0, 6);
    expect(lines[2].end).toBeCloseTo(1.2, 6);
  });
});

describe('nudgeWord', () => {
  function sampleLines() {
    return buildLyricLines(
      alignLyricsToAsr(
        tokenizeLyrics('hello world again'),
        asrWords([
          ['hello', 0.0, 0.3],
          ['world', 0.3, 0.6],
          ['again', 0.6, 0.9],
        ])
      )
    );
  }

  it('shifts a word start within its available slack', () => {
    const lines = sampleLines();
    const next = nudgeWord(lines, 'line-0', '0-1', 0.05);
    const word = next[0].words[1];
    expect(word.start).toBeCloseTo(0.35, 6);
    // Untouched neighbours stay put.
    expect(next[0].words[0].end).toBeCloseTo(0.3, 6);
  });

  it('cascades a minimal pull-back onto the previous word when nudging earlier would overlap it', () => {
    const lines = sampleLines();
    // Push "world" start far earlier than "hello" ends.
    const next = nudgeWord(lines, 'line-0', '0-1', -0.2);
    const hello = next[0].words[0];
    const world = next[0].words[1];
    expect(world.start).toBeLessThanOrEqual(hello.end + 1e-9);
    expect(hello.end).toBeGreaterThanOrEqual(hello.start);
    expect(world.start).toBeGreaterThanOrEqual(0);
  });

  it('clamps a word start so it never reaches or passes its own end', () => {
    const lines = sampleLines();
    const next = nudgeWord(lines, 'line-0', '0-2', 10);
    const again = next[0].words[2];
    expect(again.start).toBeLessThan(again.end);
  });
});
