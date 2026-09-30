export const emptyPitchGate = () => ({ midi: null, since: 0, awarded: null });

// Require a stable, in-tune pitch. One sustained note cannot collect multiple
// targets: repeated pitches must be separated by silence or a different note.
export function gradePitch(gate, pitch, targetMidi, now) {
  if (!pitch) return { gate: emptyPitchGate(), hit: false };
  let next =
    gate.midi === pitch.midi ? { ...gate } : { midi: pitch.midi, since: now, awarded: null };
  if (pitch.onsetId != null && pitch.onsetId !== next.onsetId) {
    next.onsetId = pitch.onsetId;
    next.since = now;
    next.awarded = null;
  }
  if (pitch.midi !== targetMidi || Math.abs(pitch.cents) > 35) {
    next.since = now;
    return { gate: next, hit: false };
  }
  if (next.awarded === pitch.midi || now - next.since < 180) return { gate: next, hit: false };
  next.awarded = pitch.midi;
  return { gate: next, hit: true };
}
