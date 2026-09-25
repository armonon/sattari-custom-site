import { memo, useMemo } from 'react';
import { Music2, Trash2 } from 'lucide-react';
import './PianoRoll.css';

const PITCHES = ['B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4'];
const NATURALS = PITCHES.flatMap((pitch, row) => (pitch.includes('#') ? [] : [{ pitch, row }]));

function PianoRoll({ notes, onToggleNote, onClear, audible = false }) {
  const activeNotes = useMemo(
    () => new Set(notes.map(({ pitch, step }) => `${pitch}:${step}`)),
    [notes]
  );
  const activePitches = useMemo(() => new Set(notes.map(({ pitch }) => pitch)), [notes]);

  return (
    <section className="sd-piano-roll" aria-label="Piano roll">
      <header>
        <div className="sd-piano-heading">
          <Music2 size={18} aria-hidden="true" />
          <div>
            <strong>Piano roll</strong>
            <small>
              {audible
                ? 'Instrument clip · included in playback & export'
                : 'Pattern sketch · not in playback'}
            </small>
          </div>
        </div>
        <div className="sd-piano-meta">
          <span>1 bar</span>
          <span>1/16 grid</span>
          <span>
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={!notes.length}
          aria-label="Clear piano notes"
        >
          <Trash2 size={14} aria-hidden="true" /> Clear
        </button>
      </header>
      <div
        className="sd-piano-scroll"
        tabIndex={0}
        role="region"
        aria-label="Piano note grid, scroll horizontally on smaller screens"
      >
        <div className="sd-piano-surface">
          <div className="sd-piano-corner" aria-hidden="true">
            C4–B4
          </div>
          <div className="sd-piano-ruler" aria-hidden="true">
            {Array.from({ length: 16 }, (_, step) => (
              <span key={step} className={step % 4 === 0 ? 'is-beat' : ''}>
                {step % 4 === 0 ? `1.${step / 4 + 1}` : '·'}
              </span>
            ))}
          </div>
          <div className="sd-piano-keyboard" aria-hidden="true">
            {NATURALS.map(({ pitch, row }, index) => {
              // Natural keys extend halfway to the next natural's centre;
              // accidentals overlay them at the corresponding semitone row.
              const start = index ? (NATURALS[index - 1].row + row + 1) / 2 : 0;
              const end =
                index < NATURALS.length - 1 ? (row + NATURALS[index + 1].row + 1) / 2 : 12;
              return (
                <div
                  key={pitch}
                  className={`sd-piano-key is-natural${activePitches.has(pitch) ? ' has-notes' : ''}`}
                  style={{
                    top: `${(start / 12) * 100}%`,
                    height: `${((end - start) / 12) * 100}%`,
                  }}
                >
                  <span style={{ top: `${((row + 0.5 - start) / (end - start)) * 100}%` }}>
                    {pitch}
                  </span>
                </div>
              );
            })}
            {PITCHES.map(
              (pitch, row) =>
                pitch.includes('#') && (
                  <div
                    key={pitch}
                    className={`sd-piano-key is-accidental${activePitches.has(pitch) ? ' has-notes' : ''}`}
                    style={{ top: `${(row / 12) * 100}%` }}
                  >
                    <span>{pitch.replace('#', '♯')}</span>
                  </div>
                )
            )}
          </div>
          <div className="sd-piano-grid">
            {PITCHES.map((pitch) => (
              <div
                className={`sd-piano-row${pitch.includes('#') ? ' is-accidental' : ''}${pitch === 'C4' ? ' is-octave' : ''}`}
                key={pitch}
              >
                {Array.from({ length: 16 }, (_, step) => {
                  const active = activeNotes.has(`${pitch}:${step}`);
                  return (
                    <button
                      type="button"
                      key={step}
                      className={active ? 'is-note' : ''}
                      onClick={() => onToggleNote(pitch, step)}
                      aria-label={`${pitch} step ${step + 1}`}
                      aria-pressed={active}
                      title={`${active ? 'Remove' : 'Add'} ${pitch} · beat ${Math.floor(step / 4) + 1}, step ${(step % 4) + 1}`}
                    >
                      {active && <span aria-hidden="true">{pitch.replace('#', '♯')}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <footer>
        <span>Click a cell to add or remove a note</span>
        <span>Chromatic · C4–B4</span>
      </footer>
    </section>
  );
}

export default memo(PianoRoll);
