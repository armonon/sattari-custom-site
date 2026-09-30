import { phrasesFor } from './music';
import { profileNotes, validProfile } from './guitarProfile';
import { lessonFingerprint } from './progress';

export function buildPracticePlan(lesson, selection = {}, profile) {
  const phrases = phrasesFor(lesson);
  const first = Math.max(0, Math.min(phrases.length - 1, Number(selection.first) || 0));
  const last = Math.max(
    first,
    Math.min(
      phrases.length - 1,
      Number.isInteger(selection.last) ? selection.last : phrases.length - 1
    )
  );
  const level = selection.level === 'essentials' ? 'essentials' : 'full';
  const part = selection.part === 'chords' ? 'chords' : 'melody';
  const start = phrases[first].start,
    end = phrases[last].end;
  const chosen = phrases.slice(first, last + 1);
  const notes = [],
    phraseStarts = [];
  for (const phrase of chosen) {
    phraseStarts.push(notes.length);
    // Retain phrase endpoints and alternate notes. Never invent a new pitch or
    // pretend the reduced exercise is the original transcription.
    const reduced = phrase.notes.filter(
      (_, i) => level === 'full' || i % 2 === 0 || i === phrase.notes.length - 1
    );
    notes.push(...reduced.map((n) => ({ ...n, sourceIndex: n.sourceIndex ?? n.index })));
  }
  const p = validProfile(profile);
  return {
    ...lesson,
    id: `${lesson.id}:plan:${first}-${last}:${level}:${part}:${p.tuning}:${p.capo}:${p.handedness}`,
    rootId: lesson.rootId || lesson.id,
    rootFingerprint: lessonFingerprint(lesson),
    notes: profileNotes(notes, p),
    phraseStarts,
    chords: lesson.chords
      .filter((c) => c.end > start && c.start < end)
      .map((c) => ({ ...c, start: Math.max(start, c.start), end: Math.min(end, c.end) })),
    practiceStart: start,
    duration: end,
    guitarProfile: p,
    plan: {
      first,
      last,
      level,
      part,
      start,
      end,
      label:
        selection.label ||
        `${first === last ? `Phrase ${first + 1}` : `Phrases ${first + 1}–${last + 1}`} · ${level === 'full' ? 'Full arrangement' : 'Reduced-note exercise'}`,
    },
  };
}

export function adaptiveSuggestion(phrase, result, currentSpeed = 0.75) {
  if (!result || !result.total || result.reliable === false) return null;
  const review = result.review || [];
  const clean = result.onTime === result.total && !result.extras;
  if (clean)
    return {
      kind: 'build',
      speed: Math.min(1, currentSpeed + 0.25),
      notes: phrase.notes,
      message:
        currentSpeed < 1
          ? 'Those notes landed together. Try the complete phrase a little faster.'
          : 'You connected the phrase at full speed. Keep that feeling for the next one.',
    };
  if (!review.length)
    return {
      kind: 'repeat',
      speed: Math.max(0.5, currentSpeed - 0.25),
      notes: phrase.notes,
      message: 'Try the complete phrase more slowly, keeping one clear pluck per note.',
    };
  const at = Math.max(
    0,
    phrase.notes.findIndex((n) => n.index === review[0])
  );
  const begin = Math.max(0, at - 1);
  return {
    kind: 'isolate',
    speed: Math.max(0.5, currentSpeed - 0.25),
    notes: phrase.notes.slice(begin, Math.min(phrase.notes.length, at + 2)),
    message: 'Let’s slow down the transition around this note, then put it back into the phrase.',
  };
}

export const JOURNAL_KEY = 'loop-practice-history-v1';
export function readHistory() {
  try {
    const rows = JSON.parse(localStorage.getItem(JOURNAL_KEY));
    return Array.isArray(rows)
      ? rows.filter((r) => r && typeof r.lessonId === 'string' && Number.isFinite(r.at)).slice(-200)
      : [];
  } catch {
    return [];
  }
}
export function logPractice(lesson, entry) {
  const rows = [
    ...readHistory(),
    {
      ...entry,
      lessonId: lesson.rootId || lesson.id,
      fingerprint: lesson.rootFingerprint || lessonFingerprint(lesson),
      planId: lesson.id,
      at: Date.now(),
    },
  ].slice(-200);
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}
export function dailySession(records, history = readHistory()) {
  const usable = records.filter((r) => {
    if (!r.lesson.notes?.length) return false;
    if (r.lesson.source === 'demo') return true;
    try {
      return localStorage.getItem(`loop-reviewed:${r.lesson.id}`) === lessonFingerprint(r.lesson);
    } catch {
      return false;
    }
  });
  if (!usable.length) return null;
  const valid = history.filter((h) =>
    usable.some((r) => r.lesson.id === h.lessonId && lessonFingerprint(r.lesson) === h.fingerprint)
  );
  const weak = [...valid]
    .reverse()
    .find(
      (h) =>
        h.kind === 'rhythm' && h.result?.reliable !== false && h.result?.onTime < h.result?.total
    );
  const record = usable.find((r) => r.lesson.id === weak?.lessonId) || usable[0];
  const count = phrasesFor(record.lesson).length;
  const target = Math.min(count - 1, Math.max(0, weak?.phrase || 0));
  return {
    record,
    basedOnHistory: !!weak,
    steps: [
      {
        label: 'Warm up · about 1 minute',
        first: target,
        last: target,
        level: 'essentials',
        speed: 0.5,
      },
      {
        label: 'Work on a passage · about 3 minutes',
        first: target,
        last: target,
        level: 'full',
        speed: 0.75,
      },
      {
        label: 'Play something you know · about 1 minute',
        first: 0,
        last: 0,
        level: 'full',
        speed: 1,
      },
    ],
  };
}
