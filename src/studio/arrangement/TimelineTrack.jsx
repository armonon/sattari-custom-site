import { memo, useMemo } from 'react';
import { clipRows } from '../../utils/arrangementModel';
import TimelineClip from './TimelineClip';
import TrackHeader from './TrackHeader';

const OVERSCAN = 240;

/** A track row: its header and a lane that renders only the clips near the viewport. */
function TimelineTrack({
  track,
  first,
  last,
  zoom,
  width,
  gridPixels,
  view,
  selection,
  activeClipId,
  busy,
  snapped,
  suppressClick,
  moving,
  onGesture,
  commands,
}) {
  const layout = useMemo(() => clipRows(track.clips), [track.clips]);
  const at = (event) => (event.clientX - event.currentTarget.getBoundingClientRect().left) / zoom;
  return (
    <div className="ae-track">
      <TrackHeader track={track} first={first} last={last} busy={busy} commands={commands} />
      <div
        className="ae-lane"
        data-track-id={track.id}
        onDoubleClick={(event) => {
          if (busy || track.kind !== 'midi' || event.target.closest('.ae-clip')) return;
          commands.addMidiPattern(track.id, snapped(at(event)));
        }}
        style={{
          width,
          minHeight: Math.max(96, layout.count * 58 + 12),
          '--ae-grid': `${gridPixels}px`,
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          commands.dropOnLane(track.id, Math.max(0, snapped(at(event))), event.dataTransfer);
        }}
      >
        {track.clips
          .filter(
            (clip) =>
              clip.id === activeClipId ||
              ((clip.start + clip.duration) * zoom >= view.left - OVERSCAN &&
                clip.start * zoom <= view.left + view.width + OVERSCAN)
          )
          .map((clip) => (
            <TimelineClip
              key={clip.id}
              clip={clip}
              trackId={track.id}
              color={track.color}
              row={layout.rows.get(clip.id)}
              zoom={zoom}
              selected={selection.includes(clip.id)}
              busy={busy}
              snapped={snapped}
              suppressClick={suppressClick}
              moving={moving}
              onGesture={onGesture}
              onCommit={commands.commitClipGesture}
              onSelect={commands.selectClip}
            />
          ))}
        <div className="ae-playhead" style={{ left: 'var(--ae-playhead-x)' }} />
      </div>
    </div>
  );
}

export default memo(TimelineTrack);
