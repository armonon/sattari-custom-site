import { memo, useEffect, useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { arrangementGridPixels, rulerMarks } from '../../utils/arrangementModel';
import TimelineTrack from './TimelineTrack';

/** The scrolling multitrack canvas: ruler, track rows and the add-track tail. */
function Timeline({
  scrollRef,
  visible,
  tracks,
  zoom,
  bpm,
  grid,
  width,
  duration,
  cursor,
  busy,
  selection,
  snapped,
  suppressClick,
  moving,
  commands,
}) {
  const [view, setView] = useState({ left: 0, width: 1400 });
  // The dragged clip stays mounted even if it leaves the rendered window.
  const [activeClipId, setActiveClipId] = useState(null);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !visible) return undefined;
    const measure = () => setView({ left: element.scrollLeft, width: element.clientWidth || 1400 });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, scrollRef]);
  const marks = useMemo(() => rulerMarks(duration, bpm, zoom, view), [duration, bpm, zoom, view]);
  const gridPixels = arrangementGridPixels(bpm, grid, zoom);
  const position = (event) =>
    (event.clientX - event.currentTarget.getBoundingClientRect().left) / zoom;
  return (
    <div
      className="ae-scroll"
      role="region"
      aria-label="Arrangement timeline"
      style={{ '--ae-playhead-x': `${cursor * zoom}px` }}
      ref={scrollRef}
      onScroll={(event) =>
        setView({
          left: event.currentTarget.scrollLeft,
          width: event.currentTarget.clientWidth || 1400,
        })
      }
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        commands.dropFiles(event.dataTransfer);
      }}
    >
      <div
        className="ae-timeline"
        style={{ width: `calc(${width}px + var(--ae-head-width, 220px))` }}
      >
        <div className="ae-ruler">
          <span>Tracks / bars</span>
          <button
            type="button"
            aria-label="Seek arrangement timeline"
            style={{ width }}
            onClick={(event) => void commands.seek(snapped(position(event)))}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                void commands.seek(
                  cursor + ((event.key === 'ArrowLeft' ? -1 : 1) * 60) / bpm / grid
                );
              } else if (event.key === 'Home') {
                event.preventDefault();
                void commands.seek(0);
              }
            }}
          >
            {marks.map((mark) => (
              <i key={mark.time} style={{ left: mark.time * zoom }}>
                {mark.label}
              </i>
            ))}
          </button>
        </div>
        {tracks.map((track, index) => (
          <TimelineTrack
            key={track.id}
            track={track}
            first={index === 0}
            last={index === tracks.length - 1}
            zoom={zoom}
            width={width}
            gridPixels={gridPixels}
            view={view}
            selection={selection}
            activeClipId={activeClipId}
            busy={busy}
            snapped={snapped}
            suppressClick={suppressClick}
            moving={moving}
            onGesture={setActiveClipId}
            commands={commands}
          />
        ))}
        <div className={`ae-canvas-tail ${!tracks.length ? 'is-empty' : ''}`}>
          <div className="ae-tail-head">
            <Plus size={22} aria-hidden="true" />
            <strong>{tracks.length ? 'Keep creating' : 'Your tracks go here'}</strong>
            <small>
              Audio or instruments.
              <br />
              One idea at a time.
            </small>
            <button type="button" disabled={busy} onClick={commands.addAudioTrack}>
              New audio track
            </button>
            <button type="button" disabled={busy} onClick={commands.addMidi}>
              New instrument track
            </button>
          </div>
          <div
            className="ae-empty-grid"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              commands.dropFiles(event.dataTransfer, null, Math.max(0, snapped(position(event))));
            }}
            style={{
              width,
              '--ae-grid': `${gridPixels}px`,
              '--ae-bar': `${(240 / bpm) * zoom}px`,
            }}
          >
            {!tracks.length && (
              <div className="ae-empty-hint">
                <Upload size={24} aria-hidden="true" />
                <strong>Drop audio or MIDI onto the timeline</strong>
                <span>Or choose Add audio track or Add instrument above.</span>
              </div>
            )}
            <div className="ae-playhead" style={{ left: 'var(--ae-playhead-x)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(Timeline);
