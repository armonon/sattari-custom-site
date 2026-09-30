import { FOUNDATION_LESSONS } from './courseCatalog';
import { lessonFingerprint, readCheckpoint } from './progress';
import { useGuitarProfile } from './GuitarSetup';
import { profileNotes } from './guitarProfile';

export function courseEvidence(lesson, profile, progress = {}) {
  const adapted = {
    ...lesson,
    notes: profileNotes(lesson.notes, profile),
    guitarProfile:
      profile.tuning === 'standard' && !profile.capo && profile.handedness === 'right'
        ? undefined
        : profile,
  };
  const checkpoint = readCheckpoint(adapted),
    summary = progress[lesson.id];
  const matched =
    checkpoint?.matched?.length === lesson.notes.length ||
    (summary?.fingerprint === lessonFingerprint(adapted) &&
      summary.matched === lesson.notes.length);
  if (matched) return { label: 'Pitch milestone', verified: true };
  if (checkpoint?.stage === 'complete') return { label: 'Explored', verified: false };
  if (checkpoint) return { label: 'In progress', verified: false };
  return { label: 'Ready when you are', verified: false };
}
export default function CoursePath({ onChoose, progress }) {
  const { profile } = useGuitarProfile();
  const rows = FOUNDATION_LESSONS.map((lesson) => ({
    lesson,
    ...courseEvidence(lesson, profile, progress),
  }));
  const reached = rows.filter((row) => row.verified).length;
  const next =
    rows.find((row) => !row.verified && row.label !== 'Explored') ||
    rows.find((row) => !row.verified) ||
    rows.at(-1);
  return (
    <section className="lc-course" aria-label="Beginner guitar course">
      <div className="lc-course-heading">
        <div>
          <span className="lj-eyebrow">START HERE · 12 SMALL STEPS</span>
          <h2>Your first song starts with one note.</h2>
          <p>
            Build up from open strings to <em>First light</em>, a complete original song. Take any
            lesson at your own pace.
          </p>
        </div>
        <button
          type="button"
          className="loop-button loop-button-purple"
          onClick={() => onChoose(next.lesson)}
        >
          Start step {next.lesson.teaching.step}
        </button>
      </div>
      <div className="lc-course-progress">
        <progress value={reached} max={rows.length} aria-label="Course pitch milestones" />
        <span>
          {reached} of {rows.length} pitch milestones
        </span>
      </div>
      <details>
        <summary>Explore the beginner path</summary>
        <ol>
          {rows.map(({ lesson, label, verified }) => (
            <li key={lesson.id} className={verified ? 'is-reached' : ''}>
              <span className="lc-course-number">
                {String(lesson.teaching.step).padStart(2, '0')}
              </span>
              <div>
                <h3>{lesson.title}</h3>
                <p>{lesson.skill}</p>
                <small>
                  {lesson.teaching.minutes} min suggested · {label}
                </small>
              </div>
              <button
                type="button"
                className="lj-text-link"
                onClick={() => onChoose(lesson)}
                aria-label={`Open step ${lesson.teaching.step}: ${lesson.title}`}
              >
                Open →
              </button>
            </li>
          ))}
        </ol>
      </details>
      <small>
        Original exercises with synthesized examples. Exploring is always available; pitch
        milestones require microphone matches.
      </small>
    </section>
  );
}

export function LessonBrief({ lesson }) {
  if (!lesson.teaching) return null;
  return (
    <section className="lc-brief" aria-label="Before you play">
      <div>
        <span className="lj-eyebrow">
          LESSON {String(lesson.teaching.step).padStart(2, '0')} · BEFORE YOU PLAY
        </span>
        <h2>{lesson.skill}</h2>
        <p>{lesson.teaching.tip}</p>
      </div>
      <div>
        <h3>If it feels tricky</h3>
        <p>{lesson.teaching.mistake}</p>
        <small>
          Builds on: {lesson.teaching.prerequisite} · About {lesson.teaching.minutes} minutes
        </small>
      </div>
    </section>
  );
}
