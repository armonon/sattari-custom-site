// LowerEditor comes first: its import order fixes the notes → sequencer → rack
// stylesheet order, which must precede the editor's own stylesheets.
import LowerEditor from '../../studio/arrangement/LowerEditor';
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { rackTail } from '../../utils/arrangementEffects';
import { droppedLibraryFiles } from '../../utils/musicLibrary';
import {
  arrangementDuration,
  audioTrack,
  migrateArrangement,
  moveClips,
  retimeMidi,
  updatePatternClip,
} from '../../utils/arrangementModel';
import * as edits from '../../studio/arrangement/projectEdits';
import { beginSliderTransaction, handleEditorKey } from '../../studio/arrangement/interactions';
import { useArrangementHistory } from '../../studio/arrangement/useArrangementHistory';
import { useArrangementOperations } from '../../studio/arrangement/useArrangementOperations';
import {
  useArrangementPlayback,
  useOperationFlags,
} from '../../studio/arrangement/useArrangementPlayback';
import { useLowerEditor } from '../../studio/arrangement/useLowerEditor';
import { useStableActions } from '../../studio/arrangement/useStableCallback';
import { useTimelineZoom } from '../../studio/arrangement/useTimelineZoom';
import ArrangementToolbar from '../../studio/arrangement/ArrangementToolbar';
import { useInspectorState } from '../../studio/arrangement/ClipInspector';
import EditExportPanel from '../../studio/arrangement/EditExportPanel';
import ExportRangePanel, { useExportSettings } from '../../studio/arrangement/ExportRangePanel';
import LoopPanel from '../../studio/arrangement/LoopPanel';
import { RecordedTakes, SourceInputs } from '../../studio/arrangement/Sources';
import Timeline from '../../studio/arrangement/Timeline';
import './ArrangementEditor.css';
import './ArrangementWorkspace.css';

const WELCOME = 'Import audio, add an instrument, or copy deck audio into independent tracks.';
const NO_RECORDINGS = [];

function ArrangementEditor(
  {
    project,
    onChange,
    getEngine,
    bpm,
    master,
    decks,
    visible,
    onBusy,
    onPlaying,
    ready = true,
    recordings = NO_RECORDINGS,
  },
  ref
) {
  const [selection, setSelection] = useState(null),
    [chosen, setChosen] = useState([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(WELCOME);
  const [snap, setSnap] = useState(true),
    [grid, setGrid] = useState(4),
    [follow, setFollow] = useState(true),
    [mobileTools, setMobileTools] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false),
    [loopStart, setLoopStart] = useState(0),
    [loopEnd, setLoopEnd] = useState(8),
    [midiCaptureActive, setMidiCaptureActive] = useState(false);
  const flags = useOperationFlags(),
    { working } = flags;
  // The latest project known to the editor, which may be ahead of the prop.
  const current = useRef(project),
    scroll = useRef(null),
    priorTempo = useRef(bpm),
    clipboard = useRef([]),
    suppressClipClick = useRef(false),
    moving = useRef(null),
    sliderGesture = useRef(null);
  const exportTools = useRef(null),
    audioInput = useRef(null),
    midiInput = useRef(null),
    relinkInput = useRef(null),
    relinkTarget = useRef(null),
    importTarget = useRef(null);
  const reportError = useCallback((error) => setMessage(error.message), []);
  const view = useTimelineZoom({ scroll, bpm }),
    { zoom } = view;
  const loop = useMemo(
    () => ({ enabled: loopEnabled, start: loopStart, end: loopEnd }),
    [loopEnabled, loopStart, loopEnd]
  );
  const playback = useArrangementPlayback({
    getEngine,
    master,
    ready,
    visible,
    follow,
    zoom,
    scroll,
    project: current,
    loop,
    flags,
    onBusy,
    onPlaying,
    setBusy,
    setMessage,
  });
  const { cursor, playing, position, pause, getPosition } = playback;
  const [history, historyStatus] = useArrangementHistory(project, current, {
    onChange,
    sync: playback.syncPlayback,
    onError: reportError,
  });
  const exportSettings = useExportSettings();
  const inspector = useInspectorState(selection);
  const [selectedTrack, selected] = useMemo(() => {
    const track = project.tracks.find((row) => row.clips.some((clip) => clip.id === selection));
    return [track, track?.clips.find((clip) => clip.id === selection)];
  }, [project.tracks, selection]);
  const selectionIds = useMemo(
    () =>
      (chosen.length ? chosen : selection ? [selection] : []).filter((id) =>
        project.tracks.some((track) => track.clips.some((clip) => clip.id === id))
      ),
    [chosen, selection, project.tracks]
  );
  const lower = useLowerEditor({ selection, selected, selectedTrackId: selectedTrack?.id });
  const projectEnd = useMemo(() => arrangementDuration(project), [project]);
  const hasClips = project.tracks.some((track) => track.clips.length);

  // Every editor edit funnels through here. During a slider drag it joins the
  // drag's transaction; a drag cancelled with Escape ignores the rest of it.
  const edit = (change, options = {}) => {
    if (working.current || !ready || sliderGesture.current?.cancelled) return false;
    const next = typeof change === 'function' ? change(current.current) : change;
    return history.commit(next, sliderGesture.current ? { ...options, live: true } : options);
  };
  const changeTrack = (id, updates, mixOnly = false) =>
    edit((next) => edits.updateTrack(next, id, updates), { mix: true, mixOnly });
  const changeClip = (updates) =>
    edit((next) =>
      updatePatternClip(next, selection, {
        ...updates,
        ...('fadeIn' in updates && !('fadeInCurve' in updates) ? { fadeInCurve: undefined } : {}),
        ...('fadeOut' in updates && !('fadeOutCurve' in updates)
          ? { fadeOutCurve: undefined }
          : {}),
      })
    );
  const select = (id) => {
    setSelection(id);
    setChosen([id]);
  };
  const addMidi = (instrument = 'piano') => {
    if (typeof instrument !== 'string') instrument = 'piano';
    if (instrument !== 'drums') lower.setPianoOpen(true);
    const track = edits.instrumentTrack(instrument, bpm, position.current);
    edit((next) => edits.appendTracks(next, [track]));
    select(track.clips[0].id);
  };
  const addMidiPattern = (trackId, at = position.current) => {
    const track = project.tracks.find((row) => row.id === trackId);
    const clip = edits.instrumentPattern(track, bpm, at);
    edit((next) => edits.appendClip(next, trackId, clip));
    select(clip.id);
  };
  const openSequencer = () => {
    lower.setLowerEditor('sequencer');
    lower.setPianoOpen(false);
    if (selected?.kind === 'midi' && selected.instrument === 'drums') return;
    const drum = project.tracks
      .flatMap((track) => track.clips)
      .find((clip) => clip.kind === 'midi' && clip.instrument === 'drums');
    if (drum) select(drum.id);
    else addMidi('drums');
  };
  const deleteClips = () => {
    edit((next) => edits.removeClips(next, selectionIds));
    setSelection(null);
    setChosen([]);
  };
  const operations = useArrangementOperations({
    history,
    playback,
    flags,
    ready,
    busy,
    bpm,
    getEngine,
    onBusy,
    setBusy,
    setMessage,
    edit,
    exportSettings,
  });
  const actions = useStableActions({
    edit,
    getProject: () => current.current,
    setMessage,
    select,
    changeTrack,
    changeClip,
    changeNotes: (notes) => changeClip({ notes }),
    addMidi,
    addMidiPattern,
    openSequencer,
    deleteClips,
    toggle: playback.toggle,
    pause,
    stop: playback.stop,
    seek: playback.seek,
    cancelOperation: playback.cancelOperation,
    exportAudio: operations.exportAudio,
    replay: operations.replay,
    stopReplay: operations.stopReplay,
    loadSample: operations.loadSample,
    importFiles: (files) => operations.addFiles(Promise.resolve(files.map((file) => ({ file })))),
    setMobileTools,
    setGrid,
    setEditorHeight: lower.setEditorHeight,
    setCaptureSelection: lower.setCaptureSelection,
    showRack: lower.showRack,
    closeEditor: lower.close,
    openPerformance: lower.openPerformance,
    showEditor: (id) => (id === 'sequencer' ? openSequencer() : lower.show(id)),
    toggleExpanded: () => lower.setPianoExpanded(!lower.pianoExpanded),
    openPiano: () => lower.setPianoOpen(true),
    togglePiano: () => {
      if (!lower.pianoOpen && selected?.kind !== 'midi') {
        const first = project.tracks
          .flatMap((track) => track.clips)
          .find((clip) => clip.kind === 'midi');
        if (first) select(first.id);
      }
      lower.setPianoOpen(!lower.pianoOpen);
    },
    openDevices: (id) => {
      lower.setRackTrack(id);
      lower.showRack();
    },
    editInstrument: (id) => {
      select(id);
      lower.setPianoOpen(true);
    },
    copyClips: () => {
      clipboard.current = project.tracks.flatMap((track) =>
        track.clips
          .filter((clip) => selectionIds.includes(clip.id))
          .map((clip) => ({ trackId: track.id, clip }))
      );
      setMessage(`${clipboard.current.length} clips copied. Paste places them at the playhead.`);
    },
    pasteClips: () => {
      if (clipboard.current.length)
        edit((next) => edits.pasteClips(next, clipboard.current, position.current));
    },
    undo: (redo = false) => {
      if (!working.current) history.undo(redo);
    },
    changeZoom: (requested) => view.changeZoom(requested, position.current),
    fitTimeline: (selectionOnly = false) =>
      view.fit(
        project.tracks
          .flatMap((track) => track.clips)
          .filter(
            (clip) => !selectionOnly || (chosen.length ? chosen : [selection]).includes(clip.id)
          ),
        selectionOnly
      ),
    snapped: (seconds) =>
      snap ? Math.round(seconds / (60 / bpm / grid)) * (60 / bpm / grid) : seconds,
    toggleSnap: () => setSnap(!snap),
    toggleFollow: () => setFollow(!follow),
    chooseAudio: () => {
      importTarget.current = null;
      audioInput.current?.click();
    },
    chooseMidi: () => midiInput.current?.click(),
    addAudioTrack: () => edit((next) => edits.appendTracks(next, [audioTrack()])),
    copyDeckAudio: () => {
      const imported = migrateArrangement({ decks });
      edit((next) => edits.appendTracks(next, imported.tracks));
      setMessage(
        'Copied deck source audio and clip edits. Live deck FX are not baked into these copies; record a take to preserve the performed sound.'
      );
    },
    addToTrack: (trackId, kind) => {
      if (kind === 'midi') {
        addMidiPattern(trackId);
        return;
      }
      importTarget.current = trackId;
      audioInput.current?.click();
    },
    changeEffects: (id, effects) => {
      const row = current.current.tracks.find((track) => track.id === id);
      const automation = Object.fromEntries(
        Object.entries(row?.automation || {}).filter(
          ([target]) =>
            !target.startsWith('fx:') ||
            effects.some((effect) => target.startsWith(`fx:${effect.id}:`))
        )
      );
      changeTrack(id, { effects, automation }, true);
    },
    automateTrack: (id, automation) => {
      pause();
      changeTrack(id, { automation });
    },
    dropFiles: (dataTransfer, trackId, at) => {
      if (!moving.current) void operations.addFiles(droppedLibraryFiles(dataTransfer), trackId, at);
    },
    dropOnLane: (trackId, at, dataTransfer) => {
      if (!moving.current) {
        void operations.addFiles(droppedLibraryFiles(dataTransfer), trackId, at);
        return;
      }
      const id = moving.current;
      moving.current = null;
      edit((next) => edits.dropClip(next, id, trackId, at));
    },
    selectClip: (id, extend) => {
      const nextIds = extend
        ? selectionIds.includes(id)
          ? selectionIds.filter((item) => item !== id)
          : [...selectionIds, id]
        : [id];
      setChosen(nextIds);
      setSelection(nextIds.includes(id) ? id : nextIds.at(-1) || null);
    },
    commitClipGesture: ({ kind, origin, next: result, trackId, destination }) =>
      edit((next) =>
        kind === 'move'
          ? moveClips(
              next,
              selectionIds.includes(origin.id) ? selectionIds : [origin.id],
              result.start - origin.start,
              trackId,
              destination
            )
          : edits.replaceClip(next, trackId, result)
      ),
    changeLoop: (change) => {
      pause();
      if ('start' in change) setLoopStart(change.start);
      if ('end' in change) setLoopEnd(change.end);
      if ('enabled' in change) setLoopEnabled(change.enabled);
    },
    loopPattern: () => {
      pause();
      setLoopStart(selected.start);
      setLoopEnd(selected.start + selected.duration);
      setLoopEnabled(true);
      playback.setPosition(selected.start);
      setMessage('Beat loop ready. Press Play arrangement to listen.');
    },
    addLocator: () => edit((next) => edits.addLocator(next, position.current)),
    recordingChange: (value) => {
      setMidiCaptureActive(value);
      working.current = value;
      setBusy(value);
      onBusy(value);
    },
    recorded: (notes, duration, start, sound) => {
      const track = edits.midiTakeTrack(notes, duration, start, sound);
      edit((next) => edits.appendTracks(next, [track]));
      setSelection(track.clips[0].id);
    },
    relink: (assetId) => {
      relinkTarget.current = assetId;
      relinkInput.current?.click();
    },
    audition: (note) => {
      if (!busy)
        void getEngine()
          .unlock()
          .then(() =>
            playback
              .getArrangementEngine()
              .audition(note, selected, selectedTrack, project, playback.settings.current)
          )
          .catch(reportError);
    },
    beginSliderGesture: (event) => beginSliderTransaction(event, history, sliderGesture),
    keyDown: (event) => handleEditorKey(event, actions, zoom),
    updateTrack: (id, updates, options) =>
      edit((next) => edits.updateTrack(next, id, updates), { live: options?.live === true }),
    openExport: () => {
      setMobileTools(true);
      exportTools.current?.scrollIntoView?.({ block: 'nearest' });
    },
    importAudio: () => {
      if (working.current || !ready) return;
      importTarget.current = null;
      audioInput.current?.click();
    },
    importMidi: (files) => void operations.addFiles(Promise.resolve(files)),
    importChosenAudio: (entries) =>
      void operations.addFiles(Promise.resolve(entries), importTarget.current),
    relinkChosen: (file) => {
      const id = relinkTarget.current;
      relinkTarget.current = null;
      if (id) void operations.relinkFile(file, id);
    },
    reset: () => {
      playback.rewind();
      history.reset();
      setSelection(null);
      setChosen([]);
      clipboard.current = [];
      setLoopEnabled(false);
    },
  });
  useImperativeHandle(
    ref,
    () => ({
      // `options.live`: apply without an undo step; commitLiveEdit records the gesture once.
      updateTrack: actions.updateTrack,
      commitLiveEdit: () => history.end(),
      // Unlike editor edits, the page's edits are never gated: a take must not be dropped.
      applyEdit: (updater) => history.commit(updater(history.project)),
      openPerformance: actions.openPerformance,
      openExport: actions.openExport,
      openDevices: actions.openDevices,
      toggle: actions.toggle,
      pause: actions.pause,
      getPosition,
      importFiles: actions.importFiles,
      importAudio: actions.importAudio,
      undo: (redo) => actions.undo(redo),
      reset: actions.reset,
    }),
    [actions, history, getPosition]
  );
  // A tempo change retimes beat-based MIDI; a project replaced along with the
  // tempo (restore, import) is already at that tempo.
  useLayoutEffect(() => {
    const replaced = history.takeAdoption(project);
    const previous = priorTempo.current;
    priorTempo.current = bpm;
    if (replaced || previous === bpm) return;
    history.commit(retimeMidi(current.current, previous, bpm));
  }, [history, project, bpm]);
  const duration = Math.max(
      (16 * 240) / bpm,
      projectEnd + rackTail(master.processing?.effects) + 240 / bpm
    ),
    width = Math.max(600, duration * zoom);
  return (
    <section
      hidden={!visible}
      className="sd-arrangement-editor ae-workspace-focused"
      data-editor-open={lower.open}
      style={{ '--editor-height': `${lower.editorHeight}px` }}
      aria-label="Multitrack arrangement"
      tabIndex={0}
      onKeyDown={actions.keyDown}
      onPointerDownCapture={actions.beginSliderGesture}
    >
      <ArrangementToolbar
        trackCount={project.tracks.length}
        bpm={bpm}
        playing={playing}
        busy={busy}
        ready={ready}
        hasClips={hasClips}
        pianoOpen={lower.pianoOpen}
        sequencerOpen={!lower.pianoOpen && lower.lowerEditor === 'sequencer'}
        canCopyDecks={decks.some((deck) => deck.duration)}
        cursor={cursor}
        zoom={zoom}
        canFitSelection={!!selected}
        follow={follow}
        commands={actions}
      />
      <div className="ae-project-tools">
        <EditExportPanel
          detailsRef={exportTools}
          open={mobileTools}
          selectionCount={selectionIds.length}
          clipboardCount={clipboard.current.length}
          busy={busy}
          showCancel={busy && !midiCaptureActive}
          snap={snap}
          grid={grid}
          canUndo={historyStatus.undo}
          canRedo={historyStatus.redo}
          cursor={cursor}
          hasClips={hasClips}
          commands={actions}
        />
        <LoopPanel
          busy={busy}
          ready={ready}
          bpm={bpm}
          grid={grid}
          loop={loop}
          selected={selected}
          selectedTrack={selectedTrack}
          project={project}
          master={master}
          getEngine={getEngine}
          getArrangementEngine={playback.getArrangementEngine}
          getPosition={getPosition}
          commands={actions}
        />
        <ExportRangePanel
          open={mobileTools || busy}
          busy={busy}
          selected={selected}
          settings={exportSettings}
          onError={setMessage}
        />
      </div>
      <p role="status">
        {project.tracks.length && message === WELCOME ? '' : message}
        {busy && !midiCaptureActive && !mobileTools && (
          <button type="button" onClick={playback.cancelOperation}>
            Cancel operation
          </button>
        )}
      </p>
      <SourceInputs
        midiRef={midiInput}
        audioRef={audioInput}
        relinkRef={relinkInput}
        onMidi={actions.importMidi}
        onAudio={actions.importChosenAudio}
        onRelink={actions.relinkChosen}
      />
      <Timeline
        scrollRef={scroll}
        visible={visible}
        tracks={project.tracks}
        zoom={zoom}
        bpm={bpm}
        grid={grid}
        width={width}
        duration={duration}
        cursor={cursor}
        busy={busy}
        selection={selectionIds}
        snapped={actions.snapped}
        suppressClick={suppressClipClick}
        moving={moving}
        commands={actions}
      />
      <LowerEditor
        lower={lower}
        visible={visible}
        project={project}
        selected={selected}
        selectedTrack={selectedTrack}
        projectEnd={projectEnd}
        busy={busy}
        ready={ready}
        playing={playing}
        hasClips={hasClips}
        cursor={cursor}
        position={position}
        bpm={bpm}
        activeReplay={operations.activeReplay}
        inspector={inspector}
        commands={actions}
      />
      {recordings.length > 0 && (
        <RecordedTakes
          recordings={recordings}
          disabled={busy || !ready}
          onAdd={operations.addTake}
        />
      )}
      <footer>
        Arrange preview 2026.09.21.3 · Audio-clock playback · Live clip editing is under validation
        · Track stems are pre-master, not AI separation · Keep a portable project backup.
      </footer>
    </section>
  );
}

const shallowEqual = (a, b) =>
  a === b ||
  (!!a &&
    !!b &&
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.is(a[key], b[key])));

// The page builds `master` inline; compare it field by field so an unrelated
// page render does not re-render the whole arrangement.
const sameProps = (previous, next) =>
  Object.keys({ ...previous, ...next }).every((key) =>
    key === 'master'
      ? shallowEqual(previous.master, next.master)
      : Object.is(previous[key], next[key])
  );

export default memo(forwardRef(ArrangementEditor), sameProps);
