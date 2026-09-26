import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pencil,
  MousePointer2,
  Eraser,
  Copy,
  Trash2,
  ScanLine,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  Wand2,
  Magnet,
} from 'lucide-react';
import './ArrangementNotes.css';
import {
  duplicateNotes,
  moveNotes,
  noteNumber,
  notePitch,
  quantizeNotes,
  snapPitch,
  notesInBox,
} from '../../utils/arrangementNotes';

const rowHeight = 28;
const keyWidth = 80;
const rulerHeight = 28;
const pitches = Array.from({ length: 108 }, (_, index) => notePitch(107 - index));
const naturals = pitches.flatMap((pitch, row) => (pitch.includes('#') ? [] : [{ pitch, row }]));
const keyGeometry = new Map(
  naturals.map(({ pitch, row }, index) => {
    const start = index ? (naturals[index - 1].row + row + 1) / 2 : 0;
    const end =
      index < naturals.length - 1 ? (row + naturals[index + 1].row + 1) / 2 : pitches.length;
    return [
      pitch,
      {
        top: (start - row) * rowHeight,
        height: (end - start) * rowHeight,
        label: (row + 0.5 - start) * rowHeight,
      },
    ];
  })
);
export default function ArrangementNotes({
  clip,
  bpm,
  onChange,
  onAudition,
  disabled,
  ghosts = [],
  playhead = null,
  positionRef,
  playing = false,
  compact = false,
}) {
  // A captured bass/drum part should open on its notes, not an unrelated
  // default register. The dock remounts this editor when its clip changes.
  const [octave, setOctave] = useState(() => {
      const pitches = clip.notes.map((note) => noteNumber(note.pitch)).sort((a, b) => a - b);
      return pitches.length ? Math.floor(pitches[Math.floor(pitches.length / 2)] / 12) : 4;
    }),
    [division, setDivision] = useState(4),
    [snapPositions, setSnapPositions] = useState(false),
    [selection, setSelection] = useState([]),
    [velocity, setVelocity] = useState(0.7),
    [noteLength, setNoteLength] = useState(1),
    [pixels, setPixels] = useState(96),
    [view, setView] = useState({ left: 0, width: 1000, top: 0, height: 240 }),
    [preview, setPreview] = useState(null),
    [strength, setStrength] = useState(100),
    [swing, setSwing] = useState(0),
    [root, setRoot] = useState('off'),
    [scale, setScale] = useState('major'),
    [notice, setNotice] = useState(''),
    [tool, setTool] = useState('draw'),
    [scaleSnap, setScaleSnap] = useState(false),
    [showGhosts, setShowGhosts] = useState(true),
    [marquee, setMarquee] = useState(null),
    [auditionEnabled, setAuditionEnabled] = useState(true);
  const scroll = useRef(null),
    velocityScroll = useRef(null),
    surface = useRef(null),
    playheadElement = useRef(null),
    drag = useRef(null),
    boxDrag = useRef(null),
    suppressClick = useRef(false);
  const unit = 60 / bpm / division,
    zoom = (pixels * bpm) / 60,
    rulerStep = pixels >= 32 ? 1 : Math.max(4, Math.ceil(48 / (pixels * 4)) * 4),
    width = Math.max(view.width - keyWidth, clip.duration * zoom),
    chosen = selection.filter((index) => clip.notes[index]),
    note = clip.notes[chosen[0]];
  // Keep the full pitch range scrollable without mounting hundreds of offscreen
  // key/grid controls on every note edit. Overscan covers neighboring keys;
  // retain all rows during a gesture so pointer capture cannot be unmounted.
  const firstRow =
    preview || marquee ? 0 : Math.max(0, Math.floor((view.top - rulerHeight) / rowHeight) - 8);
  const lastRow =
    preview || marquee
      ? pitches.length
      : Math.min(pitches.length, Math.ceil((view.top + view.height) / rowHeight) + 8);
  const rows = useMemo(() => {
    const result = new Map();
    clip.notes.forEach((item, index) => {
      if (
        item.time * zoom > view.left + view.width ||
        (item.time + item.duration) * zoom < view.left
      )
        return;
      if (!result.has(item.pitch)) result.set(item.pitch, []);
      result.get(item.pitch).push({ item, index });
    });
    return result;
  }, [clip.notes, zoom, view]);
  const ghostRows = useMemo(() => {
    const result = new Map();
    for (const n of ghosts) {
      if (n.time * zoom > view.left + view.width || (n.time + n.duration) * zoom < view.left)
        continue;
      if (!result.has(n.pitch)) result.set(n.pitch, []);
      result.get(n.pitch).push(n);
    }
    return result;
  }, [ghosts, zoom, view]);
  useEffect(() => {
    if (scroll.current) {
      scroll.current.scrollTop = Math.max(
        0,
        (107 - octave * 12) * rowHeight - (scroll.current.clientHeight || 240) / 2
      );
      setView((value) => ({ ...value, top: scroll.current.scrollTop }));
    }
  }, [octave]);
  useEffect(() => {
    const element = scroll.current;
    const measure = () =>
      setView((value) => ({
        ...value,
        width: element.clientWidth || 1000,
        height: element.clientHeight || 240,
      }));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || !positionRef) return;
    let frame,
      previous = -Infinity;
    const tick = (time) => {
      if (time - previous >= 32 && playheadElement.current) {
        const local = positionRef.current - (clip.start || 0);
        playheadElement.current.hidden = local < 0 || local >= clip.duration;
        playheadElement.current.style.left = `${keyWidth + local * zoom}px`;
        previous = time;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, positionRef, clip.start, clip.duration, zoom]);
  const audition = (value) => {
    if (auditionEnabled && !disabled) onAudition?.(value);
  };
  const fit = () => {
    setPixels(
      Math.max(0.25, Math.min(384, (view.width - keyWidth - 24) / ((clip.duration * bpm) / 60)))
    );
    if (scroll.current) scroll.current.scrollLeft = 0;
    if (velocityScroll.current) velocityScroll.current.scrollLeft = 0;
    setView((value) => ({ ...value, left: 0 }));
    if (clip.notes.length) {
      const average =
        clip.notes.reduce((sum, item) => sum + noteNumber(item.pitch), 0) / clip.notes.length;
      scroll.current.scrollTop = Math.max(
        0,
        rulerHeight + (107 - average) * rowHeight - (scroll.current.clientHeight || 240) / 2
      );
    }
  };
  const update = (values) => {
    if (disabled) return;
    onChange(
      values.map((item) => {
        const time = Math.max(0, Math.min(clip.duration - 0.001, item.time));
        return {
          ...item,
          time,
          duration: Math.max(0.001, Math.min(item.duration, clip.duration - time)),
        };
      })
    );
  };
  const remove = () => {
    update(clip.notes.filter((_, index) => !chosen.includes(index)));
    setSelection([]);
  };
  const changeSelected = (fields) =>
    update(
      clip.notes.map((item, index) => (chosen.includes(index) ? { ...item, ...fields } : item))
    );
  const duplicate = () => {
    const result = duplicateNotes(clip.notes, chosen, clip.duration, unit);
    if (result.notes === clip.notes)
      setNotice('Not enough space after these notes. Extend the clip first.');
    else {
      update(result.notes);
      setSelection(result.selection);
      setNotice('Notes duplicated.');
    }
  };
  const quantize = () =>
    update(
      quantizeNotes(
        clip.notes,
        chosen.length ? chosen : clip.notes.map((_, i) => i),
        unit,
        clip.duration,
        strength / 100,
        swing / 100
      )
    );
  const page = (direction) => {
    const left = Math.max(
      0,
      Math.min(width + keyWidth - view.width, view.left + direction * pixels * 4)
    );
    if (scroll.current) scroll.current.scrollLeft = left;
    if (velocityScroll.current) velocityScroll.current.scrollLeft = left;
    setView((value) => ({ ...value, left }));
  };
  const add = (pitch, time, bypassSnap = false) => {
    if (disabled) return;
    time = Math.max(0, snapPositions && !bypassSnap ? Math.round(time / unit) * unit : time);
    if (time >= clip.duration) {
      setNotice(
        'That position is beyond this pattern. Increase Pattern length to write more bars.'
      );
      return;
    }
    if (scaleSnap) pitch = snapPitch(pitch, root, scale);
    const created = {
      pitch,
      time,
      duration: Math.min(unit * noteLength, clip.duration - time),
      velocity,
    };
    update([...clip.notes, created]);
    setSelection([clip.notes.length]);
    audition(created);
  };
  const begin = (event, index) => {
    if (disabled || event.button !== 0 || tool === 'erase') return;
    suppressClick.current = false;
    const group = chosen.includes(index) ? chosen : [index];
    drag.current = {
      index,
      group,
      x: event.clientX,
      y: event.clientY,
      notes: clip.notes,
      resize: event.target.dataset.resize === 'true',
      pointer: event.pointerId,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const move = (event) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    const rawDelta = (event.clientX - gesture.x) / zoom;
    const anchor = gesture.notes[gesture.index].time;
    // The grid guides placement; note ends are never quantized. Snapping the
    // grabbed note's absolute onset also works for previously off-grid notes.
    const dt =
      !gesture.resize && snapPositions && !event.altKey
        ? Math.round((anchor + rawDelta) / unit) * unit - anchor
        : rawDelta;
    const dp = -Math.round((event.clientY - gesture.y) / rowHeight);
    if (Math.abs(event.clientX - gesture.x) + Math.abs(event.clientY - gesture.y) < 4) return;
    gesture.moved = true;
    setSelection(gesture.group);
    gesture.next = gesture.resize
      ? gesture.notes.map((item, index) =>
          gesture.group.includes(index)
            ? {
                ...item,
                duration: Math.max(0.001, Math.min(clip.duration - item.time, item.duration + dt)),
              }
            : item
        )
      : moveNotes(gesture.notes, gesture.group, dt, dp, clip.duration);
    if (scaleSnap && !gesture.resize)
      gesture.next = gesture.next.map((n, i) =>
        gesture.group.includes(i) ? { ...n, pitch: snapPitch(n.pitch, root, scale) } : n
      );
    setPreview(gesture.next);
  };
  const end = () => {
    const gesture = drag.current;
    drag.current = null;
    setPreview(null);
    if (gesture?.moved) {
      suppressClick.current = true;
      update(gesture.next);
    }
  };
  const intervals = scale === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const boxPoint = (event) => {
    const rect = surface.current.getBoundingClientRect();
    return {
      x: Math.max(keyWidth, event.clientX - rect.left),
      y: Math.max(rulerHeight, event.clientY - rect.top),
    };
  };
  const selectBox = (event) => {
    if (!boxDrag.current) return;
    const from = boxDrag.current.from,
      to = boxPoint(event);
    const box = {
      left: Math.min(from.x, to.x),
      top: Math.min(from.y, to.y),
      width: Math.abs(to.x - from.x),
      height: Math.abs(to.y - from.y),
    };
    const selected = notesInBox(
      clip.notes,
      (box.left - keyWidth) / zoom,
      (box.left + box.width - keyWidth) / zoom,
      107 - Math.floor((box.top + box.height - rulerHeight) / rowHeight),
      107 - Math.floor((box.top - rulerHeight) / rowHeight)
    );
    setSelection([...new Set([...boxDrag.current.previous, ...selected])]);
    setMarquee(box);
  };
  return (
    <section
      className={`ae-notes ae-notes-modern is-${tool}`}
      aria-label="Piano roll"
      tabIndex={0}
      onKeyDown={(event) => {
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) || disabled) return;
        const command = event.ctrlKey || event.metaKey,
          key = event.key.toLowerCase();
        if (!command && ['b', 'v', 'e', 'f', 'escape'].includes(key)) {
          event.preventDefault();
          event.stopPropagation();
          if (key === 'f') fit();
          else if (key === 'escape') {
            setSelection([]);
            setPreview(null);
            drag.current = null;
          } else setTool({ b: 'draw', v: 'select', e: 'erase' }[key]);
        } else if (command && key === 'a') {
          event.preventDefault();
          event.stopPropagation();
          setSelection(clip.notes.map((_, i) => i));
        } else if (command && key === 'd') {
          event.preventDefault();
          event.stopPropagation();
          duplicate();
        } else if (key === 'delete' || key === 'backspace') {
          event.preventDefault();
          event.stopPropagation();
          remove();
        } else if (
          chosen.length &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          const moved = moveNotes(
            clip.notes,
            chosen,
            (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0) *
              (snapPositions && !event.altKey ? unit : 1 / zoom),
            (event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0) *
              (event.shiftKey ? 12 : 1),
            clip.duration
          );
          update(
            scaleSnap
              ? moved.map((n, i) =>
                  chosen.includes(i)
                    ? {
                        ...n,
                        pitch: snapPitch(
                          n.pitch,
                          root,
                          scale,
                          event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0
                        ),
                      }
                    : n
                )
              : moved
          );
        }
      }}
    >
      <header>
        <div>
          <h4>{clip.name || 'Piano roll'}</h4>
          <small>Instrument clip · included in playback & export</small>
        </div>
        <small>
          {((clip.duration * bpm) / 240).toFixed(2)} bars · {clip.notes.length} notes ·{' '}
          {chosen.length} selected
        </small>
      </header>
      <div className="pr-toolbar" role="toolbar" aria-label="Piano roll tools">
        <div className="pr-tool-group" aria-label="Editing tools">
          {[
            ['draw', Pencil, 'Draw notes', 'B'],
            ['select', MousePointer2, 'Box select', 'V'],
            ['erase', Eraser, 'Erase notes', 'E'],
          ].map(([value, Icon, label, shortcut]) => (
            <button
              type="button"
              key={value}
              aria-label={label}
              title={`${label} (${shortcut})`}
              aria-pressed={tool === value}
              onClick={() => setTool(value)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{value === 'select' ? 'Select' : value === 'draw' ? 'Draw' : 'Erase'}</span>
            </button>
          ))}
        </div>
        <label>
          Octave
          <select
            aria-label="Piano octave"
            value={octave}
            onChange={(event) => setOctave(Number(event.target.value))}
          >
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </label>
        <label>
          Grid
          <select
            aria-label="Note grid"
            value={division}
            onChange={(event) => setDivision(Number(event.target.value))}
          >
            {[1, 2, 4, 8].map((value) => (
              <option value={value} key={value}>
                1/{value * 4}
              </option>
            ))}
            {[3, 6, 12].map((value) => (
              <option value={value} key={value}>
                1/{(value * 8) / 3} triplet
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label="Snap note positions to grid"
          aria-pressed={snapPositions}
          title="Snap note starts when drawing or moving. Alt/Option bypasses snap. Note lengths stay free."
          onClick={() => setSnapPositions(!snapPositions)}
        >
          <Magnet size={16} aria-hidden="true" />
          <span>{snapPositions ? 'Snap on' : 'Snap off'}</span>
        </button>
        <label className="pr-zoom">
          Zoom
          <input
            aria-label="Note zoom"
            type="range"
            min="0.25"
            step="0.25"
            max="384"
            value={pixels}
            onChange={(event) => setPixels(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={fit}
          title="Fit pattern and center notes (F)"
          aria-label="Fit pattern"
        >
          <ScanLine size={16} aria-hidden="true" />
          <span>Fit</span>
        </button>
        <button type="button" onClick={() => page(-1)} disabled={view.left === 0}>
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="pr-sr-only">Earlier notes</span>
        </button>
        <button
          type="button"
          onClick={() => page(1)}
          disabled={view.left + view.width >= width + keyWidth - 1}
        >
          <ChevronRight size={16} aria-hidden="true" />
          <span className="pr-sr-only">Later notes</span>
        </button>
        <button
          type="button"
          onClick={() => setAuditionEnabled(!auditionEnabled)}
          aria-pressed={auditionEnabled}
          aria-label="Audition notes"
          title="Hear notes while editing"
        >
          {auditionEnabled ? (
            <Volume2 size={16} aria-hidden="true" />
          ) : (
            <VolumeX size={16} aria-hidden="true" />
          )}
        </button>
      </div>
      <details className="pr-context-controls" open={compact ? undefined : true}>
        <summary>Selection, velocity & quantize</summary>
        <div className="pr-context-content">
          <div className="pr-edit-bar">
            <span className="pr-selection">
              {chosen.length ? `${chosen.length} selected` : `${clip.notes.length} notes`}
            </span>
            <button
              type="button"
              disabled={disabled || !clip.notes.length}
              onClick={() => setSelection(clip.notes.map((_, i) => i))}
            >
              <CheckCheck size={14} aria-hidden="true" />
              <span>Select all notes</span>
            </button>
            <button type="button" disabled={disabled || !chosen.length} onClick={duplicate}>
              <Copy size={14} aria-hidden="true" />
              <span>Duplicate notes</span>
            </button>
            <button type="button" disabled={disabled || !chosen.length} onClick={remove}>
              <Trash2 size={14} aria-hidden="true" />
              <span>Delete note{chosen.length === 1 ? '' : 's'}</span>
            </button>
            <button
              type="button"
              disabled={disabled || !clip.notes.length}
              onClick={quantize}
              aria-label="Quantize notes"
            >
              <Wand2 size={14} aria-hidden="true" />
              <span>Quantize</span>
            </button>
          </div>
          <details className="ae-note-options">
            <summary>Note creation, scale & quantize</summary>
            <div className="ae-fields">
              <label>
                New note length (steps)
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={noteLength}
                  onChange={(e) => setNoteLength(Math.max(1, Math.min(32, Number(e.target.value))))}
                />
              </label>
              <label>
                New note velocity
                <input
                  type="number"
                  min="1"
                  max="127"
                  value={Math.round(velocity * 127)}
                  onChange={(e) =>
                    setVelocity(Math.max(1, Math.min(127, Number(e.target.value))) / 127)
                  }
                />
              </label>
              <label>
                Scale root
                <select value={root} onChange={(e) => setRoot(e.target.value)}>
                  <option value="off">Off</option>
                  {pitches
                    .slice(-12)
                    .reverse()
                    .map((pitch, i) => (
                      <option key={pitch} value={i}>
                        {pitch.slice(0, -1)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Scale
                <select value={scale} onChange={(e) => setScale(e.target.value)}>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={scaleSnap}
                  onChange={(e) => setScaleSnap(e.target.checked)}
                />
                Snap new/moved notes to scale
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showGhosts}
                  onChange={(e) => setShowGhosts(e.target.checked)}
                />
                Ghost notes from other clips
              </label>
              <button
                type="button"
                disabled={disabled || root === 'off' || !chosen.length}
                onClick={() =>
                  update(
                    clip.notes.map((n, i) =>
                      chosen.includes(i) ? { ...n, pitch: snapPitch(n.pitch, root, scale) } : n
                    )
                  )
                }
              >
                Snap selection to scale
              </button>
              <label>
                Quantize strength (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={strength}
                  onChange={(e) => setStrength(Math.max(0, Math.min(100, Number(e.target.value))))}
                />
              </label>
              <label>
                Swing (%)
                <input
                  type="number"
                  min="0"
                  max="66"
                  value={swing}
                  onChange={(e) => setSwing(Math.max(0, Math.min(66, Number(e.target.value))))}
                />
              </label>
              <button
                type="button"
                disabled={disabled || !clip.notes.length}
                onClick={() => {
                  update([]);
                  setSelection([]);
                }}
              >
                Clear piano notes
              </button>
            </div>
          </details>
        </div>
      </details>
      <p className="ae-note-help">
        Draw to add; Box select to drag a selection. Shift adds to selection. Drag notes to move,
        right edge to resize freely. Grid lines are a guide; enable Snap for note starts only.
        Alt/Option bypasses Snap. Click a note to hear its velocity and length.
      </p>
      <div
        className="ae-note-scroll"
        tabIndex={0}
        role="region"
        aria-label="Piano notes, scroll to change pitch or time"
        ref={scroll}
        onScroll={(event) => {
          setView({
            left: event.currentTarget.scrollLeft,
            width: event.currentTarget.clientWidth || 1000,
            top: event.currentTarget.scrollTop,
            height: event.currentTarget.clientHeight || 240,
          });
          if (velocityScroll.current)
            velocityScroll.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <div
          className="ae-note-surface"
          ref={surface}
          style={{
            width: width + keyWidth,
            '--note-grid': `${zoom * unit}px`,
            '--note-beat': `${pixels}px`,
            '--note-bar': `${pixels * 4}px`,
          }}
          onPointerDown={(event) => {
            if (
              disabled ||
              tool !== 'select' ||
              event.button !== 0 ||
              !event.target.classList.contains('ae-note-grid')
            )
              return;
            boxDrag.current = { from: boxPoint(event), previous: event.shiftKey ? chosen : [] };
            event.currentTarget.setPointerCapture?.(event.pointerId);
            selectBox(event);
          }}
          onPointerMove={selectBox}
          onPointerUp={() => {
            if (boxDrag.current) suppressClick.current = true;
            boxDrag.current = null;
            setMarquee(null);
          }}
          onPointerCancel={() => {
            if (boxDrag.current) setSelection(boxDrag.current.previous);
            boxDrag.current = null;
            setMarquee(null);
          }}
        >
          <div className="ae-note-ruler" aria-label="Piano roll bars">
            <b className="pr-ruler-corner">
              {tool === 'select' ? 'SELECT' : tool === 'erase' ? 'ERASE' : 'DRAW'}
            </b>
            {Array.from(
              { length: Math.ceil(view.width / (pixels * rulerStep)) + 2 },
              (_, i) => (Math.floor(view.left / (pixels * rulerStep)) + i) * rulerStep
            )
              .filter((beat) => (beat * 60) / bpm < clip.duration)
              .map((beat) => (
                <span key={beat} style={{ left: keyWidth + beat * pixels }}>
                  {beat % 4 === 0 ? beat / 4 + 1 : `${Math.floor(beat / 4) + 1}.${(beat % 4) + 1}`}
                </span>
              ))}
          </div>
          <div aria-hidden="true" style={{ height: firstRow * rowHeight, flexShrink: 0 }} />
          {pitches.slice(firstRow, lastRow).map((pitch) => (
            <div
              key={pitch}
              className={`ae-note-row ${pitch.includes('#') ? 'is-black' : ''} ${pitch.startsWith('C') && !pitch.includes('#') ? 'is-octave' : ''} ${root !== 'off' && intervals.includes((noteNumber(pitch) - Number(root) + 120) % 12) ? 'in-scale' : ''}`}
            >
              <div className={`pr-key-slot ${pitch.includes('#') ? 'is-black' : ''}`}>
                <button
                  type="button"
                  className={`ae-key ${pitch.includes('#') ? 'is-black' : ''}`}
                  onClick={() =>
                    audition({
                      pitch,
                      time: note?.time || 0,
                      duration: note?.duration || Math.min(unit * noteLength, clip.duration),
                      velocity: note?.velocity ?? velocity,
                    })
                  }
                  disabled={disabled}
                  aria-label={`Audition ${pitch}`}
                  style={
                    keyGeometry.has(pitch)
                      ? { top: keyGeometry.get(pitch).top, height: keyGeometry.get(pitch).height }
                      : undefined
                  }
                >
                  <span
                    style={
                      keyGeometry.has(pitch) ? { top: keyGeometry.get(pitch).label } : undefined
                    }
                  >
                    {pitch.replace('#', '♯')}
                  </span>
                </button>
              </div>
              <div className="ae-note-cells" style={{ width }}>
                <button
                  type="button"
                  className="ae-note-grid"
                  aria-label={`Add ${pitch} note`}
                  disabled={disabled}
                  onClick={(event) => {
                    if (tool !== 'draw') return;
                    const box = event.currentTarget.getBoundingClientRect();
                    add(
                      pitch,
                      event.detail === 0 ? view.left / zoom : (event.clientX - box.left) / zoom,
                      event.altKey
                    );
                  }}
                />
                {showGhosts &&
                  (ghostRows.get(pitch) || []).map((n, i) => (
                    <span
                      aria-hidden="true"
                      className="ae-ghost-note"
                      key={i}
                      style={{ left: n.time * zoom, width: Math.max(3, n.duration * zoom) }}
                    />
                  ))}
                {(rows.get(pitch) || []).map(({ item, index }) => (
                  <button
                    type="button"
                    key={index}
                    className={`ae-midi-note ${chosen.includes(index) ? 'is-selected' : ''}`}
                    aria-label={`Select ${item.pitch} note ${index + 1}`}
                    aria-pressed={chosen.includes(index)}
                    disabled={disabled}
                    style={{
                      left: (preview?.[index] || item).time * zoom,
                      width: Math.max(5, (preview?.[index] || item).duration * zoom),
                      opacity: 0.5 + item.velocity * 0.5,
                      transform: `translateY(${(noteNumber(item.pitch) - noteNumber((preview?.[index] || item).pitch)) * rowHeight}px)`,
                      zIndex: preview && chosen.includes(index) ? 5 : 2,
                    }}
                    onClick={(event) => {
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      if (tool === 'erase') {
                        update(clip.notes.filter((_, i) => i !== index));
                        setSelection([]);
                        return;
                      }
                      setSelection(
                        event.shiftKey
                          ? chosen.includes(index)
                            ? chosen.filter((i) => i !== index)
                            : [...chosen, index]
                          : [index]
                      );
                      if (!event.shiftKey) audition(item);
                    }}
                    onPointerDown={(event) => begin(event, index)}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={() => {
                      drag.current = null;
                      setPreview(null);
                    }}
                  >
                    <span className="pr-note-name">
                      {(preview?.[index] || item).pitch.replace('#', '♯')}
                    </span>
                    <span
                      className="ae-note-end"
                      data-resize="true"
                      title="Drag freely to change note length"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div
            aria-hidden="true"
            style={{ height: (pitches.length - lastRow) * rowHeight, flexShrink: 0 }}
          />
          {marquee && <div className="ae-note-marquee" style={marquee} />}
          {width > clip.duration * zoom && (
            <div
              className="pr-outside-clip"
              aria-hidden="true"
              style={{ left: keyWidth + clip.duration * zoom, width: width - clip.duration * zoom }}
            />
          )}
          {(positionRef || (playhead !== null && playhead >= 0 && playhead < clip.duration)) && (
            <div
              ref={playheadElement}
              className="pr-playhead"
              aria-hidden="true"
              hidden={playhead === null || playhead < 0 || playhead >= clip.duration}
              style={{ left: keyWidth + playhead * zoom }}
            />
          )}
        </div>
      </div>
      <div
        className="ae-velocity-lane"
        aria-label="Note velocities"
        ref={velocityScroll}
        onScroll={(event) => {
          if (scroll.current) scroll.current.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <div
          className="ae-velocity-surface"
          style={{ width: width + keyWidth, '--note-beat': `${pixels}px` }}
        >
          <span className="ae-velocity-label">Velocity</span>
          {[...rows.values()]
            .flat()
            .sort((a, b) => a.item.time - b.item.time)
            .map(({ item, index }) => (
              <label
                key={index}
                className={chosen.includes(index) ? 'is-selected' : ''}
                title={`${item.pitch} · ${Math.round(item.velocity * 127)}`}
                style={{
                  left: keyWidth + item.time * zoom,
                  '--velocity-height': `${item.velocity * 100}%`,
                }}
              >
                <span className="pr-velocity-bar" aria-hidden="true" />
                <input
                  aria-label={`Velocity note ${index + 1}`}
                  type="range"
                  min="1"
                  max="127"
                  value={Math.round(item.velocity * 127)}
                  disabled={disabled}
                  onChange={(event) =>
                    update(
                      clip.notes.map((n, i) =>
                        i === index ? { ...n, velocity: Number(event.target.value) / 127 } : n
                      )
                    )
                  }
                />
              </label>
            ))}
        </div>
      </div>
      {note && (
        <details className="ae-note-properties">
          <summary>Selected note properties · {chosen.length} selected</summary>
          <div className="ae-fields">
            {chosen.length === 1 && (
              <>
                <label>
                  Note pitch
                  <select
                    disabled={disabled}
                    value={note.pitch}
                    onChange={(e) => changeSelected({ pitch: e.target.value })}
                  >
                    {[...pitches].reverse().map((pitch) => (
                      <option key={pitch}>{pitch}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Note start (s)
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={clip.duration - note.duration}
                    value={note.time}
                    disabled={disabled}
                    onChange={(e) => changeSelected({ time: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Note duration (s)
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    max={clip.duration - note.time}
                    value={note.duration}
                    disabled={disabled}
                    onChange={(e) => changeSelected({ duration: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
            <label>
              {chosen.length > 1 ? 'Selected notes velocity' : 'Note velocity'}
              <input
                type="number"
                min="1"
                max="127"
                value={Math.round(note.velocity * 127)}
                disabled={disabled}
                onChange={(e) =>
                  changeSelected({
                    velocity: Math.max(1, Math.min(127, Number(e.target.value))) / 127,
                  })
                }
              />
            </label>
          </div>
        </details>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
