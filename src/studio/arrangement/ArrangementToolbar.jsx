import { memo } from 'react';
import {
  Crosshair,
  Maximize2,
  Pause,
  Piano,
  Play,
  Plus,
  SlidersHorizontal,
  Square,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import StudioAction from '../../components/studio/StudioAction';

/** Transport, source actions and the timeline navigation strip. */
function ArrangementToolbar({
  trackCount,
  bpm,
  playing,
  busy,
  ready,
  hasClips,
  pianoOpen,
  sequencerOpen,
  canCopyDecks,
  cursor,
  zoom,
  canFitSelection,
  follow,
  commands,
}) {
  return (
    <>
      <header className="ae-main-header">
        <div>
          <h3>Arrangement</h3>
          <small>
            {trackCount} tracks · {bpm} BPM · 4/4
          </small>
        </div>
        <div className="ae-actions" role="group" aria-label="Arrangement actions">
          <StudioAction
            type="button"
            className="ae-play-button"
            icon={playing ? Pause : Play}
            label={playing ? 'Pause' : 'Play'}
            onClick={commands.toggle}
            disabled={busy || !hasClips}
            aria-label={playing ? 'Pause arrangement' : 'Play arrangement'}
          />
          <StudioAction
            type="button"
            icon={Square}
            label="Stop"
            onClick={commands.stop}
            disabled={busy}
          />
          <StudioAction
            type="button"
            icon={Upload}
            label="Import audio"
            onClick={commands.chooseAudio}
            disabled={busy}
          />
          <StudioAction
            type="button"
            icon={Plus}
            label="Add audio track"
            onClick={commands.addAudioTrack}
            disabled={busy}
          />
          <StudioAction
            icon={Piano}
            label="Add instrument"
            onClick={commands.addMidi}
            disabled={busy}
          />
          <StudioAction icon={SlidersHorizontal} label="Effects rack" onClick={commands.showRack} />
          <button
            type="button"
            aria-expanded={pianoOpen}
            aria-controls="arrangement-piano-dock"
            onClick={commands.togglePiano}
          >
            Piano roll
          </button>
          <button
            type="button"
            disabled={busy || !ready}
            aria-pressed={sequencerOpen}
            onClick={commands.openSequencer}
          >
            Beat sequencer
          </button>
          <details className="ae-more-sources">
            <summary>More sources</summary>
            <div>
              <button type="button" disabled={busy} onClick={commands.chooseMidi}>
                Import MIDI
              </button>
              <button
                type="button"
                disabled={busy || !canCopyDecks}
                onClick={commands.copyDeckAudio}
              >
                Copy deck audio
              </button>
            </div>
          </details>
        </div>
      </header>
      <div className="ae-navigation" aria-label="Timeline navigation">
        <div className="ae-time-display">
          <span>POSITION</span>
          <output aria-label="Playhead bars and beats">
            {Math.floor((cursor * bpm) / 240) + 1}
            <em> : </em>
            {(Math.floor((cursor * bpm) / 60) % 4) + 1}
          </output>
          <small>
            {Math.floor(cursor / 60)}:{(cursor % 60).toFixed(1).padStart(4, '0')}
          </small>
        </div>
        <div className="ae-zoom-controls" role="group" aria-label="Timeline zoom controls">
          <button
            type="button"
            aria-label="Zoom out timeline"
            title="Zoom out (−)"
            disabled={zoom <= 0.1}
            onClick={() => commands.changeZoom(zoom / 1.5)}
          >
            <ZoomOut size={17} aria-hidden="true" />
          </button>
          <input
            type="range"
            aria-label="Timeline zoom"
            aria-valuetext={`${Math.round((zoom / 40) * 100)} percent`}
            min={Math.log2(0.1)}
            max={Math.log2(400)}
            step="0.05"
            value={Math.log2(zoom)}
            onChange={(event) => commands.changeZoom(2 ** Number(event.target.value))}
          />
          <button
            type="button"
            aria-label="Zoom in timeline"
            title="Zoom in (+)"
            disabled={zoom >= 400}
            onClick={() => commands.changeZoom(zoom * 1.5)}
          >
            <ZoomIn size={17} aria-hidden="true" />
          </button>
          <StudioAction
            type="button"
            onClick={() => commands.fitTimeline()}
            title="Show the whole arrangement (F)"
            icon={Maximize2}
            label="Fit project"
          />
          <StudioAction
            icon={Crosshair}
            label="Fit selection"
            disabled={!canFitSelection}
            onClick={() => commands.fitTimeline(true)}
          />
        </div>
        <button type="button" aria-pressed={follow} onClick={commands.toggleFollow}>
          Follow playhead
        </button>
      </div>
    </>
  );
}

export default memo(ArrangementToolbar);
