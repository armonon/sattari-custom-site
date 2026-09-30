const PREFIX = 'loop-checkpoint-v2:';
const volatile = new Map();
export function lessonFingerprint(lesson) {
  return JSON.stringify([
    lesson.bpm,
    lesson.key,
    lesson.duration,
    lesson.practiceStart,
    lesson.guitarProfile,
    lesson.phraseStarts,
    lesson.chords?.map((c) => [c.name, c.start, c.end]),
    lesson.notes.map((n) => [n.midi, n.start, n.end, n.string, n.fret, n.beatDuration]),
    lesson.polyphonicNotes?.map((n) => [n.midi, n.start, n.end]),
  ]);
}

export function readCheckpoint(lesson, storage) {
  try {
    const value = volatile.has(lesson.id)
      ? volatile.get(lesson.id)
      : JSON.parse((storage || globalThis.localStorage).getItem(PREFIX + lesson.id));
    if (
      !value ||
      value.fingerprint !== lessonFingerprint(lesson) ||
      !Number.isInteger(value.phraseIndex) ||
      value.phraseIndex < 0 ||
      !Number.isInteger(value.position) ||
      value.position < 0 ||
      !['listen', 'play', 'phraseDone', 'rhythm', 'complete'].includes(value.stage)
    )
      return null;
    return {
      ...value,
      matched: Array.isArray(value.matched)
        ? [
            ...new Set(
              value.matched.filter((n) => Number.isInteger(n) && n >= 0 && n < lesson.notes.length)
            ),
          ]
        : [],
      rhythm: Object.fromEntries(
        Object.entries(value.rhythm || {}).filter(
          ([key, item]) =>
            /^\d+$/.test(key) &&
            item &&
            [item.onTime, item.pitch, item.total, item.extras].every(Number.isFinite) &&
            item.onTime >= 0 &&
            item.pitch >= item.onTime &&
            item.total >= item.pitch &&
            item.total <= lesson.notes.length &&
            item.extras >= 0 &&
            [0.5, 0.75, 1].includes(item.speed)
        )
      ),
      speed: [0.5, 0.75, 1].includes(value.speed) ? value.speed : 0.75,
    };
  } catch {
    return null;
  }
}

export function saveCheckpoint(lesson, value, storage) {
  const saved = { ...value, fingerprint: lessonFingerprint(lesson), updatedAt: Date.now() };
  try {
    storage ||= globalThis.localStorage;
    storage.setItem(PREFIX + lesson.id, JSON.stringify(saved));
    volatile.delete(lesson.id);
    return true;
  } catch {
    volatile.set(lesson.id, saved);
    return false;
  }
}

export function clearCheckpoint(lesson, storage) {
  try {
    storage ||= globalThis.localStorage;
    storage.removeItem(PREFIX + lesson.id);
    volatile.delete(lesson.id);
  } catch {
    volatile.set(lesson.id, null);
  }
}
