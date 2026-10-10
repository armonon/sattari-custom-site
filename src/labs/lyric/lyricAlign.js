// Core forced-alignment logic: match the lyrics a visitor pastes in against
// the words Whisper actually heard, then fill in timings for anything
// Whisper missed. Everything here is a pure function of its inputs so it can
// be unit tested without audio, a worker, or a model.
import { matchKeyOf } from './normalizeWords';

const EPSILON = 1e-6;
const MIN_WORD_DURATION = 0.02;

/**
 * Splits pasted lyrics into line-structured word tokens. Blank lines are
 * skipped entirely (they do not become an empty line in the output).
 * @returns {{ lineIndex: number, wordIndex: number, text: string, matchKey: string }[]}
 */
export function tokenizeLyrics(lyricText) {
  const rawLines = String(lyricText || '').split(/\r\n|\r|\n/);
  const tokens = [];
  let lineIndex = -1;
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    lineIndex += 1;
    const words = line.split(/\s+/).filter(Boolean);
    words.forEach((text, wordIndex) => {
      tokens.push({ lineIndex, wordIndex, text, matchKey: matchKeyOf(text) });
    });
  }
  return tokens;
}

/**
 * Longest-common-subsequence style DP over matchKey equality: the classic way
 * to find the best *monotonic* (order-preserving) correspondence between two
 * token sequences. Returns, for every lyric token index, the index of the
 * ASR word it aligns to, or -1 if nothing aligns to it (because the ASR
 * missed it, or it only exists in the ASR output as an unrelated filler).
 */
function matchLyricsToAsrIndices(lyricTokens, asrWords) {
  const n = lyricTokens.length;
  const m = asrWords.length;
  // dp[i][j] = length of the best match between lyricTokens[i..n) and asrWords[j..m)
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const isMatch = lyricTokens[i].matchKey && lyricTokens[i].matchKey === asrWords[j].matchKey;
      dp[i][j] = isMatch ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const asrIndexForLyric = new Array(n).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const isMatch = lyricTokens[i].matchKey && lyricTokens[i].matchKey === asrWords[j].matchKey;
    if (isMatch && dp[i][j] === dp[i + 1][j + 1] + 1) {
      asrIndexForLyric[i] = j;
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      // Advancing the lyric pointer scores at least as well: this lyric word
      // is unmatched (ASR missed it, or garbled it beyond recognition).
      i += 1;
    } else {
      // Advancing the ASR pointer scores better: this ASR word is extra
      // (a hallucinated filler, a repeated ad-lib the lyrics don't have, etc)
      // and is simply skipped -- it never appears in the aligned output and
      // does not shift anything that comes after it.
      j += 1;
    }
  }
  return asrIndexForLyric;
}

function clampMonotonic(words) {
  for (let i = 1; i < words.length; i++) {
    if (words[i].start < words[i - 1].end) words[i].start = words[i - 1].end;
    if (words[i].end < words[i].start) words[i].end = words[i].start;
  }
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].end > words[i + 1].start + EPSILON) words[i].end = words[i + 1].start;
  }
}

/** Evenly divides [spanStart, spanEnd) across words[from, to) by character length. */
function distributeGap(words, from, to, spanStart, spanEnd) {
  const span = Math.max(0, spanEnd - spanStart);
  const lengths = [];
  let totalLength = 0;
  for (let k = from; k < to; k++) {
    const length = Math.max(1, words[k].text.length);
    lengths.push(length);
    totalLength += length;
  }
  let cursor = spanStart;
  for (let k = from; k < to; k++) {
    const share = totalLength > 0 ? (lengths[k - from] / totalLength) * span : 0;
    const isLast = k === to - 1;
    const start = cursor;
    const end = isLast ? spanEnd : start + share;
    words[k].start = start;
    words[k].end = Math.max(start, end);
    cursor = words[k].end;
  }
}

/** Fills in start/end for every unmatched run of words, anchored to its matched neighbours. */
function interpolateGaps(words, audioDuration) {
  const n = words.length;
  const fallbackWordSeconds = 0.3;
  let i = 0;
  while (i < n) {
    if (words[i].matched) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < n && !words[j].matched) j += 1;

    const precedingEnd = i > 0 ? words[i - 1].end : 0;
    let followingStart;
    if (j < n) {
      followingStart = words[j].start;
    } else if (Number.isFinite(audioDuration)) {
      followingStart = audioDuration;
    } else {
      // No following matched word and no known audio duration: give each
      // trailing word a modest placeholder span rather than collapsing them
      // all onto the same instant.
      followingStart = precedingEnd + fallbackWordSeconds * (j - i);
    }
    distributeGap(words, i, j, precedingEnd, Math.max(precedingEnd, followingStart));
    i = j;
  }
}

/**
 * Aligns tokenized lyrics to normalized ASR words. Lyric words that match an
 * ASR word use its timing (`matched: true`); words ASR missed (or extra
 * lyric words, e.g. a repeated chorus marker) get an interpolated span
 * between their nearest matched neighbours (`matched: false`).
 * @param {ReturnType<typeof tokenizeLyrics>} lyricTokens
 * @param {{ text: string, start: number, end: number, matchKey: string }[]} asrWords
 * @param {number} [audioDuration] used to anchor trailing unmatched words when there is no later matched word
 */
export function alignLyricsToAsr(lyricTokens, asrWords, audioDuration = null) {
  const asrIndexForLyric = matchLyricsToAsrIndices(lyricTokens, asrWords);

  const result = lyricTokens.map((token, i) => {
    const asrIndex = asrIndexForLyric[i];
    if (asrIndex >= 0) {
      return {
        lineIndex: token.lineIndex,
        wordIndex: token.wordIndex,
        text: token.text,
        start: asrWords[asrIndex].start,
        end: asrWords[asrIndex].end,
        matched: true,
      };
    }
    return {
      lineIndex: token.lineIndex,
      wordIndex: token.wordIndex,
      text: token.text,
      start: null,
      end: null,
      matched: false,
    };
  });

  interpolateGaps(result, audioDuration);
  clampMonotonic(result);
  return result;
}

/**
 * Groups flat aligned words back into lines using their `lineIndex`, each
 * line spanning the start of its first word to the end of its last.
 * @returns {{ id: string, start: number, end: number, words: { id: string, text: string, start: number, end: number, matched: boolean }[] }[]}
 */
export function buildLyricLines(alignedWords) {
  const byLine = new Map();
  for (const word of alignedWords) {
    if (!byLine.has(word.lineIndex)) byLine.set(word.lineIndex, []);
    byLine.get(word.lineIndex).push(word);
  }
  const lineIndexes = Array.from(byLine.keys()).sort((a, b) => a - b);
  return lineIndexes.map((lineIndex) => {
    const sortedWords = byLine
      .get(lineIndex)
      .slice()
      .sort((a, b) => a.wordIndex - b.wordIndex);
    const words = sortedWords.map((word) => ({
      id: `${lineIndex}-${word.wordIndex}`,
      text: word.text,
      start: word.start,
      end: word.end,
      matched: word.matched,
    }));
    return {
      id: `line-${lineIndex}`,
      start: words[0].start,
      end: words[words.length - 1].end,
      words,
    };
  });
}

function flattenLines(lines) {
  const flat = [];
  lines.forEach((line, lineArrayIndex) => {
    line.words.forEach((word, wordArrayIndex) => {
      flat.push({ lineArrayIndex, wordArrayIndex, word });
    });
  });
  return flat;
}

/**
 * Shifts one word's start time by `deltaSeconds` (used by drag handles and
 * the +/-10ms / +/-100ms nudge buttons). Pure: returns a new lines array.
 * Clamps so the word's start never passes its own end, and cascades a
 * *minimal* pull-back onto the immediately preceding word's end if the nudge
 * would otherwise overlap it -- no global re-flow of the rest of the song.
 */
export function nudgeWord(lines, lineId, wordId, deltaSeconds) {
  const flat = flattenLines(lines);
  const pos = flat.findIndex(
    (entry) => entry.word.id === wordId && lines[entry.lineArrayIndex].id === lineId
  );
  if (pos < 0) return lines;

  const current = flat[pos].word;
  const prevEntry = pos > 0 ? flat[pos - 1] : null;

  let newStart = current.start + deltaSeconds;
  newStart = Math.min(newStart, current.end - MIN_WORD_DURATION);
  newStart = Math.max(newStart, 0);

  let newPrevEnd = prevEntry ? prevEntry.word.end : null;
  if (prevEntry && newStart < prevEntry.word.end) {
    // Pull the previous word's end back just enough to clear the new start,
    // but never past that word's own start.
    newPrevEnd = Math.max(prevEntry.word.start + MIN_WORD_DURATION, newStart);
    newStart = Math.max(newStart, newPrevEnd);
  }

  const target = flat[pos];
  return lines.map((line, lineArrayIndex) => {
    const words = line.words.map((word, wordArrayIndex) => {
      if (target.lineArrayIndex === lineArrayIndex && target.wordArrayIndex === wordArrayIndex) {
        return { ...word, start: newStart };
      }
      if (
        prevEntry &&
        prevEntry.lineArrayIndex === lineArrayIndex &&
        prevEntry.wordArrayIndex === wordArrayIndex &&
        newPrevEnd !== prevEntry.word.end
      ) {
        return { ...word, end: newPrevEnd };
      }
      return word;
    });
    return { ...line, words, start: words[0].start, end: words[words.length - 1].end };
  });
}
