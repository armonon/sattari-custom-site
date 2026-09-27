import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { clipWaveform, resizeClip, trimClipStart } from '../../utils/arrangementModel';
import { cancelOnEscape } from './interactions';

const waveformPoints = (clip) =>
  clipWaveform(clip)
    .map(
      (value, i, array) =>
        `${(i / Math.max(1, array.length - 1)) * 100},${10 - Math.min(10, Math.abs(value) / 10)}`
    )
    .join(' ');

/**
 * One clip on a lane. A move or trim drag previews locally and reports a
 * single result on release; pointercancel or Escape drops the preview, so the
 * project is never touched until the gesture completes.
 */
function TimelineClip({
  clip,
  trackId,
  color,
  row,
  zoom,
  selected,
  busy,
  snapped,
  suppressClick,
  moving,
  onGesture,
  onCommit,
  onSelect,
}) {
  const [preview, setPreview] = useState(null);
  const gesture = useRef(null);
  const points = useMemo(() => (clip.waveform ? waveformPoints(clip) : ''), [clip]);
  useEffect(() => () => gesture.current?.stopEscape(), []);
  const cancel = () => {
    const value = gesture.current;
    gesture.current = null;
    value?.stopEscape();
    setPreview(null);
    if (value?.preview) onGesture(null);
  };
  const shown = preview || clip;
  return (
    <button
      type="button"
      draggable={false}
      onPointerDown={(event) => {
        if (busy || event.button !== 0) return;
        gesture.current?.stopEscape();
        const element = event.currentTarget,
          pointerId = event.pointerId;
        gesture.current = {
          origin: clip,
          kind: event.target.dataset.clipHandle || 'move',
          x: event.clientX,
          y: event.clientY,
          preview: null,
          stopEscape: cancelOnEscape(() => {
            cancel();
            if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
          }),
        };
        element.setPointerCapture?.(pointerId);
      }}
      onPointerMove={(event) => {
        const value = gesture.current;
        if (!value || Math.hypot(event.clientX - value.x, event.clientY - value.y) < 4) return;
        const delta = (event.clientX - value.x) / zoom,
          origin = value.origin;
        const next =
          value.kind === 'end'
            ? resizeClip(origin, Math.max(0.01, snapped(origin.duration + delta)))
            : value.kind === 'start'
              ? trimClipStart(origin, snapped(origin.start + delta))
              : { ...origin, start: Math.max(0, snapped(origin.start + delta)) };
        if (!value.preview) onGesture(origin.id);
        value.preview = next;
        setPreview(next);
      }}
      onPointerCancel={cancel}
      onPointerUp={(event) => {
        const value = gesture.current;
        gesture.current = null;
        value?.stopEscape();
        if (!value?.preview) return;
        suppressClick.current = true;
        const destination =
          document.elementFromPoint?.(event.clientX, event.clientY)?.closest('[data-track-id]')
            ?.dataset.trackId || trackId;
        onCommit({
          kind: value.kind,
          origin: value.origin,
          next: value.preview,
          trackId,
          destination,
        });
        setPreview(null);
        onGesture(null);
      }}
      onDragStart={(event) => {
        moving.current = clip.id;
        event.dataTransfer.setData('text/plain', clip.id);
      }}
      onDragEnd={() => {
        moving.current = null;
      }}
      onClick={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onSelect(clip.id, event.shiftKey);
      }}
      aria-pressed={selected}
      aria-label={`Select clip ${clip.name}`}
      title={`${clip.name} · ${clip.start.toFixed(2)}s · ${clip.duration.toFixed(2)}s long`}
      className={`ae-clip ${clip.kind}`}
      style={{
        left: shown.start * zoom,
        width: Math.max(2, shown.duration * zoom),
        top: 6 + row * 58,
        borderColor: color,
      }}
    >
      <span className="ae-trim is-start" data-clip-handle="start" title="Drag to trim start" />
      <span className="ae-trim is-end" data-clip-handle="end" title="Drag to trim end" />
      <strong>{clip.name}</strong>
      <small>
        {clip.kind === 'midi' ? `${clip.notes.length} notes` : `${clip.duration.toFixed(2)}s`}
      </small>
      {clip.waveform && (
        <svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={points} />
        </svg>
      )}
    </button>
  );
}

export default memo(TimelineClip);
