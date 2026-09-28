import { useEffect, useRef } from 'react';
import { chordShape, noteName, STRING_NAMES } from './music';

export function ChordDiagram({ name, small = false }) {
  const shape = chordShape(name);
  if (!shape) return <span>Choose a chord</span>;
  const left = 32,
    top = 42,
    gap = 22,
    step = 30;
  return (
    <svg
      className={`loop-chord-diagram${small ? ' is-small' : ''}`}
      viewBox="0 0 174 197"
      role="img"
      aria-label={`${shape.fullName}. Frets from low E to high E: ${shape.frets.map((f) => (f < 0 ? 'mute' : f === 0 ? 'open' : f)).join(', ')}.`}
    >
      {Array.from({ length: 6 }, (_, s) => (
        <line
          key={`s${s}`}
          x1={left + s * gap}
          x2={left + s * gap}
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
          x1={left + shape.barre[0] * gap}
          x2={left + shape.barre[1] * gap}
          y1={top + step / 2}
          y2={top + step / 2}
          className="loop-barre"
        />
      )}
      {shape.frets.map((fret, s) => (
        <g key={s}>
          {fret <= 0 ? (
            <text x={left + s * gap} y="29" className="loop-string-state">
              {fret < 0 ? '×' : '○'}
            </text>
          ) : (
            <>
              <circle
                cx={left + s * gap}
                cy={top + (fret - shape.startFret + 0.5) * step}
                r="9"
                className="loop-finger-dot"
              />
              <text
                x={left + s * gap}
                y={top + (fret - shape.startFret + 0.5) * step + 4}
                className="loop-finger-label"
              >
                {shape.fingers[s]}
              </text>
            </>
          )}
          <text x={left + s * gap} y="186" className="loop-diagram-label">
            {STRING_NAMES[s]}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function TabGuide({ notes, active, onSelect }) {
  const scroll = useRef(null);
  useEffect(() => {
    const area = scroll.current;
    const index = notes.findIndex((n) => n.index === active);
    if (!area || index < 0) return;
    const drawing = area.querySelector('svg');
    const x = ((90 + index * 88) / 780) * drawing.getBoundingClientRect().width;
    if (x < area.scrollLeft + 30 || x > area.scrollLeft + area.clientWidth - 30) {
      area.scrollLeft = Math.max(0, x - area.clientWidth / 2);
    }
  }, [active, notes]);
  if (!notes.length) return <EmptyNotes />;
  return (
    <div className="loop-score-scroll" ref={scroll}>
      <svg
        viewBox="0 0 780 220"
        className="loop-tab-score"
        role="img"
        aria-label="Guitar tablature. High E string is at the top. Select a note below to practice it."
      >
        {Array.from({ length: 6 }, (_, row) => (
          <g key={row}>
            <text x="25" y={52 + row * 25} className="loop-diagram-label">
              {STRING_NAMES[5 - row]}
            </text>
            <line
              x1="48"
              x2="754"
              y1={48 + row * 25}
              y2={48 + row * 25}
              className="loop-diagram-line"
            />
          </g>
        ))}
        {notes.map((n, i) => {
          const x = 90 + i * 88,
            y = 48 + (5 - n.string) * 25;
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
                {n.fret}
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
            <span>Fret {n.fret}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Fretboard({ note }) {
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
        <rect x="92" y="33" width="630" height="152" rx="4" className="loop-fret-wood" />
        {[3, 5, 7, 9, 12, 15]
          .filter((f) => f >= start && f <= end)
          .map((f) => (
            <circle
              key={f}
              cx={92 + (f - start + 0.5) * 90}
              cy="108"
              r="5"
              className="loop-fret-marker"
            />
          ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1={92 + i * 90}
            x2={92 + i * 90}
            y1="33"
            y2="185"
            className="loop-diagram-line"
            strokeWidth={i === 0 && start === 1 ? 5 : 2}
          />
        ))}
        {Array.from({ length: 6 }, (_, row) => (
          <g key={row}>
            <line
              x1="38"
              x2="722"
              y1={42 + row * 27}
              y2={42 + row * 27}
              className="loop-diagram-line"
              strokeWidth={0.8 + row * 0.4}
            />
            <text x="14" y={47 + row * 27} className="loop-diagram-label">
              {STRING_NAMES[5 - row]}
            </text>
          </g>
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <text key={i} x={137 + i * 90} y="218" className="loop-diagram-label">
            {start + i}
          </text>
        ))}
        <circle cx={x} cy={42 + (5 - note.string) * 27} r="17" className="loop-finger-dot" />
        <text x={x} y={47 + (5 - note.string) * 27} className="loop-finger-label">
          {note.fret}
        </text>
      </svg>
    </div>
  );
}

// Guitar notation is written an octave above sounding pitch.
function staffPosition(midi) {
  const name = noteName(midi + 12);
  const octave = Math.floor((midi + 12) / 12) - 1;
  const letter = 'CDEFGAB'.indexOf(name[0]);
  const steps = (octave - 4) * 7 + letter - 2;
  return { y: 133 - steps * 6, sharp: name.includes('#') };
}

export function StaffGuide({ notes, active, bpm }) {
  if (!notes.length) return <EmptyNotes />;
  return (
    <div className="loop-score-scroll">
      <svg
        viewBox="0 -32 780 252"
        className="loop-staff-score"
        role="img"
        aria-label="Guitar staff notation, written an octave above sounding pitch. Rhythm is rounded to the nearest eighth, quarter, half or whole note."
      >
        {[85, 97, 109, 121, 133].map((y) => (
          <line key={y} x1="30" x2="756" y1={y} y2={y} className="loop-diagram-line" />
        ))}
        <text x="40" y="137" className="loop-clef">
          𝄞
        </text>
        <text x="49" y="162" className="loop-diagram-label">
          8
        </text>
        {notes.map((n, i) => {
          const x = 115 + i * 86,
            { y, sharp } = staffPosition(n.midi);
          const beats = ((n.end - n.start) * bpm) / 60;
          const half = beats >= 1.5,
            whole = beats >= 3;
          const ledger = [];
          for (let ly = 145; ly <= y; ly += 12) ledger.push(ly);
          for (let ly = 73; ly >= y; ly -= 12) ledger.push(ly);
          return (
            <g key={n.index} className={n.index === active ? 'loop-note-active' : ''}>
              {n.index === active && (
                <rect x={x - 24} y="20" width="48" height="178" rx="8" className="loop-note-band" />
              )}
              {ledger.map((ly) => (
                <line key={ly} x1={x - 12} x2={x + 12} y1={ly} y2={ly} className="loop-ledger" />
              ))}
              {sharp && (
                <text x={x - 18} y={y + 5} className="loop-accidental">
                  ♯
                </text>
              )}
              <ellipse
                cx={x}
                cy={y}
                rx="7"
                ry="5"
                transform={`rotate(-20 ${x} ${y})`}
                className={half ? 'loop-notehead hollow' : 'loop-notehead'}
              />
              {!whole && <line x1={x + 6} x2={x + 6} y1={y} y2={y - 35} className="loop-stem" />}
              {beats < 0.7 && (
                <path
                  d={`M ${x + 6} ${y - 35} Q ${x + 25} ${y - 26} ${x + 14} ${y - 14}`}
                  className="loop-flag"
                />
              )}
              <text x={x} y="213" className="loop-diagram-label">
                {noteName(n.midi)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
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
