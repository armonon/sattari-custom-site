import { useMemo, useState } from 'react';
import { phrasesFor, formatTime } from './music';
import { buildPracticePlan } from './practicePlan';
import { useGuitarProfile } from './GuitarSetup';
import { profileChord } from './guitarProfile';

export default function LessonPlanner({ lesson, ready, onStart }) {
  const phrases = useMemo(() => phrasesFor(lesson), [lesson]);
  const [first, setFirst] = useState(0),
    [last, setLast] = useState(phrases.length - 1);
  const [part, setPart] = useState(lesson.notes.length ? 'melody' : 'chords');
  const [level, setLevel] = useState('full');
  const { profile } = useGuitarProfile();
  const plan = buildPracticePlan(lesson, { first, last, part, level }, profile);
  const unavailable =
    part === 'melody'
      ? plan.notes.some((n) => n.unplayable) || !plan.notes.length
      : !plan.chords.some((c) => profileChord(c.name, profile));
  return (
    <section className="lc-planner lc-panel" aria-label="Build a song lesson">
      <div>
        <span className="lj-eyebrow">MAKE A PLAN</span>
        <h2>Teach me this part.</h2>
        <p>Pick a passage. Learn its shape, practice the tricky changes, then connect it.</p>
      </div>
      <div className="lc-fields">
        <label>
          From phrase
          <select
            value={first}
            onChange={(e) => {
              const value = Number(e.target.value);
              setFirst(value);
              setLast(Math.max(value, last));
            }}
          >
            {phrases.map((p, i) => (
              <option key={i} value={i}>
                {i + 1} · {formatTime(p.start)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Through phrase
          <select value={last} onChange={(e) => setLast(Number(e.target.value))}>
            {phrases.map(
              (p, i) =>
                i >= first && (
                  <option key={i} value={i}>
                    {i + 1} · {formatTime(p.end)}
                  </option>
                )
            )}
          </select>
        </label>
        <label>
          My part
          <select value={part} onChange={(e) => setPart(e.target.value)}>
            <option value="melody" disabled={!lesson.notes.length}>
              Melody / lead line
            </option>
            <option value="chords" disabled={!lesson.chords.length}>
              Chord shapes
            </option>
          </select>
        </label>
        {part === 'melody' && (
          <label>
            Arrangement
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="essentials">Essentials · fewer notes</option>
              <option value="full">Full arrangement</option>
            </select>
          </label>
        )}
      </div>
      <p>
        {part === 'chords'
          ? 'Learn the chord shapes in this passage, one sounding string at a time.'
          : level === 'essentials'
            ? 'A reduced-note exercise with the original timing. Hear a synthesized example of only these notes; return to the full arrangement when ready.'
            : lesson.synthesizedReference
              ? 'All notes in the selected passage, with a synthesized reference from the score.'
              : 'All notes in the selected passage. The original recording remains your listening reference.'}
      </p>
      {unavailable && (
        <p className="lc-warning">
          This passage does not fit your current guitar setup. Change the capo, tuning, or part.
        </p>
      )}
      {!ready && <p>Review your imported guide before starting a lesson.</p>}
      <button
        className="loop-button loop-button-purple"
        type="button"
        disabled={!ready || unavailable}
        onClick={() => onStart({ first, last, part, level })}
      >
        Start this lesson
      </button>
    </section>
  );
}
