import { memo, useMemo, useRef } from 'react';
import { Maximize2, Piano } from 'lucide-react';
import ArrangementNotes from '../../components/studio/ArrangementNotes';
import { INSTRUMENTS } from '../../utils/arrangementInstruments';
import { ghostNotes } from '../../utils/arrangementNotes';
import { bounded, repeatLinkedPattern, resizeClip } from '../../utils/arrangementModel';

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SAMPLE_ROOTS = Array.from(
  { length: 108 },
  (_, n) => `${PITCH_CLASSES[n % 12]}${Math.floor(n / 12)}`
);

function SoundControls({ selected, busy, commands }) {
  const settings = [
    ['attack', 'Attack (s)', 0.001, 4, 0.001, selected.instrument === 'pad' ? 0.16 : 0.005],
    ['release', 'Release (s)', 0.005, 2, 0.005, 0.04],
    [
      'cutoff',
      'Tone cutoff (Hz)',
      40,
      20000,
      10,
      selected.instrument === 'bass'
        ? 1800
        : ['synth', 'pad'].includes(selected.instrument)
          ? 4000
          : 20000,
    ],
  ];
  return (
    <details className="ae-voice-options">
      <summary>Sound controls</summary>
      <div>
        {settings.map(([key, label, min, max, step, fallback]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={selected.instrumentSettings?.[key] ?? fallback}
              disabled={busy}
              onChange={(e) =>
                commands.changeClip({
                  instrumentSettings: {
                    ...selected.instrumentSettings,
                    [key]: bounded(e.target.value, min, max, fallback),
                  },
                })
              }
            />
          </label>
        ))}
        <small>Release stays within the written note length.</small>
        <button
          type="button"
          disabled={busy}
          onClick={() => commands.changeClip({ instrumentSettings: {} })}
        >
          Reset sound
        </button>
      </div>
    </details>
  );
}

/** The docked instrument editor: pattern picker, instrument settings and piano roll. */
function InstrumentDock({
  project,
  selected,
  selectedTrack,
  bpm,
  busy,
  cursor,
  playing,
  position,
  editorHeight,
  expanded,
  commands,
}) {
  const sampleInput = useRef(null);
  const ghosts = useMemo(
    () => (selected?.kind === 'midi' ? ghostNotes(project, selected) : []),
    [project, selected]
  );
  const linked = selected?.patternId
    ? project.tracks
        .flatMap((track) => track.clips)
        .filter((clip) => clip.patternId === selected.patternId).length
    : 0;
  return (
    <section
      id="arrangement-piano-dock"
      className={`ae-piano-dock${expanded ? ' is-expanded' : ''}`}
      aria-label="Instrument editor"
      style={{ '--editor-height': `${editorHeight}px` }}
    >
      <header className="ae-dock-header">
        <strong>
          <Piano size={16} aria-hidden="true" /> Instrument editor
        </strong>
        <label>
          Pattern
          <select
            aria-label="Edit instrument pattern"
            value={selected?.kind === 'midi' ? selected.id : ''}
            onChange={(event) => commands.select(event.target.value)}
          >
            <option value="" disabled>
              Choose a pattern
            </option>
            {project.tracks.flatMap((track) =>
              track.clips
                .filter((clip) => clip.kind === 'midi')
                .map((clip) => (
                  <option key={clip.id} value={clip.id}>
                    {track.name} · {clip.name} · {clip.start.toFixed(1)}s
                  </option>
                ))
            )}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={commands.addMidi}>
          New instrument
        </button>
        <label className="ae-dock-size">
          Editor height
          <input
            aria-label="Instrument editor height"
            type="range"
            min="300"
            max="750"
            step="10"
            value={editorHeight}
            onChange={(event) => commands.setEditorHeight(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          className="ae-piano-expand"
          onClick={commands.toggleExpanded}
          aria-label={expanded ? 'Restore piano roll size' : 'Expand piano roll'}
          aria-pressed={expanded}
          title={expanded ? 'Restore piano roll size' : 'Expand piano roll'}
        >
          <Maximize2 size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ae-piano-close"
          onClick={commands.closeEditor}
          aria-label="Close instrument editor"
        >
          Close
        </button>
      </header>
      {selected?.kind === 'midi' ? (
        <>
          <details className="ae-instrument-settings">
            <summary>Instrument settings</summary>
            <div className="ae-instrument-controls" role="group" aria-label="Instrument settings">
              <label>
                Instrument
                <select
                  aria-label="Instrument"
                  value={selected.instrument || 'triangle'}
                  disabled={busy}
                  onChange={(event) => {
                    if (event.target.value === 'sampler' && !selected.assetId)
                      sampleInput.current?.click();
                    else commands.changeClip({ instrument: event.target.value });
                  }}
                >
                  {INSTRUMENTS.map(([id, name]) => (
                    <option value={id} key={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={busy} onClick={() => sampleInput.current?.click()}>
                Load sample
              </button>
              <input
                ref={sampleInput}
                type="file"
                accept="audio/*,.wav,.aif,.aiff,.mp3,.flac,.ogg"
                hidden
                aria-label="Instrument sample"
                onChange={(event) => {
                  const file = event.target.files?.[0],
                    clipId = selected.id;
                  event.target.value = '';
                  void commands.loadSample(file, clipId);
                }}
              />
              {selected.instrument === 'sampler' && (
                <label>
                  Sample root
                  <select
                    aria-label="Sample root"
                    value={selected.sampleRoot || 'C4'}
                    disabled={busy}
                    onChange={(e) => commands.changeClip({ sampleRoot: e.target.value })}
                  >
                    {SAMPLE_ROOTS.map((pitch) => (
                      <option key={pitch}>{pitch}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Timebase
                <select
                  value={selected.timebase || 'seconds'}
                  disabled={busy}
                  onChange={(event) => commands.changeClip({ timebase: event.target.value })}
                >
                  <option value="seconds">Absolute seconds</option>
                  <option value="beats">Follow project tempo</option>
                </select>
              </label>
              <label>
                Pattern length (bars)
                <input
                  type="number"
                  min="0.25"
                  max="256"
                  step="0.25"
                  disabled={busy}
                  value={Number(((selected.duration * bpm) / 240).toFixed(3))}
                  title="Changing length makes this pattern independent of its repetitions"
                  onChange={(event) =>
                    commands.changeClip(
                      resizeClip(selected, (bounded(event.target.value, 0.25, 256, 1) * 240) / bpm)
                    )
                  }
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const next = repeatLinkedPattern(commands.getProject(), selected.id);
                  const repeated = next.tracks
                    .find((track) => track.id === selectedTrack.id)
                    .clips.at(-1);
                  commands.edit(next);
                  commands.select(repeated.id);
                }}
              >
                Repeat linked pattern
              </button>
              <SoundControls selected={selected} busy={busy} commands={commands} />
              {selected.patternId && (
                <>
                  <span>{linked} linked · notes & instrument shared</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => commands.changeClip({ patternId: undefined })}
                  >
                    Make independent
                  </button>
                </>
              )}
              {selected.instrument === 'drums' && (
                <span>C: kick · D: snare · F♯: closed hat · A♯: open hat · others: toms</span>
              )}
            </div>
          </details>
          <ArrangementNotes
            compact
            key={selected.id}
            clip={selected}
            bpm={bpm}
            disabled={busy}
            ghosts={ghosts}
            playhead={cursor - selected.start}
            positionRef={position}
            playing={playing}
            onChange={commands.changeNotes}
            onAudition={commands.audition}
          />
        </>
      ) : (
        <div className="ae-dock-empty">
          <h3>Your instrument workspace</h3>
          <p>Select an instrument pattern or add one to start writing notes.</p>
          <button type="button" disabled={busy} onClick={commands.addMidi}>
            Add instrument pattern
          </button>
        </div>
      )}
    </section>
  );
}

export default memo(InstrumentDock);
