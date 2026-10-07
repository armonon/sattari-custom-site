import { useCallback, useMemo, useRef, useState } from 'react';
import ArrangementEditor from '../components/studio/ArrangementEditor';
import StudioInstallMetadata from '../components/studio/StudioInstallMetadata';
import SourceChooser from '../components/studio/SourceChooser';
import { PanelLayoutProvider } from '../components/studio/StudioPanel';
import { PAGE_SEO, musicToolSchema } from '../data/siteSeo';
import { useArrangerBridge } from '../studio/hooks/useArrangerBridge';
import { useCapture } from '../studio/hooks/useCapture';
import { useDeckOperations } from '../studio/hooks/useDeckOperations';
import { useMasterControls } from '../studio/hooks/useMasterControls';
import { useMidi } from '../studio/hooks/useMidi';
import { usePads } from '../studio/hooks/usePads';
import { useStudioEngine } from '../studio/hooks/useStudioEngine';
import { useStemDeckLockerOpen } from '../studio/hooks/useLockerOpen';
import { useStemHandoff } from '../studio/hooks/useStemHandoff';
import { useInputSource, useInspector } from '../studio/hooks/useShellPanels';
import { useStudioKeyboard } from '../studio/hooks/useStudioKeyboard';
import { createStudioActivity } from '../studio/session/studioActivity';
import { useStudioSession } from '../studio/session/useStudioSession';
import { useHeadphones } from '../studio/mixer/useHeadphones';
import { useMixerDock, useWorkspaceView } from '../studio/mixer/useMixerDock';
import { TransportProvider, createTransportStore } from '../studio/transport/transportStore';
import { useTransportLoop } from '../studio/transport/useTransportLoop';
import CommandBar from '../studio/views/CommandBar';
import DecksView from '../studio/views/DecksView';
import FilesView from '../studio/views/FilesView';
import LibraryView, { useLibraryDeckSlots } from '../studio/views/LibraryView';
import MixerDock from '../studio/views/MixerDock';
import { PadsAndFx } from '../studio/views/PerformTools';
import {
  AdvancedStrip,
  READY_NOTICE,
  SessionNotice,
  SettingsPopover,
  TransferBanner,
  WorkspaceHeading,
} from '../studio/views/SessionChrome';
import SessionInspector from '../studio/views/SessionInspector';
import { useCompactIcons } from '../utils/studioDisplay';
import { SEO, StructuredData } from '../utils/seo';
import '../styles-studio-tokens.css';
import '../styles-stemdeck-web.css';
import '../styles-stemdeck-native.css';
import '../styles-studio-console.css';
import '../styles-studio-session.css';

const STUDIO_FEATURES = [
  'Deck mixing',
  'Audio recording',
  'MIDI instruments',
  'Multitrack arrangement',
  'WAV export',
];

export default function SattariStudioPage() {
  const [notice, setNotice] = useState(READY_NOTICE);
  const dock = useMixerDock();
  // The Mix tab became the dock: a request for that view opens Perform with it.
  const [activeView, setActiveView] = useWorkspaceView(dock.show);
  const [libraryCollection, setLibraryCollection] = useState('session');
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactIcons, setCompactIcons] = useCompactIcons();
  const [activity] = useState(createStudioActivity);
  const [transport] = useState(createTransportStore);
  const arrangerRef = useRef(null);
  const projectInputRef = useRef(null);
  const deckImportRef = useRef(null);
  const libraryImportRef = useRef(null);

  const showArranger = useCallback(() => setActiveView('arranger'), [setActiveView]);
  const engine = useStudioEngine();
  const inspector = useInspector(activeView);
  const input = useInputSource({
    getEngine: engine.getEngine,
    setNotice,
    onConnected: () => inspector.setInspector('input'),
  });
  const session = useStudioSession({
    engine,
    arrangerRef,
    transport,
    activity,
    setNotice,
    setMicrophoneActive: input.setMicrophoneActive,
  });
  const { state, actions } = session;
  const { decks } = state;
  const arranger = useArrangerBridge({ arrangerRef, actions, activity, showArranger });
  const deckOps = useDeckOperations({
    engine,
    session,
    arranger,
    arrangerRef,
    activity,
    transport,
    activeView,
    setActiveView,
    setNotice,
  });
  // Stems sent from the Split lab (/studio/split) land in the first free deck.
  useStemHandoff({ ready: session.ready, decks, deckOps, actions, setActiveView, setNotice });
  // Audio sent from the Locker or another suite app (?tcc-open=) lands the same way.
  useStemDeckLockerOpen({
    ready: session.ready,
    decks,
    deckOps,
    actions,
    setActiveView,
    setNotice,
  });
  const pads = usePads({ engine, session, activity, setNotice });
  const midi = useMidi({ triggerPad: pads.triggerPad, padCount: state.pads.length, setNotice });
  const master = useMasterControls({ engine, session, setNotice });
  const headphones = useHeadphones({
    getEngine: engine.getEngine,
    onEngine: engine.onEngine,
    setNotice,
  });
  const capture = useCapture({
    engine,
    session,
    arranger,
    arrangerRef,
    activity,
    activeView,
    setNotice,
  });
  useTransportLoop({
    active:
      decks.some((deck) => deck.playing) ||
      input.microphoneActive ||
      capture.captureActive ||
      arranger.arrangerPlaying,
    store: transport,
    engineRef: engine.engineRef,
    latest: session.latest,
    updateDeck: actions.updateDeck,
    setNotice,
  });
  const undo = useCallback((redo) => arrangerRef.current?.undo(redo), []);
  const toggleDock = dock.toggle;
  const toggleMixer = useCallback(() => toggleDock({ focus: true }), [toggleDock]);
  useStudioKeyboard({
    activeView,
    triggerPad: pads.triggerPad,
    toggleTransport: deckOps.toggleGlobalTransport,
    undo,
    toggleMixer,
  });
  const librarySlots = useLibraryDeckSlots(decks);

  const loadedDecks = useMemo(() => decks.filter((deck) => deck.duration), [decks]);
  const loadedStems = useMemo(
    () =>
      decks.flatMap((deck) =>
        Object.values(deck.lanes)
          .filter((lane) => lane.id !== 'fullMix' && lane.assetId)
          .map((lane) => ({ ...lane, deckId: deck.id, accent: deck.accent }))
      ),
    [decks]
  );
  const anyPlaying = arranger.arrangerPlaying || decks.some((deck) => deck.playing);
  const arrangementTransport = activeView === 'arranger' || arranger.arrangerPlaying;
  const focusedDeck = decks.find((deck) => deck.id === state.focusedDeckId) || decks[0];

  const openDeckImport = () => deckImportRef.current?.click();
  const openProjectFile = () => projectInputRef.current?.click();
  const focusDeck = (deckId) => {
    actions.setFocusedDeckId(deckId);
    setActiveView('decks');
  };
  const openTrackDevices = useCallback(
    (trackId) => {
      setActiveView('arranger');
      arrangerRef.current?.openDevices?.(trackId);
    },
    [setActiveView]
  );
  const importIntoView = () => {
    if (activeView === 'arranger') arrangerRef.current?.importAudio();
    else (activeView === 'library' ? libraryImportRef : deckImportRef).current?.click();
  };

  return (
    <>
      <SEO {...PAGE_SEO.studio} />
      <StructuredData data={musicToolSchema('studio', STUDIO_FEATURES)} />
      <PanelLayoutProvider workspace={activeView}>
        <TransportProvider store={transport}>
          <section
            className="stemdeck-web sd-studio-next sd-session-shell"
            data-compact-icons={compactIcons}
          >
            <StudioInstallMetadata />
            {input.chooserOpen && (
              <SourceChooser
                inputActive={input.microphoneActive}
                onClose={input.closeChooser}
                onTrack={() => {
                  input.closeChooser();
                  openDeckImport();
                }}
                onConnect={input.connect}
              />
            )}
            <a className="sd-skip-link" href="#studio-workspace">
              Skip to workspace
            </a>
            <div className="sd-app-frame">
              <CommandBar
                activeView={activeView}
                onViewChange={setActiveView}
                mixerOpen={dock.open}
                onToggleMixer={toggleMixer}
                mixerToggleRef={dock.toggleRef}
                onLibraryDrop={deckOps.dropLibraryTrack}
                transport={{
                  playing: arrangementTransport ? arranger.arrangerPlaying : anyPlaying,
                  arrangement: arrangementTransport,
                  anyPlaying,
                  available: arrangementTransport
                    ? state.arranger.tracks.some((track) => track.clips.length > 0)
                    : loadedDecks.length > 0,
                  onToggle: deckOps.toggleGlobalTransport,
                }}
                session={state}
                actions={actions}
                capture={capture}
                inspector={inspector.inspector}
                onToggleInspector={inspector.toggle}
                getEngine={engine.getEngine}
                advancedVisible={advancedVisible}
                onToggleAdvanced={() => setAdvancedVisible((value) => !value)}
                settingsOpen={settingsOpen}
                onToggleSettings={() => setSettingsOpen((value) => !value)}
              />

              {advancedVisible ? (
                <AdvancedStrip
                  sessionName={state.sessionName}
                  onSessionName={actions.setSessionName}
                  activeView={activeView}
                  onViewChange={setActiveView}
                  mixerOpen={dock.open}
                  onToggleMixer={toggleMixer}
                  midiActive={midi.midiActive}
                  onToggleMidi={midi.toggleMidi}
                  microphoneActive={input.microphoneActive}
                  onToggleMicrophone={input.toggleMicrophone}
                  onSave={session.exportSession}
                  onImportSet={openDeckImport}
                  onOpenProject={openProjectFile}
                  onNewProject={session.newSession}
                  setNotice={setNotice}
                />
              ) : null}

              {settingsOpen ? (
                <SettingsPopover
                  session={state}
                  actions={actions}
                  compactIcons={compactIcons}
                  onCompactIcons={setCompactIcons}
                  onClose={() => setSettingsOpen(false)}
                  onReset={session.newSession}
                />
              ) : null}

              {state.transfer ? (
                <TransferBanner
                  transfer={state.transfer}
                  onDismiss={() => actions.setTransfer(null)}
                />
              ) : null}
              <SessionNotice
                notice={notice}
                capture={capture}
                counts={{
                  decks: loadedDecks.length,
                  stems: loadedStems.length,
                  takes: state.recordings.length,
                }}
              />

              <section
                id="studio-workspace"
                aria-label="Studio workspace"
                tabIndex={-1}
                className={`sd-workspace sd-view-${activeView}`}
              >
                <WorkspaceHeading
                  activeView={activeView}
                  sessionName={state.sessionName}
                  capture={capture}
                  takes={state.arranger.captures.length}
                  onOpenPerformance={() => {
                    setActiveView('arranger');
                    arrangerRef.current?.openPerformance();
                  }}
                  onOpenExport={() => arrangerRef.current?.openExport()}
                  onImport={importIntoView}
                  onSave={session.exportSession}
                />
                {activeView === 'decks' ? (
                  <DecksView
                    decks={decks}
                    loadedDecks={loadedDecks}
                    focusedDeck={focusedDeck}
                    anyPlaying={anyPlaying}
                    crossfader={state.crossfader}
                    onCrossfader={actions.setCrossfader}
                    crossfaderCurve={state.crossfaderCurve}
                    onCrossfaderCurve={actions.setCrossfaderCurve}
                    crossfaderReverse={state.crossfaderReverse}
                    onCrossfaderReverse={actions.setCrossfaderReverse}
                    onSyncAll={deckOps.syncAll}
                    onSyncKey={deckOps.syncKey}
                    onFocusDeck={actions.setFocusedDeckId}
                    onAutomix={deckOps.startAutomix}
                    deckHandlers={deckOps.deckHandlers}
                    onAddSource={input.openChooser}
                    onLoadLane={deckOps.loadLane}
                  >
                    <PadsAndFx
                      pads={state.pads}
                      activePad={pads.activePad}
                      onTrigger={pads.triggerPad}
                      onLoad={pads.loadPad}
                      onGain={pads.changePadGain}
                      fx={state.masterFx}
                      onFx={master.updateMasterFx}
                    />
                  </DecksView>
                ) : null}

                {activeView === 'library' ? (
                  <LibraryView
                    libraryInputRef={libraryImportRef}
                    librarySlots={librarySlots}
                    onLoad={deckOps.loadLibraryTrack}
                    onArrange={arranger.importToArranger}
                    analysisBlocked={anyPlaying || capture.captureActive}
                    decks={decks}
                    loadedDecks={loadedDecks}
                    loadedStems={loadedStems}
                    recordings={state.recordings}
                    collection={libraryCollection}
                    onCollection={setLibraryCollection}
                    onOpenDeck={focusDeck}
                    onOpenStems={(deckId) => {
                      actions.setFocusedDeckId(deckId);
                      actions.updateDeck(deckId, { activeToolTab: 'STEMS' });
                      setActiveView('decks');
                    }}
                    onLoadDeckFiles={openDeckImport}
                    onDownloadRecording={session.downloadRecording}
                  />
                ) : null}

                {/* Always mounted: it owns the arrangement's undo history. */}
                <ArrangementEditor
                  ref={arrangerRef}
                  project={state.arranger}
                  recordings={state.recordings}
                  onChange={arranger.onChange}
                  getEngine={engine.getEngine}
                  bpm={state.masterBpm}
                  master={master.master}
                  decks={decks}
                  visible={activeView === 'arranger'}
                  ready={session.ready}
                  onBusy={arranger.onBusy}
                  onPlaying={arranger.onPlaying}
                />

                {activeView === 'files' ? (
                  <FilesView
                    sessionName={state.sessionName}
                    restored={state.restored}
                    recordings={state.recordings}
                    onImportSet={openDeckImport}
                    onOpenProject={openProjectFile}
                    onSave={session.exportSession}
                    onNewProject={session.newSession}
                    onDownloadRecording={session.downloadRecording}
                    onCleanUpStorage={session.cleanUpStorage}
                    backup={session.backup}
                    onDownloadBackup={session.downloadBackup}
                    onClearBackup={session.clearBackup}
                    setAside={state.arranger.setAside}
                    onDownloadSetAside={session.downloadSetAside}
                    onDiscardSetAside={session.discardSetAside}
                  />
                ) : null}
              </section>

              <MixerDock
                dock={dock}
                engineRef={engine.engineRef}
                decks={decks}
                onDeckChange={deckOps.changeDeck}
                tracks={state.arranger.tracks}
                onUpdateTrack={arranger.updateTrack}
                onCommitTrack={arranger.commitLiveEdit}
                onOpenDevices={openTrackDevices}
                returns={state.mixer.returns}
                onReturnChange={master.updateReturn}
                master={{
                  level: state.masterLevel,
                  limiter: state.limiter,
                  assist: state.aiMaster,
                  assistMode: state.aiMasterMode,
                  bpm: state.masterBpm,
                  keyLocked: decks.every((deck) => deck.keyLock),
                  onLevel: actions.setMasterLevel,
                  onLimiter: actions.setLimiter,
                  onAssist: actions.setAiMaster,
                  onAssistMode: actions.setAiMasterMode,
                  onTapTempo: master.tapTempo,
                  onToggleKeyLock: deckOps.toggleAllKeyLock,
                }}
                headphones={headphones}
              />

              <SessionInspector
                inspector={inspector.inspector}
                onClose={inspector.close}
                getEngine={engine.getEngine}
                onChooseSource={input.openChooser}
                onInputActive={input.setMicrophoneActive}
                session={state}
                actions={actions}
                captureActive={capture.captureActive}
              />

              <input
                ref={projectInputRef}
                type="file"
                accept="application/json,.json,.sattari"
                hidden
                onChange={(event) => {
                  void session.importSession(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <input
                ref={deckImportRef}
                type="file"
                accept="audio/*"
                multiple
                hidden
                onChange={(event) => {
                  void deckOps.importDeckSet([...event.target.files]);
                  event.target.value = '';
                }}
              />
            </div>
          </section>
        </TransportProvider>
      </PanelLayoutProvider>
    </>
  );
}
