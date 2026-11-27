// Same-tab handoff between Stem Separator and Key & BPM.
//
// This is an in-memory transfer: the site is a single-page app, so a client-side
// navigation keeps this module's state. A full reload, a new tab or another
// device starts empty, and the destination simply shows its normal first screen.
// Nothing here claims or attempts durable sync.

export const HANDOFF_TARGETS = ['separator', 'keybpm'];
export const HANDOFF_SOURCE_KINDS = {
  original: 'Original song',
  stem: 'Separated stem',
  mix: 'Rendered mix',
};
export const HANDOFF_MAX_AGE_MS = 10 * 60 * 1000;

let pending = null;

const validKey = (value) => value === null || (typeof value === 'string' && value.length <= 24);
const validBpm = (value) => value === null || (Number.isFinite(value) && value > 0 && value <= 999);

/**
 * file: the actual File to continue with.
 * kind: 'original' | 'stem' | 'mix'
 * label: what the user sees, e.g. "Vocals stem of Song.wav"
 * detected / user: optional { key, bpm }. User values are the musician's own
 * choices and stay labelled as such at the destination; they are never
 * presented as a new detection.
 */
export function offerToolHandoff(
  { target, from, file, kind, label, detected = null, user = null },
  now = Date.now()
) {
  if (!HANDOFF_TARGETS.includes(target)) throw new Error('Unknown handoff target.');
  if (!(file instanceof Blob)) throw new Error('A handoff needs an audio file.');
  if (!HANDOFF_SOURCE_KINDS[kind]) throw new Error('Unknown handoff source.');
  const clean = (values) =>
    values && validKey(values.key ?? null) && validBpm(values.bpm ?? null)
      ? { key: values.key ?? null, bpm: values.bpm ?? null }
      : null;
  pending = {
    id: globalThis.crypto?.randomUUID?.() ?? String(now),
    target,
    from,
    file,
    kind,
    label: String(label || file.name || 'Audio').slice(0, 200),
    detected: clean(detected),
    user: clean(user),
    createdAt: now,
  };
  return pending;
}

/** Look without consuming (for "a transfer is waiting" UI). */
export function peekToolHandoff(target, now = Date.now()) {
  if (!pending) return null;
  if (now - pending.createdAt > HANDOFF_MAX_AGE_MS) {
    pending = null;
    return null;
  }
  return pending.target === target ? pending : null;
}

/** Consume the waiting handoff for this destination, once. */
export function takeToolHandoff(target, now = Date.now()) {
  const handoff = peekToolHandoff(target, now);
  if (handoff) pending = null;
  return handoff;
}

export function clearToolHandoff() {
  pending = null;
}
