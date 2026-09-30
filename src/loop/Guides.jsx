import { useEffect, useMemo, useRef, useState } from 'react';
import StaffNotation from './StaffNotation';
import { noteName } from './music';
import { useGuitarProfile } from './GuitarSetup';
import { profileChord, profileNotes, positionForProfile, openStrings } from './guitarProfile';

export function ChordDiagram({ name, small = false }) {
  const { profile } = useGuitarProfile();
  const shape = profileChord(name, profile);
  if (!shape)
    return (
      <span>
        No comfortable {name} shape for this setup. Try standard tuning or another capo position.
      </span>
    );
  const left = 32,
    top = 42,
    gap = 22,
    step = 30;
  const stringX = (s) => left + (profile.handedness === 'left' ? 5 - s : s) * gap;
  return (
    <svg
      className={`loop-chord-diagram${small ? ' is-small' : ''}`}
      viewBox="0 0 174 197"
      role="img"
      aria-label={`${shape.fullName}. Frets from string 6 to string 1: ${shape.frets.map((f) => (f < 0 ? 'mute' : f === 0 ? 'open' : f)).join(', ')}.`}
    >
      {Array.from({ length: 6 }, (_, s) => (
        <line
          key={`s${s}`}
          x1={stringX(s)}
          x2={stringX(s)}
          y1={top}
          y2={top + 4 * step}
          className="loop-diagram-line"
        />
      ))}
      {Array.from({ length: 5 }, (_, f) => (
        <line
          key={`f${f}`}
          x1={left}
          x2={left + gap * 5}
          y1={top + f * step}
          y2={top + f * step}
          className="loop-diagram-line"
          strokeWidth={f === 0 && shape.startFret === 1 ? 4 : 1}
        />
      ))}
      <text x="14" y={top + 20} className="loop-diagram-label">
        {shape.startFret}
      </text>
      {shape.barre && (
        <line
          x1={stringX(shape.barre[0])}
          x2={stringX(shape.barre[1])}
          y1={top + step / 2}
          y2={top + step / 2}
          className="loop-barre"
        />
      )}
      {shape.frets.map((fret, s) => (
        <g key={s}>
          {fret <= 0 ? (
            <text x={stringX(s)} y="29" className="loop-string-state">
              {fret < 0 ? '×' : '○'}
            </text>
          ) : (
            <>
              <circle
                cx={stringX(s)}
                cy={top + (fret - shape.startFret + 0.5) * step}
                r="9"
                className="loop-finger-dot"
              />
              <text
                x={stringX(s)}
                y={top + (fret - shape.startFret + 0.5) * step + 4}
                className="loop-finger-label"
              >
                {shape.fingers[s]}
              </text>
            </>
          )}
          <text x={stringX(s)} y="186" className="loop-diagram-label">
            {noteName(openStrings(profile)[s]).replace(/\d/g, '')}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function TabGuide({ notes: sourceNotes, active, onSelect }) {
  const { profile } = useGuitarProfile();
  const notes = useMemo(() => profileNotes(sourceNotes, profile), [sourceNotes, profile]);
  const scroll = useRef(null);
  const width = Math.max(780, 100 + notes.length * 88);
  useEffect(() => {
    const area = scroll.current;
    const index = notes.findIndex((n) => n.index === active);
    if (!area || index < 0) return;
    const drawing = area.querySelector('svg');
    const x = ((90 + index * 88) / width) * drawing.getBoundingClientRect().width;
    if (x < area.scrollLeft + 30 || x > area.scrollLeft + area.clientWidth - 30) {
      area.scrollLeft = Math.max(0, x - area.clientWidth / 2);
    }
  }, [active, notes, width]);
  if (!notes.length) return <EmptyNotes />;
  return (
    <div className="loop-score-scroll" ref={scroll}>
      <svg
        viewBox={`0 0 ${width} 220`}
        style={{ minWidth: width }}
        className="loop-tab-score"
        role="img"
        aria-label="Guitar tablature. String 1, the thinnest string, is at the top. Select a note below to practice it."
      >
        {Array.from({ length: 6 }, (_, row) => (
          <g key={row}>
            <text x="25" y={52 + row * 25} className="loop-diagram-label">
              {noteName(openStrings(profile)[5 - row]).replace(/\d/g, '')}
            </text>
            <line
              x1="48"
              x2={width - 26}
              y1={48 + row * 25}
              y2={48 + row * 25}
              className="loop-diagram-line"
            />
          </g>
        ))}
        {notes.map((n, i) => {
          const x = 90 + i * 88,
            y = n.unplayable ? 110 : 48 + (5 - n.string) * 25;
          return (
            <g key={n.index} className={n.index === active ? 'loop-note-active' : ''}>
              {n.index === active && (
                <rect x={x - 22} y="23" width="44" height="169" rx="8" className="loop-note-band" />
              )}
              <rect
                x={x - 13}
                y={y - 13}
                width="26"
                height="26"
                rx="5"
                className="loop-tab-note-bg"
              />
              <text x={x} y={y + 5} className="loop-tab-number">
                {n.unplayable ? '×' : n.fret}
              </text>
              <text x={x} y="213" className="loop-diagram-label">
                {noteName(n.midi)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="loop-note-picks" aria-label="Select a note">
        {notes.map((n) => (
          <button
            key={n.index}
            type="button"
            onClick={() => onSelect(n.index)}
            aria-pressed={active === n.index}
          >
            {noteName(n.midi)}
            <span>{n.unplayable ? 'Outside range' : `Fret ${n.fret}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Fretboard({ note: original }) {
  const { profile } = useGuitarProfile();
  const note = original && positionForProfile(original, profile);
  const mirror = (x) => (profile.handedness === 'left' ? 780 - x : x);
  if (original && !note)
    return (
      <p className="lc-warning">
        {noteName(original.midi)} is outside this guitar setup. Change tuning or capo before
        practicing.
      </p>
    );
  if (!note) return <EmptyNotes />;
  const start = Math.max(1, note.fret - 4),
    end = start + 6;
  const x = note.fret === 0 ? 38 : 92 + (note.fret - start + 0.5) * 90;
  return (
    <div className="loop-score-scroll">
      <svg
        viewBox="0 0 780 250"
        className="loop-fretboard"
        role="img"
        aria-label={`${noteName(note.midi)}: string ${6 - note.string}, ${note.fret === 0 ? 'open' : 'fret ' + note.fret}`}
      >
        <rect
          x={profile.handedness === 'left' ? 58 : 92}
          y="33"
          width="630"
          height="152"
          rx="4"
          className="loop-fret-wood"
        />
        {[3, 5, 7, 9, 12, 15]
          .filter((f) => f >= start && f <= end)
          .map((f) => (
            <circle
              key={f}
              cx={mirror(92 + (f - start + 0.5) * 90)}
              cy="108"
              r="5"
              className="loop-fret-marker"
            />
          ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1={mirror(92 + i * 90)}
            x2={mirror(92 + i * 90)}
            y1="33"
            y2="185"
            className="loop-diagram-line"
            strokeWidth={i === 0 && start === 1 ? 5 : 2}
          />
        ))}
        {Array.from({ length: 6 }, (_, row) => (
          <g key={row}>
            <line
              x1={mirror(38)}
              x2={mirror(722)}
              y1={42 + row * 27}
              y2={42 + row * 27}
              className="loop-diagram-line"
              strokeWidth={0.8 + row * 0.4}
            />
            <text x={mirror(14)} y={47 + row * 27} className="loop-diagram-label">
              {noteName(openStrings(profile)[5 - row]).replace(/\d/g, '')}
            </text>
          </g>
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <text key={i} x={mirror(137 + i * 90)} y="218" className="loop-diagram-label">
            {start + i}
          </text>
        ))}
        <circle
          cx={mirror(x)}
          cy={42 + (5 - note.string) * 27}
          r="17"
          className="loop-finger-dot"
        />
        <text x={mirror(x)} y={47 + (5 - note.string) * 27} className="loop-finger-label">
          {note.fret}
        </text>
      </svg>
    </div>
  );
}

export function StaffGuide(props) {
  if (!props.notes.length) return <EmptyNotes />;
  return <StaffNotation {...props} />;
}

export function SongStaffGuide({ lesson, phrase, active }) {
  const [source, setSource] = useState(lesson.notes.length ? 'melody' : 'chords');
  const overlapping = useMemo(
    () =>
      (lesson.polyphonicNotes || [])
        .filter((n) => n.end > phrase.start && n.start < phrase.end)
        .map((n) => ({
          ...n,
          start: Math.max(n.start, phrase.start),
          end: Math.min(n.end, phrase.end),
        })),
    [lesson.polyphonicNotes, phrase.start, phrase.end]
  );
  const polyphonic =
    !!lesson.polyphonicNotes?.length && (source === 'chords' || !lesson.notes.length);
  return (
    <>
      {!!lesson.polyphonicNotes?.length && (
        <div className="lj-preview-controls">
          {lesson.notes.length ? (
            <label>
              Score{' '}
              <select
                aria-label="Sheet music source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="melody">Melody line</option>
                <option value="chords">Overlapping notes · draft</option>
              </select>
            </label>
          ) : (
            <span>Overlapping notes · draft</span>
          )}
          {polyphonic && <span>Approximate sixteenth-note rhythm · 4/4</span>}
        </div>
      )}
      {polyphonic && !overlapping.length ? (
        <p>No chord tones were detected in this phrase.</p>
      ) : (
        <StaffGuide
          notes={polyphonic ? overlapping : phrase.notes}
          bpm={lesson.bpm}
          active={polyphonic ? undefined : active}
          polyphonic={polyphonic}
        />
      )}
    </>
  );
}

function EmptyNotes() {
  return (
    <div className="loop-empty-notes">
      <strong>No clear single notes found.</strong>
      <p>Try a clean guitar recording, or use the chord chart to practice the harmony.</p>
    </div>
  );
}
