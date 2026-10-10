// Repairs common defects in Whisper's word-level timestamps before they are
// used for alignment: out-of-order chunks, zero/negative-length words, and
// words that overlap the one before them. ASR word timestamps are a known
// soft spot for Whisper (and most ASR models) -- the text is usually solid,
// the per-word timing occasionally is not.

// Strips leading/trailing punctuation (anything that isn't a letter, digit or
// apostrophe) for matching purposes. The caller keeps the original `text` for
// display, so "Hey!" still renders with its exclamation mark.
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;

export function matchKeyOf(text) {
  return String(text ?? '')
    .trim()
    .replace(EDGE_PUNCTUATION, '')
    .toLowerCase();
}

/**
 * @param {{ text: string, start: number, end: number }[]} rawChunks
 * @returns {{ text: string, start: number, end: number, matchKey: string }[]}
 */
export function normalizeAsrWords(rawChunks) {
  // Drop anything without real text, or with a non-finite or already
  // inverted/zero-length span -- there is nothing sane to repair there.
  const cleaned = (rawChunks || [])
    .map((chunk) => ({
      text: String(chunk?.text ?? '').trim(),
      start: Number(chunk?.start),
      end: Number(chunk?.end),
    }))
    .filter(
      (word) =>
        word.text.length > 0 &&
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.end > word.start
    );

  // Whisper chunks should already arrive in time order, but defend against
  // any decoder quirk that reorders them.
  cleaned.sort((a, b) => a.start - b.start || a.end - b.end);

  const out = [];
  let previousEnd = 0;
  for (const word of cleaned) {
    // Nudge the start forward just enough to clear the previous word's end.
    const start = Math.max(word.start, previousEnd);
    const end = word.end;
    // If the nudge swallowed the whole word (it was entirely inside the
    // previous word's span), it is degenerate now -- drop it rather than
    // invent a timestamp for it.
    if (end <= start) continue;
    out.push({ text: word.text, start, end, matchKey: matchKeyOf(word.text) });
    previousEnd = end;
  }
  return out;
}
