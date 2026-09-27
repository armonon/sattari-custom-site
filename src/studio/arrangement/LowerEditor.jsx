// Import order fixes stylesheet order: notes, sequencer, then panel/rack.
import InstrumentDock from './InstrumentDock';
import SequencerPanel from './SequencerPanel';
import ArrangementRack from '../../components/studio/ArrangementRack';
import TrackAutomation from '../../components/studio/TrackAutomation';
import ClipInspector from './ClipInspector';
import EditorTabs from './EditorTabs';
import PerformancePanel from './PerformancePanel';

/** Tabs, resize divider and the context editor shown below the timeline. */
export default function LowerEditor({
  lower,
  visible,
  project,
  selected,
  selectedTrack,
  projectEnd,
  busy,
  ready,
  playing,
  hasClips,
  cursor,
  position,
  bpm,
  activeReplay,
  inspector,
  commands,
}) {
  const { pianoOpen, lowerEditor, editorHeight } = lower;
  const panel = !pianoOpen && lowerEditor;
  const automationTrack =
    project.tracks.find((track) => track.id === lower.rackTrack) ||
    selectedTrack ||
    project.tracks[0];
  return (
    <>
      <EditorTabs
        pianoOpen={pianoOpen}
        lowerEditor={lowerEditor}
        hasSelection={!!selected}
        editorHeight={editorHeight}
        commands={commands}
      />
      <div
        hidden={!pianoOpen && lowerEditor === 'closed'}
        className="ae-lower-editor"
        style={{ '--editor-height': `${editorHeight}px` }}
      >
        <header className="ae-mobile-editor-nav" role="group" aria-label="Editor navigation">
          <button type="button" onClick={commands.closeEditor}>
            ← Arrangement
          </button>
          <strong>{pianoOpen ? 'MIDI' : lowerEditor}</strong>
          <button
            type="button"
            disabled={busy || !hasClips}
            onClick={commands.toggle}
            aria-label={playing ? 'Pause arrangement in editor' : 'Play arrangement in editor'}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        </header>
        {visible && panel === 'performance' && (
          <PerformancePanel
            captures={project.captures}
            captureSelection={lower.captureSelection}
            busy={busy}
            activeReplay={activeReplay}
            commands={commands}
          />
        )}
        {visible && panel === 'sequencer' && (
          <SequencerPanel
            tracks={project.tracks}
            selected={selected}
            busy={busy}
            ready={ready}
            playing={playing}
            bpm={bpm}
            position={position}
            commands={commands}
          />
        )}
        <div hidden={panel !== 'devices'}>
          <ArrangementRack
            revealToken={lower.rackReveal}
            tracks={project.tracks}
            selectedTrackId={lower.rackTrack || selectedTrack?.id}
            busy={busy || !ready}
            onSelectTrack={lower.setRackTrack}
            onInstrument={commands.addMidi}
            onEditInstrument={commands.editInstrument}
            onEffects={commands.changeEffects}
          />
        </div>
        {panel === 'automation' && automationTrack && (
          <TrackAutomation
            track={automationTrack}
            duration={Math.max(8, projectEnd)}
            disabled={busy}
            onChange={(automation) => commands.automateTrack(automationTrack.id, automation)}
          />
        )}
        {selected && panel === 'clip' && (
          <ClipInspector
            selected={selected}
            selectedTrack={selectedTrack}
            busy={busy}
            cursor={cursor}
            state={inspector}
            commands={commands}
          />
        )}
        {visible && pianoOpen && (
          <InstrumentDock
            project={project}
            selected={selected}
            selectedTrack={selectedTrack}
            bpm={bpm}
            busy={busy}
            cursor={cursor}
            playing={playing}
            position={position}
            editorHeight={editorHeight}
            expanded={lower.pianoExpanded}
            commands={commands}
          />
        )}
      </div>
    </>
  );
}
