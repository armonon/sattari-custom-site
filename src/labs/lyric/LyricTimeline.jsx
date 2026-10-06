import { useRef } from 'react';
import { LabWaveform } from '../audio/AudioLabParts';

/**
 * A simple horizontal timeline: a waveform backdrop plus one draggable marker
 * per word, positioned by `word.start / duration`. Dragging a marker nudges
 * that word's start time; clicking selects it (for the nudge buttons).
 * Deliberately not waveform-synced beyond the backdrop -- good enough for
 * coarse timing fixes, not a full editor.
 */
export default function LyricTimeline({
  lines,
  duration,
  peaks,
  currentTime,
  selected,
  onSelect,
  onNudge,
}) {
  const trackRef = useRef(null);

  const startDrag = (line, word, event) => {
    event.preventDefault();
    onSelect(line.id, word.id);
    const track = trackRef.current;
    if (!track || !duration) return;
    const rect = track.getBoundingClientRect();
    const originalStart = word.start;
    const linesSnapshot = lines;
    const move = (moveEvent) => {
      const x = Math.min(rect.width, Math.max(0, moveEvent.clientX - rect.left));
      const desiredStart = (x / rect.width) * duration;
      onNudge(linesSnapshot, line.id, word.id, desiredStart - originalStart);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const safeDuration = duration > 0 ? duration : 1;

  return (
    <div className="lyric-timeline" ref={trackRef}>
      {peaks && <LabWaveform peaks={peaks} color="#5c6773" height={40} />}
      <div
        className="lyric-timeline-playhead"
        style={{ left: `${Math.min(100, (currentTime / safeDuration) * 100)}%` }}
        aria-hidden="true"
      />
      {lines.flatMap((line) =>
        line.words.map((word) => (
          <button
            key={word.id}
            type="button"
            className={`lyric-timeline-mark${!word.matched ? ' is-interpolated' : ''}${
              selected?.wordId === word.id && selected?.lineId === line.id ? ' is-selected' : ''
            }`}
            style={{ left: `${Math.min(100, Math.max(0, (word.start / safeDuration) * 100))}%` }}
            title={`${word.text} @ ${word.start.toFixed(2)}s${word.matched ? '' : ' (interpolated)'}`}
            onPointerDown={(event) => startDrag(line, word, event)}
            onClick={() => onSelect(line.id, word.id)}
          >
            <span className="sr-only">{word.text}</span>
          </button>
        ))
      )}
    </div>
  );
}
