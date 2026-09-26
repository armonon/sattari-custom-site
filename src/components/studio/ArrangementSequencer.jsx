import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { arrangementId } from '../../utils/arrangementModel';
import './ArrangementSequencer.css';

const lanes = [
  ['C2', 'Kick'],
  ['D2', 'Snare'],
  ['F#2', 'Closed hat'],
  ['A#2', 'Open hat'],
  ['G2', 'Tom'],
];
const steps = Array.from({ length: 16 }, (_, index) => index);

export default function ArrangementSequencer({
  clip,
  bpm,
  disabled,
  onChange,
  onAudition,
  positionRef,
  playing,
}) {
  const [page, setPage] = useState(0);
  const [lane, setLane] = useState('C2');
  const grid = useRef(null);
  const unit = 60 / bpm / 4;
  const bar = unit * 16;
  const pages = Math.max(1, Math.ceil((clip.duration - 0.000001) / bar));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * bar;
  const canExtend = (pages + 1) * bar <= 86400;
  const hits = useMemo(() => {
    const result = new Map();
    clip.notes.forEach((note, index) => {
      const step = Math.round((note.time - start) / unit);
      const key = `${note.pitch}:${step}`;
      if (
        step >= 0 &&
        step < 16 &&
        Math.abs(note.time - (start + step * unit)) < 0.000001 &&
        !result.has(key)
      )
        result.set(key, index);
    });
    return result;
  }, [clip.notes, start, unit]);
  const hit = (pitch, step) => hits.get(`${pitch}:${step}`) ?? -1;
  const available = (step) => start + step * unit <= clip.duration - 0.001;

  useEffect(() => {
    if (!playing || !positionRef) return;
    const element = grid.current;
    let frame;
    let previous = -1;
    const tick = () => {
      const local = positionRef.current - clip.start;
      const index =
        local >= start && local < Math.min(start + bar, clip.duration)
          ? Math.floor((local - start) / unit)
          : -1;
      if (previous !== index) {
        element?.querySelectorAll('[data-step]').forEach((element) => {
          element.dataset.playing = Number(element.dataset.step) === index ? 'true' : 'false';
        });
        previous = index;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      element?.querySelectorAll('[data-playing]').forEach((element) => {
        element.dataset.playing = 'false';
      });
    };
  }, [playing, positionRef, clip.start, clip.duration, start, bar, unit]);

  const toggle = (pitch, step) => {
    const index = hit(pitch, step);
    setLane(pitch);
    if (index >= 0) {
      onChange({ notes: clip.notes.filter((_, i) => i !== index) });
    } else {
      const note = {
        id: arrangementId(),
        pitch,
        time: start + step * unit,
        duration: Math.min(unit * 0.8, clip.duration - start - step * unit),
        velocity: 0.8,
      };
      onChange({ notes: [...clip.notes, note] });
      onAudition(note);
    }
  };
  const copyBar = () => {
    // Append instead of overwriting later bars. Preserve free timing and note lengths.
    const destination = pages * bar;
    const notes = clip.notes
      .filter((note) => note.time >= start && note.time < start + bar)
      .map((note) => ({
        ...note,
        id: arrangementId(),
        time: destination + note.time - start,
      }));
    onChange({ duration: destination + bar, notes: [...clip.notes, ...notes] });
    setPage(pages);
  };
  const addBar = () => {
    if (disabled || !canExtend) return;
    // Leave existing hits (including free-timed notes) untouched and open a blank bar.
    onChange({ duration: (pages + 1) * bar });
    setPage(pages);
  };

  return (
    <section className="ae-sequencer" aria-label="Drum step sequencer">
      <header className="ae-sequencer-heading">
        <div>
          <strong>Beat sequencer</strong>
          <small>Synthesized kit · 16 steps / 4 beats</small>
        </div>
        <div className="ae-sequencer-actions">
          <button
            type="button"
            disabled={disabled || currentPage === 0}
            aria-label="Previous beat bar"
            onClick={() => setPage(currentPage - 1)}
          >
            ‹
          </button>
          <label>
            Bar{' '}
            <input
              type="number"
              aria-label="Beat bar"
              min="1"
              max={pages}
              value={currentPage + 1}
              disabled={disabled}
              onChange={(event) =>
                setPage(
                  Math.max(0, Math.min(pages - 1, Math.floor(Number(event.target.value) || 1) - 1))
                )
              }
            />{' '}
            / {pages}
          </label>
          <button
            type="button"
            disabled={disabled || currentPage === pages - 1}
            aria-label="Next beat bar"
            onClick={() => setPage(currentPage + 1)}
          >
            ›
          </button>
          <button type="button" disabled={disabled || !canExtend} onClick={copyBar}>
            Copy bar to end
          </button>
        </div>
      </header>
      <div className="ae-sequencer-scroll">
        <div className="ae-sequencer-grid" ref={grid}>
          <div className="ae-sequencer-row ae-sequencer-ruler">
            <span>VOICE</span>
            {steps.map((step) => (
              <span key={step}>{step + 1}</span>
            ))}
          </div>
          {lanes.map(([pitch, name], index) => (
            <div
              className="ae-sequencer-row"
              key={pitch}
              style={{
                '--lane-color': ['#e9a45c', '#be9bfa', '#6bcfc4', '#6ab7ed', '#e994af'][index],
              }}
            >
              <button
                type="button"
                className="ae-sequencer-voice"
                aria-label={`Audition ${name}`}
                aria-pressed={lane === pitch}
                disabled={disabled}
                onClick={() => {
                  setLane(pitch);
                  onAudition({ pitch, duration: unit * 0.8, velocity: 0.8 });
                }}
              >
                {name}
              </button>
              {steps.map((step) => {
                const index = hit(pitch, step);
                return (
                  <button
                    type="button"
                    key={step}
                    data-step={step}
                    className="ae-sequencer-step"
                    aria-label={`${name} step ${step + 1}`}
                    aria-pressed={index >= 0}
                    disabled={disabled || !available(step)}
                    onClick={() => toggle(pitch, step)}
                    style={{ '--hit-velocity': index >= 0 ? clip.notes[index].velocity : 0 }}
                  >
                    <span />
                  </button>
                );
              })}
            </div>
          ))}
          <div className="ae-sequencer-row ae-sequencer-velocity">
            <span>
              {lanes.find(([pitch]) => pitch === lane)?.[1]}
              <small>Velocity</small>
            </span>
            {steps.map((step) => {
              const index = hit(lane, step);
              return (
                <input
                  key={step}
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  aria-label={`Velocity step ${step + 1}`}
                  value={index >= 0 ? Math.round(clip.notes[index].velocity * 100) : 1}
                  disabled={disabled || index < 0}
                  onChange={(event) =>
                    onChange({
                      notes: clip.notes.map((note, i) =>
                        i === index ? { ...note, velocity: Number(event.target.value) / 100 } : note
                      ),
                    })
                  }
                />
              );
            })}
          </div>
        </div>
      </div>
      <footer className="ae-sequencer-footer">
        <span className="ae-sequencer-help">
          Click a step to toggle a hit. Select a voice for velocity.
          <small>Free-timed notes stay intact. Extending makes this pattern independent.</small>
        </span>
        <div className="ae-sequencer-continue">
          <span role="status" aria-live="polite" aria-atomic="true">
            Bar {currentPage + 1} of {pages}
          </span>
          <button
            type="button"
            className="ae-sequencer-add-bar"
            aria-label="Add empty bar"
            title={
              canExtend
                ? 'Add 16 empty steps and open the new bar'
                : 'Maximum pattern length reached'
            }
            disabled={disabled || !canExtend}
            onClick={addBar}
          >
            <span>+16</span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}
