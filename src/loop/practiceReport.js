import { readHistory } from './practicePlan';
export const FEEDBACK_KEY = 'loop-feedback-v1';
export function readFeedback() {
  try {
    const rows = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
    return Array.isArray(rows)
      ? rows
          .filter(
            (r) =>
              r &&
              typeof r.lessonId === 'string' &&
              typeof r.issue === 'string' &&
              Number.isFinite(r.at)
          )
          .slice(-100)
      : [];
  } catch {
    return [];
  }
}
export function saveFeedback(entry) {
  const rows = [
    ...readFeedback(),
    { ...entry, note: String(entry.note || '').slice(0, 600), at: Date.now() },
  ].slice(-100);
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}
export function practiceReport({
  history = readHistory(),
  feedback = readFeedback(),
  profile,
  device = '',
} = {}) {
  return {
    format: 'sattari-learn-practice-report',
    version: 1,
    createdAt: new Date().toISOString(),
    explanation:
      'Local practice observations. Scores describe detected notes, not independently verified playing accuracy. No audio, video or uploaded song files are included.',
    device,
    profile,
    attempts: history.map((row) => ({
      lessonId: row.lessonId,
      at: new Date(row.at).toISOString(),
      kind: row.kind,
      phrase: row.phrase,
      playedAtSpeed: row.result?.speed,
      confirmed: row.result?.reliable !== false && row.kind === 'rhythm',
      onTime: row.result?.onTime,
      correctPitch: row.result?.pitch,
      total: row.result?.total,
      extraAttacks: row.result?.extras,
    })),
    feedback,
  };
}
