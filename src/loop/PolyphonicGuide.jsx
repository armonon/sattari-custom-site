import { useMemo, useState } from 'react';
import { groupAttacks, voiceGuitar, chordsFromPolyphonic } from './harmony';
import { noteName } from './music';
import { useGuitarProfile } from './GuitarSetup';
import { openStrings } from './guitarProfile';
import StaffNotation from './StaffNotation';
const EMPTY_NOTES = [];

export default function PolyphonicGuide({ lesson, phrase, onEditLesson }) {
  const { profile } = useGuitarProfile();
  const tuning = openStrings(profile);
  const notes = lesson.polyphonicNotes || EMPTY_NOTES;
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(false);
  const groups = useMemo(
    () =>
      groupAttacks(notes.map((n, index) => ({ ...n, index }))).filter(
        (group) => group.start >= phrase.start && group.start < phrase.end
      ),
    [notes, phrase.start, phrase.end]
  );
  const index = Math.min(selected, Math.max(0, groups.length - 1));
  const group = groups[index];
  const voicing = group ? voiceGuitar(group.notes, tuning) : null;
  const scoreNotes = useMemo(
    () =>
      notes
        .filter((n) => n.end > phrase.start && n.start < phrase.end)
        .map((n) => ({
          ...n,
          start: Math.max(n.start, phrase.start),
          end: Math.min(n.end, phrase.end),
        })),
    [notes, phrase.start, phrase.end]
  );
  const change = (next) => {
    const sorted = next.sort((a, b) => a.start - b.start || a.midi - b.midi);
    onEditLesson({
      ...lesson,
      polyphonicNotes: sorted,
      chords: chordsFromPolyphonic(sorted, lesson.duration, lesson.bpm),
    });
  };
  return (
    <section className="lf-poly-guide" aria-label="Overlapping note guide">
      <div className="lf-poly-heading">
        <div>
          <span className="lj-eyebrow">CHORD TONES · DRAFT</span>
          <h3>See the notes together.</h3>
        </div>
        {onEditLesson && (
          <button
            type="button"
            className="loop-button loop-button-secondary"
            aria-pressed={editing}
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Done editing tones' : 'Edit chord tones'}
          </button>
        )}
      </div>
      <p>
        Notes within 120 ms share a column. Fingerings are suggestions; a recording cannot reveal
        which string was used. Your melody practice stays separate.
      </p>
      <div className="lf-poly-attacks" aria-label="Choose a note group">
        {groups.map((g, i) => (
          <button
            type="button"
            key={`${g.start}-${i}`}
            aria-pressed={i === index}
            onClick={() => setSelected(i)}
          >
            <strong>{g.start.toFixed(2)}s</strong>
            <small>
              {g.notes.length} {g.notes.length === 1 ? 'tone' : 'tones'}
            </small>
          </button>
        ))}
      </div>
      {group ? (
        <>
          <div className="lf-voicing" aria-label="Suggested guitar fingering">
            {[5, 4, 3, 2, 1, 0].map((string) => {
              const note = voicing?.find((n) => n.string === string);
              return (
                <div key={string}>
                  <span>{noteName(tuning[string]).replace(/\d/g, '')}</span>
                  <i />
                  <strong>{note ? note.fret : '—'}</strong>
                  <i />
                  <small>{note ? noteName(note.midi) : 'skip'}</small>
                </div>
              );
            })}
          </div>
          {!voicing && (
            <p className="lf-save-warning">
              These tones don’t form a playable six-string shape. Check for extra notes before using
              this fingering.
            </p>
          )}
          <div className="lf-poly-note-list">
            {group.notes.map((note) => (
              <div key={note.index}>
                {editing ? (
                  <>
                    <label>
                      Note at {note.start.toFixed(2)}s
                      <select
                        value={note.midi}
                        onChange={(event) =>
                          change(
                            notes.map((n, i) =>
                              i === note.index
                                ? { ...n, midi: Number(event.target.value), edited: true }
                                : n
                            )
                          )
                        }
                      >
                        {Array.from({ length: 45 }, (_, i) => i + 40).map((midi) => (
                          <option key={midi} value={midi}>
                            {noteName(midi)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${noteName(note.midi)} at ${note.start.toFixed(2)} seconds`}
                      onClick={() => change(notes.filter((_, i) => i !== note.index))}
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <strong>{noteName(note.midi)}</strong>
                    <small>
                      {note.start.toFixed(2)}–{note.end.toFixed(2)}s
                    </small>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p>
          No overlapping-note estimates in this phrase. Try a clear guitar recording or add tones
          while listening.
        </p>
      )}
      {editing && (
        <>
          <button
            type="button"
            className="lj-text-link"
            onClick={() =>
              change([
                ...notes,
                {
                  midi: 60,
                  start: group?.start ?? phrase.start,
                  end: Math.min(lesson.duration, group?.end ?? phrase.start + 0.5),
                  confidence: 1,
                  edited: true,
                },
              ])
            }
          >
            Add a note to this group
          </button>
          <p>
            <small>
              Changing chord tones recalculates the draft chord chart and asks you to review it
              again.
            </small>
          </p>
        </>
      )}
      <p className="lj-guide-tip">
        The draft score below keeps overlapping notes and uses ties while other notes enter or stop.
        Timing is rounded to sixteenth notes in 4/4; compare it with the recording. Your melody
        practice stays separate.
      </p>
      {scoreNotes.length > 0 && <StaffNotation notes={scoreNotes} bpm={lesson.bpm} polyphonic />}
    </section>
  );
}
