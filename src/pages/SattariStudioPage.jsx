import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StudioAction from '../components/studio/StudioAction';
import {
  StudioPanel,
  PanelLayoutProvider,
  PanelLayoutActions,
} from '../components/studio/StudioPanel';
import { useCompactIcons } from '../utils/studioDisplay';
import {
  AlignJustify,
  Circle,
  Folder,
  FolderOpen,
  Grid2X2,
  KeyRound,
  Library,
  ListMusic,
  Maximize2,
  Mic2,
  Pause,
  Play,
  Plus,
  Radio,
  Save,
  Settings,
  SlidersHorizontal,
  Square,
  X,
} from 'lucide-react';
import {
  Knob,
  SegmentMeter,
  StemDeckChannel,
  VerticalFader,
} from '../components/studio/StemDeckChannel';
import { analyzeAudioFile, createWaveformPeaks } from '../utils/audioAnalysis';
import {
  clearStudioSession,
  getAudioAsset,
  importAudioAssets,
  loadStudioSession,
  putAudioAsset,
  saveStudioSession,
  validateStudioProject,
} from '../utils/audioProjectStore';
import { SEO, StructuredData } from '../utils/seo';
import { PAGE_SEO, musicToolSchema } from '../data/siteSeo';
import ToolReferenceLink from '../components/ToolReferenceLink';
import { trackSiteEvent } from '../utils/siteMeasurement';
import { StudioAudioEngine } from '../utils/studioAudioEngine';
import { deferredSessionSave } from '../utils/deferredSessionSave';
import { persistentSession } from '../utils/sessionPersistence';
import { writeProjectArchive, readProjectArchive } from '../utils/projectArchive';
import { clearExportFile } from '../utils/arrangementStreamExport';
import { performanceAssetIds, relinkPerformanceAssets } from '../utils/performanceReplay';
import MasterOutput from '../components/studio/MasterOutput';
import SessionOutputStatus from '../components/studio/SessionOutputStatus';
import SourceChooser from '../components/studio/SourceChooser';
import InputStrip from '../components/studio/InputStrip';
import MusicLibrary from '../components/studio/MusicLibrary';
import { getLibraryAudio, listLibraryTracks } from '../utils/musicLibrary';
import ArrangementEditor from '../components/studio/ArrangementEditor';
import {
  audioClip,
  audioTrack,
  emptyArrangement,
  migrateArrangement,
} from '../utils/arrangementModel';
import { DEFAULT_MASTER_PROCESSING, normalizeMasterProcessing } from '../utils/masterOutput';
import '../styles-stemdeck-web.css';
import '../styles-stemdeck-native.css';
import '../styles-studio-console.css';
import '../styles-studio-session.css';

const DECK_SEEDS = [
  { id: 'A', accent: '#4ad9c4', side: 'left' },
  { id: 'B', accent: '#4a9eff', side: 'right' },
  { id: 'C', accent: '#b47aff', side: 'left' },
  { id: 'D', accent: '#e8a54a', side: 'right' },
];

const LANE_DEFINITIONS = [
  { id: 'fullMix', label: 'Full mix' },
  { id: 'drums', label: 'Drums' },
  { id: 'bass', label: 'Bass' },
  { id: 'music', label: 'Music' },
  { id: 'vocals', label: 'Vocals' },
];

const STEM_IDS = ['drums', 'bass', 'music', 'vocals'];
const PAD_SEEDS = [
  ['Kick', 72, '#26d9ff'],
  ['Snare', 180, '#62f5c8'],
  ['Hat', 420, '#4a90e2'],
  ['Clap', 260, '#9b7bff'],
  ['Low', 110, '#ffb020'],
  ['Rise', 760, '#e0742b'],
  ['Perc', 330, '#e03030'],
  ['Tone', 610, '#d44fc8'],
];

const VIEWS = [
  ['library', 'Library', Folder],
  ['decks', 'Perform', Grid2X2],
  ['arranger', 'Arrange', AlignJustify],
  ['mixer', 'Mix', SlidersHorizontal],
];

const PROJECT_KEYS = ['Off', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

function createLane(definition) {
  return {
    ...definition,
    assetId: '',
    name: '',
    level: 100,
    muted: false,
    solo: false,
    pitch: 0,
    duration: 0,
    status: 'empty',
  };
}

function createDeck(seed) {
  return {
    ...seed,
    cfSide: seed.side,
    title: 'Empty deck',
    keyName: '--',
    sourceKeyName: '--',
    bpm: 120,
    beatOffset: 0,
    downbeat: 1,
    gain: 100,
    fader: 100,
    pitch: 0,
    filter: 50,
    eq: { low: 50, mid: 50, high: 50 },
    fx: { reverb: 15, echo: 0, macro: 0 },
    stemFx: Object.fromEntries(
      STEM_IDS.map((stemId) => [stemId, { filter: 50, send: 0, pitch: 0 }])
    ),
    looping: false,
    loopStart: 0,
    loopEnd: 2.5,
    synced: false,
    keyLock: true,
    liveKey: false,
    slip: false,
    tempoInterpretation: 'Straight',
    syncMode: 'BPM',
    activeToolTab: 'CUES',
    hotCues: Array(8).fill(null),
    introEnd: null,
    outroStart: null,
    muted: false,
    solo: false,
    playing: false,
    duration: 0,
    waveform: Array.from({ length: 96 }, (_, index) => 10 + ((index * 17) % 18)),
    analysis: null,
    arrangement: createArrangement(),
    lanes: Object.fromEntries(
      LANE_DEFINITIONS.map((definition) => [definition.id, createLane(definition)])
    ),
  };
}

const AUTOMATION_DEFAULTS = {
  volume: [
    { position: 0, value: 100 },
    { position: 1, value: 100 },
  ],
  filter: [
    { position: 0, value: 50 },
    { position: 1, value: 50 },
  ],
  reverb: [
    { position: 0, value: 15 },
    { position: 1, value: 15 },
  ],
};

function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function createArrangement(duration = 0) {
  return {
    enabled: true,
    start: 0,
    trimStart: 0,
    trimEnd: Math.max(0, duration),
    gain: 100,
    fadeIn: 0,
    fadeOut: 0,
    automationTarget: 'volume',
    automation: Object.fromEntries(
      Object.entries(AUTOMATION_DEFAULTS).map(([target, points]) => [
        target,
        points.map((point) => ({ ...point })),
      ])
    ),
  };
}

function normalizeAutomationPoints(points, fallback) {
  const normalized = (Array.isArray(points) && points.length ? points : fallback)
    .map((point) => ({
      position: clampNumber(point?.position, 0, 1),
      value: Number(point?.value) || 0,
    }))
    .sort((a, b) => a.position - b.position);
  return normalized.length > 1 ? normalized : fallback.map((point) => ({ ...point }));
}

function normalizeArrangement(saved, duration = 0) {
  const base = createArrangement(duration);
  if (duration <= 0) {
    return {
      ...base,
      ...saved,
      trimStart: 0,
      trimEnd: 0,
      automation: Object.fromEntries(
        Object.entries(AUTOMATION_DEFAULTS).map(([target, fallback]) => [
          target,
          normalizeAutomationPoints(saved?.automation?.[target], fallback),
        ])
      ),
    };
  }
  const trimStart = clampNumber(saved?.trimStart, 0, Math.max(0, duration - 0.05));
  const savedTrimEnd = Number(saved?.trimEnd);
  const trimEnd = clampNumber(
    savedTrimEnd > 0 ? savedTrimEnd : duration,
    Math.min(duration, trimStart + 0.05),
    Math.max(duration, trimStart + 0.05)
  );
  return {
    ...base,
    ...saved,
    enabled: saved?.enabled !== false,
    start: Math.max(0, Number(saved?.start) || 0),
    trimStart,
    trimEnd,
    gain: clampNumber(saved?.gain ?? 100, 0, 200),
    fadeIn: clampNumber(saved?.fadeIn, 0, Math.max(0, trimEnd - trimStart)),
    fadeOut: clampNumber(saved?.fadeOut, 0, Math.max(0, trimEnd - trimStart)),
    automationTarget: ['volume', 'filter', 'reverb'].includes(saved?.automationTarget)
      ? saved.automationTarget
      : 'volume',
    automation: Object.fromEntries(
      Object.entries(AUTOMATION_DEFAULTS).map(([target, fallback]) => [
        target,
        normalizeAutomationPoints(saved?.automation?.[target], fallback),
      ])
    ),
  };
}

function normalizeDeck(saved, index) {
  const base = createDeck(DECK_SEEDS[index]);
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    id: base.id,
    playing: false,
    accent: base.accent,
    activeToolTab:
      saved.activeToolTab === 'CUE'
        ? 'CUES'
        : saved.activeToolTab === 'SRC' || saved.activeToolTab === 'SYNC'
          ? 'STEMS'
          : saved.activeToolTab || base.activeToolTab,
    sourceKeyName: saved.sourceKeyName || saved.keyName || base.sourceKeyName,
    eq: { ...base.eq, ...saved.eq },
    fx: { ...base.fx, ...saved.fx },
    hotCues: Array.from({ length: 8 }, (_, cueIndex) => saved.hotCues?.[cueIndex] ?? null),
    stemFx: Object.fromEntries(
      STEM_IDS.map((stemId) => [stemId, { ...base.stemFx[stemId], ...saved.stemFx?.[stemId] }])
    ),
    lanes: Object.fromEntries(
      LANE_DEFINITIONS.map((definition) => [
        definition.id,
        { ...base.lanes[definition.id], ...saved.lanes?.[definition.id] },
      ])
    ),
    arrangement: normalizeArrangement(saved.arrangement, saved.duration || base.duration),
  };
}

function createEmptyDecks() {
  return DECK_SEEDS.map(createDeck);
}

function createPads(saved = []) {
  return PAD_SEEDS.map(([name, frequency, accent], index) => ({
    name,
    frequency,
    accent,
    gain: 82,
    assetId: '',
    ...saved[index],
  }));
}

function formatTime(seconds, includeHours = false) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return includeHours
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function stemIdForFile(file, fallbackIndex) {
  const name = file.name.toLowerCase();
  return STEM_IDS.find((stemId) => name.includes(stemId)) || STEM_IDS[fallbackIndex % 4];
}

function keyPitchClass(keyName) {
  const root = String(keyName).match(/^[A-G](?:#|b)?/)?.[0];
  const pitchClasses = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
  };
  return root ? pitchClasses[root] : undefined;
}

function nearestSemitoneShift(from, to) {
  const distance = ((to - from + 18) % 12) - 6;
  return distance === -6 ? 6 : distance;
}

function buildMidiPattern(kind, bpm) {
  if (kind === 'drums') {
    return Array.from({ length: 16 }, (_, step) => ({
      pitch: step % 4 === 0 ? 'C4' : step % 4 === 2 ? 'D4' : 'F#4',
      step,
      velocity: step % 4 === 0 ? 112 : 84,
    }));
  }
  return ['C4', 'E4', 'G4', 'B4', 'G4', 'E4', 'D4', 'G4'].map((pitch, index) => ({
    pitch,
    step: index * 2,
    velocity: 78 + ((bpm + index * 7) % 32),
  }));
}

export default function SattariStudioPage() {
  const engineRef = useRef(null);
  const capturePendingRef = useRef(false);
  const projectPendingRef = useRef(false);
  const pendingLoadsRef = useRef(new Set());
  const transportPendingRef = useRef(false);
  const unsavedRecordingRef = useRef(null);
  const captureTimelineStartRef = useRef(0);
  const [captureSeparateSources, setCaptureSeparateSources] = useState(true);
  const [longSession, setLongSession] = useState(false);
  const [recordingHealth, setRecordingHealth] = useState(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const health = engineRef.current?.getRecordingHealth?.();
      if (engineRef.current?.performanceStartedAt != null) setRecordingHealth(health);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const objectUrlsRef = useRef(new Map());
  const animationRef = useRef(0);
  const automixRef = useRef(0);
  const projectInputRef = useRef(null);
  const deckImportRef = useRef(null);
  const libraryImportRef = useRef(null);
  const libraryLoaderRef = useRef(null);
  const onLibraryLoad = useCallback((...args) => libraryLoaderRef.current(...args), []);
  const deckImportTargetRef = useRef(null);
  const padInputRefs = useRef([]);
  const midiAccessRef = useRef(null);
  const tapTimesRef = useRef([]);
  const [decks, setDecks] = useState(createEmptyDecks);
  const [arranger, setArranger] = useState(emptyArrangement);
  const arrangerRef = useRef(null);
  const [arrangerPlaying, setArrangerPlaying] = useState(false);
  const arrangerBusy = useCallback((value) => {
    if (value) pendingLoadsRef.current.add('arranger');
    else pendingLoadsRef.current.delete('arranger');
  }, []);
  const arrangerPlayback = useCallback((value) => {
    setArrangerPlaying(value);
    if (value) setDecks((current) => current.map((deck) => ({ ...deck, playing: false })));
  }, []);
  const latestDecksRef = useRef(decks);
  latestDecksRef.current = decks;
  const [pads, setPads] = useState(createPads);
  const [positions, setPositions] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [deckMeters, setDeckMeters] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [crossfader, setCrossfader] = useState(50);
  const [crossfaderCurve, setCrossfaderCurve] = useState('Smooth');
  const [crossfaderReverse, setCrossfaderReverse] = useState(false);
  const [masterLevel, setMasterLevel] = useState(100);
  const [masterProcessing, setMasterProcessing] = useState({ ...DEFAULT_MASTER_PROCESSING });
  const [masterBpm, setMasterBpm] = useState(120);
  const [projectKey, setProjectKey] = useState('Off');
  const [masterFx, setMasterFx] = useState({ x: 28, y: 44 });
  const [masterDeckId, setMasterDeckId] = useState('A');
  const [activePad, setActivePad] = useState(null);
  const [captureActive, setCaptureActive] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [sessionName, setSessionName] = useState('Untitled session');
  const [transfer, setTransfer] = useState(null);
  const [limiter, setLimiter] = useState(true);
  const [aiMaster, setAiMaster] = useState(false);
  const [aiMasterMode, setAiMasterMode] = useState('Streaming -14');
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [sourceChooserOpen, setSourceChooserOpen] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [notice, setNotice] = useState('STEMDECK browser engine ready.');
  const [restored, setRestored] = useState(false);
  const [activeView, setActiveView] = useState('decks');
  const [libraryCollection, setLibraryCollection] = useState('session');
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspector, setInspector] = useState(null);
  const inspectorOpener = useRef(null);
  const inspectorHeading = useRef(null);
  const commandBarRef = useRef(null);
  useEffect(() => {
    const bar = commandBarRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const update = () =>
      bar.parentElement.style.setProperty(
        '--session-command-height',
        `${bar.getBoundingClientRect().height}px`
      );
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (inspector) inspectorHeading.current?.focus();
  }, [inspector]);
  const closeInspector = () => {
    setInspector(null);
    inspectorOpener.current?.focus();
  };
  const toggleInspector = (name, event) => {
    inspectorOpener.current = event.currentTarget;
    setInspector((current) => (current === name ? null : name));
  };
  const [compactIcons, setCompactIcons] = useCompactIcons();
  const [midiActive, setMidiActive] = useState(false);
  const [pianoNotes, setPianoNotes] = useState([]);
  const [focusedDeckId, setFocusedDeckId] = useState('A');
  useEffect(() => {
    setInspector(null);
  }, [activeView]);

  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new StudioAudioEngine();
    return engineRef.current;
  }, []);

  const updateDeck = useCallback((deckId, updater) => {
    setDecks((current) =>
      current.map((deck) => {
        if (deck.id !== deckId) return deck;
        const updates = typeof updater === 'function' ? updater(deck) : updater;
        return { ...deck, ...updates };
      })
    );
  }, []);

  const hydrateAudio = useCallback(
    async (nextDecks, nextPads, isCancelled = () => false, tempo = 120) => {
      const engine = getEngine();
      const hydrated = nextDecks.map((deck, index) => normalizeDeck(deck, index));
      for (const deck of hydrated) {
        engine.ensureDeck(deck.id, deck.side);
        engine.setDeckGain(deck.id, deck.gain);
        engine.setDeckFader(deck.id, deck.fader);
        engine.setDeckSide(deck.id, deck.cfSide);
        engine.setDeckEq(deck.id, deck.eq);
        engine.setDeckFilter(deck.id, deck.filter);
        engine.setDeckFx(deck.id, deck.fx);
        engine.setDeckPitch(deck.id, deck.pitch);
        engine.setDeckKeyLock(deck.id, deck.keyLock);
        for (const [laneId, lane] of Object.entries(deck.lanes)) {
          if (!lane.assetId) continue;
          try {
            const asset = await getAudioAsset(lane.assetId);
            if (!asset || isCancelled()) {
              lane.status = 'error';
              continue;
            }
            const url = URL.createObjectURL(asset.blob);
            objectUrlsRef.current.set(`${deck.id}:${laneId}`, url);
            lane.duration = await engine.loadLane(deck.id, deck.side, laneId, url);
            lane.status = 'ready';
            lane.name = lane.name || asset.name;
            engine.setLaneState(deck.id, laneId, lane);
            if (deck.stemFx[laneId]) engine.setLaneFx(deck.id, laneId, deck.stemFx[laneId]);
          } catch {
            lane.status = 'error';
          }
        }
        engine.setPlaybackRate(deck.id, deck.synced ? tempo / Math.max(1, deck.bpm) : 1);
        engine.setLoopRegion(deck.id, deck.looping, deck.loopStart, deck.loopEnd);
      }
      for (const [index, pad] of nextPads.entries()) {
        if (!pad.assetId) continue;
        try {
          const asset = await getAudioAsset(pad.assetId);
          if (!asset || isCancelled()) continue;
          const url = URL.createObjectURL(asset.blob);
          objectUrlsRef.current.set(`pad:${index}`, url);
          await engine.loadPad(index, url, pad.gain);
        } catch {
          // The built-in synth remains active when a stored sample is unavailable.
        }
      }
      return hydrated;
    },
    [getEngine]
  );

  const persistentSessionRef = useRef(null);
  persistentSessionRef.current ||= persistentSession({
    loadLegacy: loadStudioSession,
    saveLegacy: saveStudioSession,
    clearLegacy: clearStudioSession,
  });
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const saved = await persistentSessionRef.current.load();
      if (saved) validateStudioProject({ ...saved, decks: saved.decks || [] });
      if (cancelled) return;
      const savedHasAudio = Boolean(
        saved?.decks?.some((deck) => Object.values(deck?.lanes || {}).some((lane) => lane?.assetId))
      );
      const migrateLegacyEmptySession = (saved?.uiSchemaVersion || 0) < 2 && !savedHasAudio;
      const restoredMasterLevel = migrateLegacyEmptySession ? 100 : (saved?.masterLevel ?? 100);
      const restoredMasterBpm = migrateLegacyEmptySession ? 120 : (saved?.masterBpm ?? 120);
      let nextDecks = DECK_SEEDS.map((_, index) => normalizeDeck(saved?.decks?.[index], index));
      const nextPads = createPads(saved?.pads);
      let transferred = null;
      try {
        const value = window.localStorage.getItem('sattari-studio-transfer-v1');
        if (value) {
          transferred = JSON.parse(value);
          const first = nextDecks[0];
          nextDecks[0] = {
            ...first,
            title: transferred.trackName || first.title,
            keyName: transferred.key || first.keyName,
            sourceKeyName: transferred.key || first.sourceKeyName,
            bpm: transferred.bpm || first.bpm,
            duration: transferred.analysis?.duration || first.duration,
            waveform: transferred.analysis?.waveform || first.waveform,
            analysis: transferred.analysis || first.analysis,
            lanes: {
              ...first.lanes,
              fullMix: {
                ...first.lanes.fullMix,
                assetId: transferred.audioAssetId || first.lanes.fullMix.assetId,
                name: transferred.trackName || first.lanes.fullMix.name,
                status: transferred.audioAssetId ? 'loading' : first.lanes.fullMix.status,
              },
            },
          };
          window.localStorage.removeItem('sattari-studio-transfer-v1');
        }
      } catch {
        transferred = null;
      }
      setSessionName(
        saved?.sessionName ||
          (transferred ? `${transferred.trackName} session` : 'Untitled session')
      );
      setPads(nextPads);
      setPianoNotes(Array.isArray(saved?.pianoNotes) ? saved.pianoNotes : []);
      setRecordings(saved?.recordings || []);
      setCrossfader(saved?.crossfader ?? 50);
      setCrossfaderCurve(saved?.crossfaderCurve || 'Smooth');
      setCrossfaderReverse(saved?.crossfaderReverse ?? false);
      setMasterLevel(restoredMasterLevel);
      setMasterProcessing(normalizeMasterProcessing(saved?.masterProcessing));
      setMasterBpm(transferred?.bpm || restoredMasterBpm);
      setProjectKey(saved?.projectKey || 'Off');
      setLimiter(saved?.limiter ?? true);
      setAiMaster(saved?.aiMaster ?? false);
      setAiMasterMode(saved?.aiMasterMode || 'Streaming -14');
      setTransfer(transferred);
      const engine = getEngine();
      engine.setCrossfader(saved?.crossfader ?? 50);
      engine.setCrossfaderCurve(saved?.crossfaderCurve || 'Smooth');
      engine.setMasterLevel(restoredMasterLevel);
      engine.setLimiter(saved?.limiter ?? true);
      engine.setMasterAssist(saved?.aiMaster ?? false, saved?.aiMasterMode || 'Streaming -14');
      const hydrated = await hydrateAudio(
        nextDecks,
        nextPads,
        () => cancelled,
        transferred?.bpm || restoredMasterBpm
      );
      if (!cancelled) {
        setDecks(hydrated);
        setArranger(migrateArrangement({ ...saved, decks: hydrated }));
        setRestored(true);
      }
    };
    void restore().catch((error) => {
      if (!cancelled)
        setNotice(
          `Project restore failed: ${error instanceof Error ? error.message : 'audio unavailable'}. Reload to retry; your saved session has not been overwritten.`
        );
    });
    return () => {
      cancelled = true;
    };
  }, [getEngine, hydrateAudio]);

  const sessionSaver = useRef(null);
  if (!sessionSaver.current)
    sessionSaver.current = deferredSessionSave(
      (value) => persistentSessionRef.current.save(value),
      (error) => {
        setNotice(
          error instanceof Error && error.message.startsWith('Another Studio tab')
            ? error.message
            : 'Autosave failed: local storage is full or unavailable. Use Save project to download a backup before closing.'
        );
      }
    );
  useEffect(() => {
    const flush = () => sessionSaver.current.flush();
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  useEffect(() => {
    if (!restored) return;
    sessionSaver.current.schedule({
      uiSchemaVersion: 2,
      sessionName,
      decks,
      pads,
      recordings,
      crossfader,
      crossfaderCurve,
      crossfaderReverse,
      masterLevel,
      masterProcessing,
      masterBpm,
      projectKey,
      limiter,
      aiMaster,
      aiMasterMode,
      transfer,
      pianoNotes,
      arranger,
    });
  }, [
    aiMaster,
    aiMasterMode,
    crossfader,
    crossfaderCurve,
    crossfaderReverse,
    decks,
    limiter,
    masterBpm,
    masterLevel,
    masterProcessing,
    pads,
    recordings,
    restored,
    projectKey,
    sessionName,
    transfer,
    pianoNotes,
    arranger,
  ]);

  useEffect(() => {
    const visualActivity =
      decks.some((deck) => deck.playing) || microphoneActive || captureActive || arrangerPlaying;
    if (!visualActivity) {
      setDeckMeters((current) =>
        Object.values(current).some((value) => value !== 0) ? { A: 0, B: 0, C: 0, D: 0 } : current
      );
      return undefined;
    }

    let lastUpdate = 0;
    const tick = (timestamp) => {
      const engine = engineRef.current;
      if (engine && timestamp - lastUpdate >= 50) {
        const nextPositions = {};
        const nextMeters = {};
        decks.forEach((deck) => {
          const position = engine.getDeckPosition(deck.id);
          nextPositions[deck.id] = position;
          nextMeters[deck.id] = engine.getDeckMeterLevel(deck.id);
          if (deck.playing && !deck.looping && deck.duration && position >= deck.duration) {
            engine.stopDeck(deck.id);
            updateDeck(deck.id, { playing: false });
          }
        });
        setPositions((current) =>
          decks.some((deck) => Math.abs((current[deck.id] || 0) - nextPositions[deck.id]) > 0.01)
            ? nextPositions
            : current
        );
        setDeckMeters((current) =>
          decks.some((deck) => Math.abs((current[deck.id] || 0) - nextMeters[deck.id]) > 0.005)
            ? nextMeters
            : current
        );
        lastUpdate = timestamp;
      }
      animationRef.current = window.requestAnimationFrame(tick);
    };
    animationRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationRef.current);
  }, [arrangerPlaying, captureActive, decks, microphoneActive, updateDeck]);

  useEffect(
    () => () => {
      window.cancelAnimationFrame(animationRef.current);
      window.clearInterval(automixRef.current);
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
      midiAccessRef.current?.inputs?.forEach((input) => {
        input.onmidimessage = null;
      });
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    []
  );

  useEffect(() => {
    const engine = getEngine();
    engine.setCrossfaderCurve(crossfaderCurve);
    engine.setCrossfader(crossfaderReverse ? 100 - crossfader : crossfader);
  }, [crossfader, crossfaderCurve, crossfaderReverse, getEngine]);

  useEffect(() => {
    const engine = getEngine();
    engine.setMasterLevel(masterLevel);
    engine.setMasterProcessing(masterProcessing);
    engine.setLimiter(limiter);
    engine.setMasterAssist(aiMaster, aiMasterMode);
  }, [getEngine, masterLevel, masterProcessing, limiter, aiMaster, aiMasterMode]);

  useEffect(() => {
    const engine = getEngine();
    const soloed = decks.filter((deck) => deck.solo);
    engine.setProjectTempo?.(masterBpm);
    decks.forEach((deck) => {
      engine.setDeckFader(deck.id, !deck.muted && (!soloed.length || deck.solo) ? deck.fader : 0);
      // The sync controller owns follower rates. UI redraws must not repeatedly
      // overwrite its phase correction with the nominal BPM ratio.
      if (!deck.synced || deck.id === masterDeckId)
        engine.setPlaybackRate(deck.id, deck.synced ? masterBpm / Math.max(1, deck.bpm) : 1);
      engine.setDeckSync?.(
        deck.id,
        deck.synced && deck.id !== masterDeckId,
        deck,
        decks.find((item) => item.id === masterDeckId && item.id !== deck.id)
      );
      engine.setTempoFollow?.(
        deck.id,
        deck.synced && deck.followTempoMap ? deck.analysis?.tempoMap?.beats : null,
        masterBpm
      );
      engine.setDeckFilter(deck.id, deck.filter);
      engine.setDeckFx(deck.id, deck.fx);
    });
  }, [activeView, decks, getEngine, masterBpm, masterDeckId]);

  useEffect(() => {
    const protectCapture = (event) => {
      if (!captureActive && !capturePendingRef.current && !unsavedRecordingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protectCapture);
    return () => window.removeEventListener('beforeunload', protectCapture);
  }, [captureActive]);

  const loadLane = async (deckId, laneId, file, cachedAnalysis = null) => {
    if (!file) return;
    if (projectPendingRef.current) {
      setNotice('Wait for the project to finish opening.');
      return;
    }
    const key = `${deckId}:${laneId}`;
    if (pendingLoadsRef.current.has(key)) {
      setNotice('Wait for this source to finish loading.');
      return;
    }
    pendingLoadsRef.current.add(key);
    const previousLane = decks.find((deck) => deck.id === deckId)?.lanes[laneId];
    let candidateUrl;
    setFocusedDeckId(deckId);
    updateDeck(deckId, (deck) => ({
      lanes: {
        ...deck.lanes,
        [laneId]: { ...deck.lanes[laneId], status: 'loading', name: file.name },
      },
    }));
    setNotice(`${laneId === 'fullMix' ? 'Analyzing' : 'Decoding'} ${file.name} locally...`);

    try {
      let analysis = null;
      if (laneId === 'fullMix') {
        const validBpm =
          Number.isFinite(cachedAnalysis?.bpm) &&
          cachedAnalysis.bpm >= 20 &&
          cachedAnalysis.bpm <= 400;
        const validKey = typeof cachedAnalysis?.key === 'string' && cachedAnalysis.key.trim();
        const complete =
          validBpm &&
          validKey &&
          Array.isArray(cachedAnalysis?.waveform) &&
          cachedAnalysis.waveform.length;
        analysis = complete ? { ...cachedAnalysis } : await analyzeAudioFile(file);
        // Library edits may contain only BPM or key; fill the remaining measured
        // data instead of propagating an undefined tempo / waveform into a deck.
        if (validBpm) analysis.bpm = cachedAnalysis.bpm;
        if (validKey) analysis.key = cachedAnalysis.key;
      }
      const asset = await putAudioAsset(file, { name: file.name, analysis });
      const oldUrl = objectUrlsRef.current.get(key);
      const url = (candidateUrl = URL.createObjectURL(file));
      const deck = decks.find((item) => item.id === deckId);
      const engine = getEngine();
      const duration = await engine.loadLane(deckId, deck.side, laneId, url);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      objectUrlsRef.current.set(key, url);
      candidateUrl = null;
      const laneState = {
        ...deck.lanes[laneId],
        assetId: asset.id,
        name: file.name,
        duration,
        status: 'ready',
      };
      engine.setLaneState(deckId, laneId, laneState);
      if (deck.stemFx[laneId]) engine.setLaneFx(deckId, laneId, deck.stemFx[laneId]);

      updateDeck(deckId, (currentDeck) => {
        const lane = {
          ...currentDeck.lanes[laneId],
          assetId: asset.id,
          name: file.name.replace(/\.[^/.]+$/, ''),
          duration,
          status: 'ready',
        };
        const updates = {
          playing: false,
          lanes: { ...currentDeck.lanes, [laneId]: lane },
          duration: Math.max(currentDeck.duration, duration),
        };
        if (laneId === 'fullMix') updates.arrangement = createArrangement(duration);
        if (analysis) {
          Object.assign(updates, {
            title: file.name.replace(/\.[^/.]+$/, ''),
            keyName: analysis.key.replace(' major', ' maj').replace(' minor', ' min'),
            sourceKeyName: analysis.key.replace(' major', ' maj').replace(' minor', ' min'),
            bpm: analysis.bpm,
            beatOffset: 0,
            followTempoMap: false,
            duration,
            waveform: analysis.waveform,
            analysis,
            loopStart: 0,
            loopEnd: Math.min(duration, (60 / analysis.bpm) * 4),
          });
          engine.setLoopRegion(
            deckId,
            currentDeck.looping,
            0,
            Math.min(duration, (60 / analysis.bpm) * 4)
          );
          engine.setPlaybackRate(deckId, currentDeck.synced ? masterBpm / analysis.bpm : 1);
        }
        return updates;
      });
      setNotice(`${file.name} is ready in Deck ${deckId}.`);
      trackSiteEvent('studio_imported');
      return true;
    } catch (error) {
      if (candidateUrl) URL.revokeObjectURL(candidateUrl);
      updateDeck(deckId, (deck) => ({
        lanes: {
          ...deck.lanes,
          [laneId]: previousLane || { ...deck.lanes[laneId], status: 'error' },
        },
      }));
      setNotice(error instanceof Error ? error.message : 'Audio could not be loaded.');
    } finally {
      pendingLoadsRef.current.delete(key);
    }
  };

  const loadLibraryTrack = async (track, file, target) => {
    if (!restored || projectPendingRef.current) {
      setNotice('Wait for your session to finish opening before loading a library song.');
      return null;
    }
    // Recheck after the library's asynchronous blob read; never overwrite a deck
    // that was loaded while the user was browsing or another import was running.
    const deck = latestDecksRef.current.find(
      (item) =>
        (target === 'auto' || item.id === target) &&
        !item.duration &&
        !Object.values(item.lanes).some((lane) => lane.status === 'loading' || lane.duration > 0) &&
        ![...pendingLoadsRef.current].some((key) => key.startsWith(`${item.id}:`))
    );
    if (!deck) {
      setNotice(
        'Choose an empty deck to load this song. Your existing tracks have not been replaced.'
      );
      return null;
    }
    return (await loadLane(deck.id, 'fullMix', file, track.analysis)) ? deck.id : null;
  };
  libraryLoaderRef.current = loadLibraryTrack;

  const loadStemSet = async (deckId, files) => {
    const audioFiles = files.filter((file) => file.type.startsWith('audio/') || !file.type);
    if (!audioFiles.length) return;
    setNotice(`Importing ${Math.min(audioFiles.length, 4)} separated stems into Deck ${deckId}...`);
    let imported = 0;
    for (const [index, file] of audioFiles.slice(0, 4).entries()) {
      if (await loadLane(deckId, stemIdForFile(file, index), file)) imported += 1;
    }
    if (imported === Math.min(audioFiles.length, 4)) {
      setNotice(`Stem set ready in Deck ${deckId}. Browser mode imported your separated files.`);
    } else {
      setNotice(
        `Imported ${imported} of ${Math.min(audioFiles.length, 4)} stems into Deck ${deckId}. Some files failed; retry the missing stems.`
      );
    }
  };

  const tempoForSync = (reference) => {
    const live = reference && getEngine().decks?.get(reference.id);
    const tempo = live?.playing ? reference.bpm * live.playbackRate : masterBpm;
    if (tempo !== masterBpm) setMasterBpm(tempo);
    return tempo;
  };

  const changeDeck = (deckId, updates) => {
    if (updates.masterDeck) {
      setMasterDeckId(deckId);
      const selected = decks.find((deck) => deck.id === deckId);
      if (selected?.duration)
        setMasterBpm(selected.bpm * (getEngine().decks?.get(deckId)?.playbackRate || 1));
      setNotice(`Deck ${deckId} is the sync master.`);
      return;
    }
    if (updates.alignBeat) {
      const selected = decks.find((deck) => deck.id === deckId);
      const reference = decks.find((deck) => deck.id === masterDeckId && deck.id !== deckId);
      void getEngine()
        .alignDeck(deckId, selected, reference, tempoForSync(reference))
        .then((aligned) => {
          if (!aligned) {
            setNotice(`Load audio into Deck ${deckId} before aligning beats.`);
            return;
          }
          updateDeck(deckId, { synced: true });
          setNotice(
            `Deck ${deckId} aligned to the ${reference?.playing ? 'master deck' : 'project clock'} beat grid. Check the grid by ear.`
          );
        })
        .catch((error) => setNotice(error.message));
      return;
    }
    const deck = decks.find((item) => item.id === deckId);
    if (!deck) return;
    const nextDeck = { ...deck, ...updates };
    const engine = getEngine();
    if ('gain' in updates) engine.setDeckGain(deckId, updates.gain);
    if ('fader' in updates) engine.setDeckFader(deckId, updates.fader);
    if ('cfSide' in updates) engine.setDeckSide(deckId, updates.cfSide);
    if ('eq' in updates) engine.setDeckEq(deckId, updates.eq);
    if ('filter' in updates) engine.setDeckFilter(deckId, updates.filter);
    if ('fx' in updates) engine.setDeckFx(deckId, updates.fx);
    if ('pitch' in updates) engine.setDeckPitch(deckId, updates.pitch);
    if ('keyLock' in updates) engine.setDeckKeyLock(deckId, updates.keyLock);
    if ('looping' in updates || 'loopStart' in updates || 'loopEnd' in updates) {
      engine.setLoopRegion(deckId, nextDeck.looping, nextDeck.loopStart, nextDeck.loopEnd);
    }
    if ('synced' in updates || 'bpm' in updates) {
      engine.setPlaybackRate(deckId, nextDeck.synced ? masterBpm / Math.max(1, nextDeck.bpm) : 1);
      engine.setDeckSync?.(
        deckId,
        nextDeck.synced && deckId !== masterDeckId,
        nextDeck,
        decks.find((item) => item.id === masterDeckId && item.id !== deckId)
      );
    }
    updateDeck(deckId, updates);
  };

  const changeLane = (deckId, laneId, updates) => {
    getEngine().setLaneState(deckId, laneId, updates);
    updateDeck(deckId, (deck) => ({
      lanes: { ...deck.lanes, [laneId]: { ...deck.lanes[laneId], ...updates } },
    }));
  };

  const changeStemFx = (deckId, stemId, updates) => {
    getEngine().setLaneFx(deckId, stemId, updates);
    if ('pitch' in updates) getEngine().setStemPitch(deckId, stemId, updates.pitch);
    updateDeck(deckId, (deck) => ({
      stemFx: {
        ...deck.stemFx,
        [stemId]: { ...deck.stemFx[stemId], ...updates },
      },
    }));
  };

  const toggleDeck = async (deckId) => {
    if (transportPendingRef.current) return;
    const deck = decks.find((item) => item.id === deckId);
    if (!deck) return;
    const engine = getEngine();
    transportPendingRef.current = true;
    try {
      if (deck.playing) {
        window.clearInterval(automixRef.current);
        engine.pauseDeck(deckId);
        updateDeck(deckId, { playing: false });
      } else if (
        await (deck.synced
          ? engine.alignDeck(
              deckId,
              deck,
              decks.find((item) => item.id === masterDeckId && item.id !== deckId),
              tempoForSync(decks.find((item) => item.id === masterDeckId && item.id !== deckId)),
              true
            )
          : engine.playDeck(deckId))
      ) {
        updateDeck(deckId, { playing: true });
      } else {
        setNotice(`Deck ${deckId} has no playable audio. Load a track first.`);
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Playback could not start. Check your audio output and try again.'
      );
    } finally {
      transportPendingRef.current = false;
    }
  };

  const cueDeck = (deckId) => {
    window.clearInterval(automixRef.current);
    const engine = getEngine();
    engine.stopDeck(deckId);
    engine.seekDeck(deckId, 0);
    updateDeck(deckId, { playing: false });
    setPositions((current) => ({ ...current, [deckId]: 0 }));
  };

  const toggleGlobalTransport = async () => {
    if (activeView === 'arranger' || arrangerPlaying) {
      await arrangerRef.current?.toggle();
      return;
    }
    if (transportPendingRef.current) return;
    transportPendingRef.current = true;
    try {
      const loaded = decks.filter((deck) => deck.duration);
      if (loaded.some((deck) => deck.playing)) {
        window.clearInterval(automixRef.current);
        getEngine().pauseAll();
        setDecks((current) => current.map((deck) => ({ ...deck, playing: false })));
        return;
      }
      const started = await getEngine().playAll();
      setDecks((current) =>
        current.map((deck) => ({ ...deck, playing: started.includes(deck.id) }))
      );
      if (!started.length) setNotice('Load a track before starting playback.');
    } catch (error) {
      getEngine().pauseAll();
      setDecks((current) => current.map((deck) => ({ ...deck, playing: false })));
      setNotice(
        error instanceof Error
          ? error.message
          : 'Playback could not start. Check your audio output and try again.'
      );
    } finally {
      transportPendingRef.current = false;
    }
  };

  const setHotCue = (deckId, index, seconds) => {
    const deck = decks.find((item) => item.id === deckId);
    if (deck.hotCues[index] !== null) {
      getEngine().seekDeck(deckId, seconds);
      setPositions((current) => ({ ...current, [deckId]: seconds }));
      return;
    }
    updateDeck(deckId, (current) => {
      const hotCues = [...current.hotCues];
      hotCues[index] = seconds;
      return { hotCues };
    });
  };

  const deleteHotCue = (deckId, index) => {
    updateDeck(deckId, (deck) => {
      const hotCues = [...deck.hotCues];
      hotCues[index] = null;
      return { hotCues };
    });
  };

  const setDeckLoop = (deckId, enabled, start, end, roll = null) => {
    const deck = decks.find((item) => item.id === deckId);
    const beat = 60 / Math.max(1, deck.bpm);
    const rollLength = roll ? beat * Number(roll.split('/').reduce((a, b) => a / b)) : null;
    const loopStart = Math.max(0, start || 0);
    const loopEnd = Math.min(deck.duration || Infinity, rollLength ? loopStart + rollLength : end);
    getEngine().setLoopRegion(deckId, enabled, loopStart, loopEnd);
    updateDeck(deckId, { looping: enabled, loopStart, loopEnd });
  };

  const beatJump = (deckId, beats) => {
    const deck = decks.find((item) => item.id === deckId);
    const seconds = Math.max(0, (positions[deckId] || 0) + beats * (60 / Math.max(1, deck.bpm)));
    getEngine().seekDeck(deckId, seconds);
    setPositions((current) => ({ ...current, [deckId]: seconds }));
  };

  const extractPattern = (deckId, kind) => {
    const deck = decks.find((item) => item.id === deckId);
    const pattern = migrateArrangement({
      decks: [],
      pianoNotes: buildMidiPattern(kind, deck.bpm),
      masterBpm: deck.bpm,
    });
    setArranger((current) => ({ ...current, tracks: [...current.tracks, ...pattern.tracks] }));
    setActiveView('arranger');
    setNotice(
      `${kind === 'drums' ? 'Drum' : 'Pitch'} instrument template created at Deck ${deckId}'s tempo. This is a playable template, not audio-to-MIDI transcription.`
    );
  };

  const triggerPad = async (index) => {
    const pad = pads[index];
    setActivePad(index);
    window.setTimeout(() => setActivePad(null), 150);
    try {
      await getEngine().triggerPad(index, pad.frequency);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'The pad could not play. Check your audio output.'
      );
    }
  };

  const loadPad = async (index, file) => {
    if (!file) return;
    if (projectPendingRef.current) {
      setNotice('Wait for the project to finish opening.');
      return;
    }
    const key = `pad:${index}`;
    if (pendingLoadsRef.current.has(key)) {
      setNotice('Wait for this pad to finish loading.');
      return;
    }
    pendingLoadsRef.current.add(key);
    let candidateUrl;
    try {
      const asset = await putAudioAsset(file, { name: file.name });
      const oldUrl = objectUrlsRef.current.get(key);
      const url = (candidateUrl = URL.createObjectURL(file));
      await getEngine().loadPad(index, url, pads[index].gain);
      getEngine().capturePerformanceEvent?.('padSource', [
        index,
        { assetId: asset.id },
        pads[index].gain,
      ]);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      objectUrlsRef.current.set(key, url);
      candidateUrl = null;
      setPads((current) =>
        current.map((pad, padIndex) =>
          padIndex === index
            ? { ...pad, assetId: asset.id, name: file.name.replace(/\.[^/.]+$/, '') }
            : pad
        )
      );
      setNotice(`${file.name} loaded on Pad ${index + 1}.`);
    } catch (error) {
      if (candidateUrl) URL.revokeObjectURL(candidateUrl);
      setNotice(error instanceof Error ? error.message : 'Pad sample could not be loaded.');
    } finally {
      pendingLoadsRef.current.delete(key);
    }
  };

  const changePadGain = (index, gain) => {
    getEngine().setPadGain(index, gain);
    setPads((current) =>
      current.map((pad, padIndex) => (padIndex === index ? { ...pad, gain } : pad))
    );
  };

  const toggleCapture = async () => {
    if (projectPendingRef.current) {
      setNotice('Wait for the project to finish opening.');
      return;
    }
    if (unsavedRecordingRef.current) {
      setNotice('Download and confirm your unsaved take before recording again.');
      return;
    }
    if (capturePendingRef.current) return;
    setCaptureBusy(true);
    capturePendingRef.current = true;
    try {
      if (!captureActive) {
        captureTimelineStartRef.current =
          activeView === 'arranger' ? arrangerRef.current?.getPosition?.() || 0 : 0;
        await getEngine().startRecording({
          sources: captureSeparateSources,
          longSession,
          timelineStart: captureTimelineStartRef.current,
        });
        getEngine().capturePerformanceEvent?.('initialState', [
          {
            decks: decks.map((deck) => ({
              ...deck,
              position: getEngine().getDeckPosition?.(deck.id) || 0,
              playbackRate: getEngine().decks?.get(deck.id)?.playbackRate || 1,
              gain: getEngine().decks?.get(deck.id)?.gain ?? deck.gain,
              fader: getEngine().decks?.get(deck.id)?.fader ?? deck.fader,
              lanes: Object.fromEntries(
                Object.entries(deck.lanes).map(([id, lane]) => {
                  const actual = getEngine().decks?.get(deck.id)?.lanes.get(id);
                  return [
                    id,
                    {
                      ...lane,
                      ...(actual
                        ? {
                            level: actual.level,
                            muted: actual.muted,
                            solo: actual.solo,
                            filter: actual.filter,
                            send: actual.send,
                            pitch: actual.pitch,
                          }
                        : {}),
                    },
                  ];
                })
              ),
              playing: !!getEngine().decks?.get(deck.id)?.playing,
            })),
            dspVersion: 2,
            clockVersion: 1,
            sampleRate: engineRef.current.getAudioContext().rawContext.sampleRate,
            inputCaptureVersion: 1,
            inputState: engineRef.current.getInputState(),
            transportVersion: 2,
            pads,
            masterBpm,
            masterLevel,
            masterProcessing,
            crossfader,
            crossfaderCurve,
            limiter,
            aiMaster,
            aiMasterMode,
          },
        ]);
        setCaptureActive(true);
        setRecordingHealth(null);
        setNotice(
          getEngine().capturedSources?.()?.error ||
            (captureSeparateSources
              ? 'Recording master safety mix and separate connected sources. Finish connecting sources before starting a take.'
              : 'Master recording started.')
        );
        return;
      }
      const blob = await getEngine().stopRecording();
      setCaptureActive(false);
      const sourceCapture = getEngine().capturedSources?.();
      if (!blob && !sourceCapture?.tracks?.length) return;
      const extension = !blob
        ? 'wav chunks'
        : blob.type.includes('mp4')
          ? 'm4a'
          : blob.type.includes('ogg')
            ? 'ogg'
            : 'webm';
      const name = `${sessionName} take ${recordings.length + 1}.${extension}`;
      if (blob) unsavedRecordingRef.current = { blob, name };
      const asset = blob ? await putAudioAsset(blob, { name, type: blob.type }) : { id: '' };
      unsavedRecordingRef.current = null;
      if (blob)
        setRecordings((current) => [
          ...current,
          { id: asset.id, name, createdAt: asset.createdAt, size: asset.size },
        ]);
      // Event history and durable source chunks must survive even when this
      // browser cannot decode the master recorder's compressed container.
      const events = structuredClone(getEngine().capturedPerformance?.() || []);
      const captureDuration =
        getEngine().lastRecordingDuration ||
        events.reduce((end, event) => Math.max(end, event.time), 0);
      const journal = getEngine().performanceJournal;
      await journal?.attach({ assetId: asset.id, name, duration: captureDuration }).catch(() => {});
      const sourceTracks = (sourceCapture?.tracks || []).map((row) => ({
        ...row,
        name: `${name} · ${row.name}`,
        muted: true,
        offline: true,
      }));
      setArranger((current) => ({
        ...current,
        tracks: [
          ...current.tracks,
          ...sourceTracks.map((row) =>
            !blob &&
            row.role === 'reference' &&
            !current.tracks.some((t) => !t.muted && !t.offline && t.clips.length)
              ? { ...row, muted: false, offline: false }
              : row
          ),
        ],
        captures: [
          ...current.captures,
          {
            version: 3,
            id: journal?.take?.id,
            sourceCaptureId: sourceCapture?.id,
            assetId: asset.id,
            name,
            duration: captureDuration,
            timelineStart: captureTimelineStartRef.current,
            events,
            originalEvents: structuredClone(events),
          },
        ],
      }));
      if (!blob) {
        setNotice(
          `Performance captured · ${Math.round(captureDuration)}s · ${sourceTracks.length} lanes · ${events.filter((event) => event.type !== 'initialState').length} recorded actions. Open performance in Arrange; master safety audio is preserved. ${sourceCapture?.error || getEngine().recordingFault || ''}`
        );
        return;
      }
      try {
        const buffer = await getEngine()
          .getAudioContext()
          .rawContext.decodeAudioData(await blob.arrayBuffer());
        const track = audioTrack(name);
        track.role = 'reference';
        track.clips.push({
          ...audioClip(asset.id, name, buffer.duration, captureTimelineStartRef.current),
          waveform: createWaveformPeaks(buffer.getChannelData(0), 2048),
        });
        setArranger((current) => ({
          ...current,
          tracks: [
            ...current.tracks.map((row) =>
              row.role === 'reference' ? { ...row, muted: true } : row
            ),
            {
              ...track,
              muted: current.tracks.some(
                (row) => row.role !== 'reference' && !row.muted && row.clips.length
              ),
            },
          ],
          captures: current.captures.map((capture) =>
            capture.assetId === asset.id ? { ...capture, duration: buffer.duration } : capture
          ),
        }));
        setNotice(
          sourceTracks.length
            ? `${name} saved with ${sourceTracks.length} aligned source lanes (offline and muted) and a master safety reference. Enable chosen lanes in Track options, then unmute or comp them; avoid doubling the reference. Deck FX are printed. ${sourceCapture.error || ''}`
            : `${name} saved as an editable printed reference. ${sourceCapture?.error || 'This lane bypasses repeated master processing.'}`
        );
      } catch {
        setNotice(
          `${name} saved. This browser could not decode the take for editing; download it from Recordings.`
        );
      }
    } catch (error) {
      setCaptureActive(false);
      if (unsavedRecordingRef.current) {
        const { blob, name } = unsavedRecordingRef.current;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        setNotice(
          'Local storage could not save your take. An emergency download was requested; confirm it completed before closing this page.'
        );
      } else setNotice(error instanceof Error ? error.message : 'Recording is unavailable.');
    } finally {
      capturePendingRef.current = false;
      setCaptureBusy(false);
    }
  };

  const toggleMicrophone = async () => {
    try {
      if (microphoneActive) {
        getEngine().closeMicrophone();
        setMicrophoneActive(false);
        setNotice('Live input disconnected.');
      } else {
        setSourceChooserOpen(true);
      }
    } catch {
      setNotice('Microphone permission was not granted.');
    }
  };

  const toggleMidi = async () => {
    if (midiActive) {
      midiAccessRef.current?.inputs?.forEach((input) => {
        input.onmidimessage = null;
      });
      setMidiActive(false);
      setNotice('MIDI input disconnected.');
      return;
    }
    if (!navigator.requestMIDIAccess) {
      setNotice('Web MIDI is unavailable in this browser.');
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      midiAccessRef.current = access;
      access.inputs.forEach((input) => {
        input.onmidimessage = ({ data }) => {
          const [status, note, velocity] = data;
          if ((status & 0xf0) === 0x90 && velocity > 0) void triggerPad(note % pads.length);
        };
      });
      setMidiActive(true);
      setNotice(
        `${access.inputs.size || 0} MIDI input${access.inputs.size === 1 ? '' : 's'} connected.`
      );
    } catch {
      setNotice('MIDI access was not granted.');
    }
  };

  const tapTempo = () => {
    const now = performance.now();
    tapTimesRef.current = [...tapTimesRef.current.filter((time) => now - time < 2500), now].slice(
      -6
    );
    if (tapTimesRef.current.length < 2) {
      setNotice('Tap again to set the host tempo.');
      return;
    }
    const intervals = tapTimesRef.current
      .slice(1)
      .map((time, index) => time - tapTimesRef.current[index]);
    const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    setMasterBpm(Math.round(Math.min(220, Math.max(40, 60000 / average))));
  };

  const syncAll = () => {
    const reference = decks.find((item) => item.id === masterDeckId);
    const tempo = tempoForSync(reference);
    // Joining the project clock at its CURRENT audible tempo preserves the
    // leader, while allowing subsequent project BPM edits to move the whole set.
    if (reference?.duration) updateDeck(reference.id, { synced: true });
    void Promise.all(
      decks
        .filter((deck) => deck.duration && deck.id !== masterDeckId)
        .map(async (deck) => {
          const aligned = await getEngine().alignDeck(deck.id, deck, reference, tempo);
          if (aligned) updateDeck(deck.id, { synced: true });
          return aligned;
        })
    )
      .then(() =>
        setNotice(
          `Followers aligned to ${tempo.toFixed(1)} BPM; leader position preserved. Verify each beat grid.`
        )
      )
      .catch((error) => setNotice(error.message));
  };

  const syncKey = () => {
    const master = decks.find((deck) => deck.id === masterDeckId);
    const masterKey = keyPitchClass(master?.sourceKeyName || master?.keyName);
    const selectedKey = keyPitchClass(projectKey);
    if (projectKey === 'Off' && (!master?.duration || masterKey === undefined)) {
      setNotice('Load the sync master before matching keys.');
      return;
    }
    const target = selectedKey ?? (masterKey + master.pitch + 12) % 12;
    const targetLabel = projectKey === 'Off' ? master.keyName : projectKey;
    setDecks((current) =>
      current.map((deck) => {
        if (!deck.duration) return deck;
        const sourceKey = keyPitchClass(deck.sourceKeyName || deck.keyName);
        if (sourceKey === undefined) return deck;
        const pitch = nearestSemitoneShift(sourceKey, target);
        getEngine().setDeckPitch(deck.id, pitch);
        getEngine().setDeckKeyLock(deck.id, true);
        return { ...deck, pitch, keyLock: true };
      })
    );
    setNotice(`Loaded decks harmonically matched to ${targetLabel} without changing tempo.`);
  };

  const toggleAllKeyLock = () => {
    const enabled = !decks.every((deck) => deck.keyLock);
    setDecks((current) =>
      current.map((deck) => {
        getEngine().setDeckKeyLock(deck.id, enabled);
        return { ...deck, keyLock: enabled };
      })
    );
    setNotice(`Pitch lock ${enabled ? 'enabled' : 'disabled'} for every deck.`);
  };

  const startAutomix = async () => {
    if (transportPendingRef.current) return;
    window.clearInterval(automixRef.current);
    const loaded = decks.filter((deck) => deck.duration);
    if (loaded.length < 2) {
      setNotice('Load at least two decks to run AutoMix.');
      return;
    }
    const [source, target] = loaded;
    transportPendingRef.current = true;
    try {
      if (!(await getEngine().playDeck(source.id)) || !(await getEngine().playDeck(target.id))) {
        throw new Error('AutoMix needs two decks with playable audio. Reload the missing track.');
      }
      changeDeck(source.id, { playing: true, cfSide: 'left' });
      changeDeck(target.id, { playing: true, cfSide: 'right' });
      let value = crossfaderReverse ? 100 : 0;
      const destination = crossfaderReverse ? 0 : 100;
      const direction = destination > value ? 1 : -1;
      setCrossfader(value);
      automixRef.current = window.setInterval(() => {
        value = direction > 0 ? Math.min(destination, value + 2) : Math.max(destination, value - 2);
        setCrossfader(Math.min(100, Math.max(0, value)));
        if (value === destination) {
          window.clearInterval(automixRef.current);
        }
      }, 90);
    } catch (error) {
      getEngine().pauseAll();
      setDecks((current) => current.map((deck) => ({ ...deck, playing: false })));
      setNotice(error instanceof Error ? error.message : 'AutoMix could not start.');
    } finally {
      transportPendingRef.current = false;
    }
  };

  const updateMasterFx = (x, y) => {
    const next = { x: Math.round(x), y: Math.round(y) };
    setMasterFx(next);
    setDecks((current) =>
      current.map((deck) => {
        const fx = { ...deck.fx, echo: next.x, reverb: 100 - next.y };
        getEngine().setDeckFx(deck.id, fx);
        return { ...deck, fx };
      })
    );
  };

  const downloadRecording = async (recording) => {
    try {
      const asset = await getAudioAsset(recording.id);
      if (!asset?.blob)
        throw new Error('Recording audio is missing from local storage. Restore it from a backup.');
      const url = URL.createObjectURL(asset.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = recording.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Recording download failed.');
    }
  };

  const exportSession = async () => {
    if (
      projectPendingRef.current ||
      pendingLoadsRef.current.size ||
      capturePendingRef.current ||
      captureActive
    ) {
      setNotice('Finish importing and stop the recording before saving a portable project.');
      return;
    }
    try {
      projectPendingRef.current = true;
      setNotice('Packing the project and its audio for transfer...');
      const assetIds = [
        ...decks.flatMap((deck) => Object.values(deck.lanes).map((lane) => lane.assetId)),
        ...pads.map((pad) => pad.assetId),
        ...recordings.map((recording) => recording.id),
        ...arranger.tracks.flatMap((track) => track.clips.map((clip) => clip.assetId)),
        ...arranger.captures.map((capture) => capture.assetId),
        ...performanceAssetIds(arranger.captures),
      ];
      const manifest = {
        schema: 'SattariStudio.project.v5',
        product: 'Sattari Studio',
        sessionName,
        createdAt: new Date().toISOString(),
        master: {
          bpm: masterBpm,
          projectKey,
          level: masterLevel,
          processing: masterProcessing,
          crossfader,
          crossfaderCurve,
          crossfaderReverse,
          limiter,
          aiMaster,
          aiMasterMode,
        },
        decks,
        pads,
        recordings,
        pianoNotes,
        arranger,
        source: transfer || null,
      };
      const blob = await writeProjectArchive(manifest, assetIds, setNotice);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sattari-session'}.sattari`;
      anchor.click();
      trackSiteEvent('studio_exported');
      window.setTimeout(() => {
        URL.revokeObjectURL(url);
        void clearExportFile(blob).catch(() => {});
      }, 60000);
      setNotice(
        `Portable project saved with ${new Set(assetIds.filter(Boolean)).size} audio assets.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Project could not be saved.');
    } finally {
      projectPendingRef.current = false;
    }
  };

  const importSession = async (file) => {
    if (!file) return;
    if (projectPendingRef.current) {
      setNotice('Wait for the project to finish opening.');
      return;
    }
    if (captureActive || capturePendingRef.current || pendingLoadsRef.current.size) {
      setNotice('Finish loading and stop the recording before opening another project.');
      return;
    }
    projectPendingRef.current = true;
    try {
      const manifest = await readProjectArchive(file);
      if (
        ![
          'SattariStudio.project.v2',
          'SattariStudio.project.v3',
          'SattariStudio.project.v4',
          'SattariStudio.project.v5',
          'SattariStudio.project.v6',
        ].includes(manifest?.schema) ||
        !Array.isArray(manifest.decks) ||
        manifest.decks.length > DECK_SEEDS.length ||
        (manifest.pads != null && !Array.isArray(manifest.pads)) ||
        (manifest.recordings != null && !Array.isArray(manifest.recordings)) ||
        (manifest.pianoNotes != null && !Array.isArray(manifest.pianoNotes))
      )
        throw new Error('Not a Sattari Studio project.');
      validateStudioProject(manifest);
      if (
        !window.confirm(
          'Open this project and replace the current session? Download a backup with Save project first if needed.'
        )
      )
        return;
      setNotice('Opening project and restoring audio…');
      const importedIds = await importAudioAssets(manifest.assets || []);
      for (const deck of manifest.decks)
        for (const lane of Object.values(deck?.lanes || {})) {
          if (lane && importedIds.has(lane.assetId)) lane.assetId = importedIds.get(lane.assetId);
        }
      for (const pad of manifest.pads || [])
        if (pad && importedIds.has(pad.assetId)) pad.assetId = importedIds.get(pad.assetId);
      for (const recording of manifest.recordings || [])
        if (recording && importedIds.has(recording.id))
          recording.id = importedIds.get(recording.id);
      if (manifest.arranger) {
        for (const pattern of Object.values(manifest.arranger.patterns || {}))
          if (importedIds.has(pattern.assetId)) pattern.assetId = importedIds.get(pattern.assetId);
        for (const track of manifest.arranger.tracks)
          for (const clip of track.clips)
            if (importedIds.has(clip.assetId)) clip.assetId = importedIds.get(clip.assetId);
        for (const capture of manifest.arranger.captures)
          if (importedIds.has(capture.assetId)) capture.assetId = importedIds.get(capture.assetId);
        relinkPerformanceAssets(manifest.arranger.captures, importedIds);
      }
      arrangerRef.current?.reset();
      const nextDecks = DECK_SEEDS.map((_, index) => normalizeDeck(manifest.decks?.[index], index));
      const nextPads = createPads(manifest.pads || []);
      window.clearInterval(automixRef.current);
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
      engineRef.current?.dispose();
      engineRef.current = null;
      const hydrated = await hydrateAudio(
        nextDecks,
        nextPads,
        () => false,
        manifest.master?.bpm || 120
      );
      setDecks(hydrated);
      setArranger(migrateArrangement({ ...manifest, decks: hydrated }));
      setMicrophoneActive(false);
      setPads(nextPads);
      setSessionName(manifest.sessionName || 'Imported session');
      setMasterBpm(clampNumber(manifest.master?.bpm ?? 120, 40, 240));
      setProjectKey(manifest.master?.projectKey || 'Off');
      setMasterLevel(manifest.master?.level ?? 100);
      setMasterProcessing(normalizeMasterProcessing(manifest.master?.processing));
      setCrossfader(manifest.master?.crossfader ?? 50);
      setCrossfaderCurve(manifest.master?.crossfaderCurve || 'Smooth');
      setCrossfaderReverse(manifest.master?.crossfaderReverse ?? false);
      setLimiter(manifest.master?.limiter ?? true);
      setAiMaster(manifest.master?.aiMaster ?? false);
      setAiMasterMode(manifest.master?.aiMasterMode || 'Streaming -14');
      setPianoNotes(manifest.pianoNotes || []);
      setRecordings(manifest.recordings || []);
      setTransfer(manifest.source || null);
      setRestored(true);
      setNotice(
        manifest.assets?.length
          ? `${file.name} imported with ${manifest.assets.length} embedded audio assets.`
          : `${file.name} imported. Reconnect audio files that are not stored on this device.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Project could not be imported.');
    } finally {
      projectPendingRef.current = false;
    }
  };

  const importDeckSet = async (files) => {
    const available = decks.filter(
      (deck) =>
        !deck.duration && !Object.values(deck.lanes).some((lane) => lane.status === 'loading')
    );
    if (!available.length) {
      setNotice(
        'All four decks are occupied. Click a deck title to replace its track, or save and start a new session.'
      );
      return;
    }
    for (const [index, file] of files.slice(0, available.length).entries()) {
      await loadLane(available[index].id, 'fullMix', file);
    }
    if (files.length > available.length)
      setNotice(
        `Loaded up to ${available.length} files. The remaining files were not imported because all decks are occupied.`
      );
  };

  const newSession = async () => {
    if (projectPendingRef.current) {
      setNotice('Wait for the project to finish opening.');
      return;
    }
    if (captureActive || capturePendingRef.current || pendingLoadsRef.current.size) {
      setNotice('Finish loading and stop the recording before starting a new session.');
      return;
    }
    if (!window.confirm('Start a new session? Local audio assets will remain available.')) return;
    projectPendingRef.current = true;
    try {
      await sessionSaver.current.flush();
      await persistentSessionRef.current.clear();
    } catch (error) {
      setNotice(error.message);
      return;
    } finally {
      projectPendingRef.current = false;
    }
    window.clearInterval(automixRef.current);
    arrangerRef.current?.reset();
    setArranger(emptyArrangement());
    engineRef.current?.stopAll();
    engineRef.current?.dispose();
    engineRef.current = null;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    setRestored(true);
    setDecks(createEmptyDecks());
    setPads(createPads());
    setPositions({ A: 0, B: 0, C: 0, D: 0 });
    setDeckMeters({ A: 0, B: 0, C: 0, D: 0 });
    setSessionName('Untitled session');
    setTransfer(null);
    setRecordings([]);
    setPianoNotes([]);
    setCrossfader(50);
    setMasterLevel(100);
    setMasterProcessing({ ...DEFAULT_MASTER_PROCESSING });
    setAiMaster(false);
    setMasterBpm(120);
    setProjectKey('Off');
    setFocusedDeckId('A');
    setLimiter(true);
    setMicrophoneActive(false);
    setCaptureActive(false);
    setNotice('New Sattari Stemdeck session ready.');
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (
        /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(event.target.tagName) ||
        event.target.isContentEditable ||
        event.repeat
      )
        return;
      const padIndex = ['1', '2', '3', '4', '5', '6', '7', '8'].indexOf(event.key);
      if (padIndex >= 0) {
        event.preventDefault();
        void triggerPad(padIndex);
      }
      if (event.code === 'Space') {
        event.preventDefault();
        void toggleGlobalTransport();
      }
      if (activeView === 'arranger' && (event.metaKey || event.ctrlKey) && event.key === 'z') {
        event.preventDefault();
        arrangerRef.current?.undo(event.shiftKey);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

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
  const anyPlaying = arrangerPlaying || decks.some((deck) => deck.playing);
  const arrangementTransport = activeView === 'arranger' || arrangerPlaying;
  const transportPlaying = arrangementTransport ? arrangerPlaying : anyPlaying;
  const transportAvailable = arrangementTransport
    ? arranger.tracks.some((track) => track.clips.length > 0)
    : loadedDecks.length > 0;
  const masterMeter = Math.max(0, ...Object.values(deckMeters));

  const focusedDeck = decks.find((deck) => deck.id === focusedDeckId) || decks[0];
  const performanceDecks = [
    focusedDeck,
    ...loadedDecks.filter((deck) => deck.id !== focusedDeck.id),
  ].slice(0, 2);
  const coachMessage = !loadedDecks.length
    ? 'Drop a track to begin'
    : anyPlaying
      ? 'Playing'
      : 'Ready to play';

  const deckConsole = (
    <section className="sd-performance-stage" aria-label="Performance sources">
      {loadedDecks.length ? (
        <div className="sd-focused-deck">
          <div className="sd-decks-grid" data-deck-count={performanceDecks.length}>
            {performanceDecks.map((focusedDeck) => (
              <StemDeckChannel
                key={focusedDeck.id}
                deck={focusedDeck}
                position={positions[focusedDeck.id] || 0}
                meterLevel={deckMeters[focusedDeck.id] || 0}
                onLoadLane={(laneId, file) => loadLane(focusedDeck.id, laneId, file)}
                onLoadStemSet={(files) => loadStemSet(focusedDeck.id, files)}
                onDeckChange={(updates) => changeDeck(focusedDeck.id, updates)}
                onLaneChange={(laneId, updates) => changeLane(focusedDeck.id, laneId, updates)}
                onTogglePlay={() => toggleDeck(focusedDeck.id)}
                onCue={() => cueDeck(focusedDeck.id)}
                onSeek={(seconds) => getEngine().seekDeck(focusedDeck.id, seconds)}
                onSetHotCue={(index, seconds) => setHotCue(focusedDeck.id, index, seconds)}
                onDeleteHotCue={(index) => deleteHotCue(focusedDeck.id, index)}
                onSetLoop={(enabled, start, end, roll) =>
                  setDeckLoop(focusedDeck.id, enabled, start, end, roll)
                }
                onBeatJump={(beats) => beatJump(focusedDeck.id, beats)}
                onStemFxChange={(stemId, updates) => changeStemFx(focusedDeck.id, stemId, updates)}
                onExtractMidi={() => extractPattern(focusedDeck.id, 'midi')}
                onExtractDrums={() => extractPattern(focusedDeck.id, 'drums')}
              />
            ))}
          </div>
          <button
            type="button"
            className="sd-source-dock"
            aria-label="Add source"
            onClick={() => setSourceChooserOpen(true)}
          >
            <Plus size={24} />
            <strong>SOURCE</strong>
          </button>
        </div>
      ) : (
        <div
          className="sd-empty-performance"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = [...event.dataTransfer.files].find((item) =>
              item.type.startsWith('audio/')
            );
            if (file) void loadLane(focusedDeck.id, 'fullMix', file);
          }}
        >
          <button
            type="button"
            className="sd-empty-source-cta"
            aria-label="Add source"
            onClick={() => setSourceChooserOpen(true)}
          >
            <span className="sd-empty-instrument" aria-hidden="true">
              {['VOX', 'DRM', 'BAS', 'OTH'].map((name, index) => (
                <span
                  key={name}
                  style={{ '--lane-color': ['#d4537e', '#4a9eff', '#4ad9c4', '#888780'][index] }}
                >
                  <b>{name}</b>
                  <svg viewBox="0 0 64 140">
                    <path d="M32 4 L32 25 L26 33 L38 39 L18 48 L44 56 L12 64 L50 72 L19 80 L42 89 L27 98 L35 107 L32 116 L32 136" />
                  </svg>
                  <i />
                </span>
              ))}
            </span>
            <em>YOUR LIVE WORKSPACE</em>
            <strong>Your next set starts here.</strong>
            <small>Drop a track, shape the stems, and capture the moment.</small>
            <span className="sd-import-action">
              <Plus size={16} /> Add Source
            </span>
            <small className="sd-import-hint">
              Mic, input, or track · Everything stays on this device
            </small>
          </button>
        </div>
      )}
    </section>
  );

  const masterConsole = (
    <StudioPanel
      panelId="performance-mixer"
      label="Mixer & effects"
      className="sd-master-console"
      aria-label="STEMDECK master section"
    >
      <div className="sd-mixer-module">
        <span className="sd-module-title">MIXER</span>
        <div className="sd-power-row">
          <button type="button" onClick={syncAll}>
            BPM SYNC
          </button>
          <button type="button" onClick={syncKey}>
            KEY SYNC
          </button>
          <button
            type="button"
            className={aiMaster ? 'is-active' : ''}
            onClick={() => setAiMaster((value) => !value)}
          >
            MASTER ASSIST
          </button>
          <select
            value={aiMasterMode}
            onChange={(event) => setAiMasterMode(event.target.value)}
            aria-label="Master assist target"
          >
            <option>Streaming -14</option>
            <option>Club -9</option>
            <option>Broadcast -16</option>
          </select>
          <button
            type="button"
            className={limiter ? 'is-active' : ''}
            onClick={() => setLimiter((value) => !value)}
          >
            LIMIT
          </button>
        </div>
        <div className="sd-xf-workarea">
          <div className="sd-meter-stack">
            {[decks[0], decks[2]].map((deck) => (
              <SegmentMeter
                key={deck.id}
                level={deckMeters[deck.id] || 0}
                accent={deck.accent}
                label={deck.id}
                compact
              />
            ))}
          </div>
          <div className="sd-xf-center">
            <div className="sd-xf-options">
              <select
                value={crossfaderCurve}
                onChange={(event) => setCrossfaderCurve(event.target.value)}
                aria-label="Crossfader curve"
              >
                <option>Smooth</option>
                <option>Sharp</option>
                <option>Linear</option>
              </select>
              <button
                type="button"
                className={crossfaderReverse ? 'is-active' : ''}
                onClick={() => setCrossfaderReverse((value) => !value)}
              >
                REV
              </button>
            </div>
            <div className="sd-crossfader-labels">
              <span>A / C</span>
              <strong>CROSSFADER</strong>
              <span>B / D</span>
            </div>
            <input
              className="sd-crossfader"
              type="range"
              min="0"
              max="100"
              value={crossfader}
              onChange={(event) => setCrossfader(Number(event.target.value))}
              aria-label="Crossfader"
            />
          </div>
          <div className="sd-meter-stack">
            {[decks[1], decks[3]].map((deck) => (
              <SegmentMeter
                key={deck.id}
                level={deckMeters[deck.id] || 0}
                accent={deck.accent}
                label={deck.id}
                compact
              />
            ))}
          </div>
        </div>
      </div>

      <div className="sd-global-fx-module">
        <span className="sd-module-title">GLOBAL FX</span>
        <button
          type="button"
          className="sd-xy-pad"
          aria-label="Global effects XY pad"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const box = event.currentTarget.getBoundingClientRect();
            updateMasterFx(
              ((event.clientX - box.left) / box.width) * 100,
              ((event.clientY - box.top) / box.height) * 100
            );
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            const box = event.currentTarget.getBoundingClientRect();
            updateMasterFx(
              ((event.clientX - box.left) / box.width) * 100,
              ((event.clientY - box.top) / box.height) * 100
            );
          }}
        >
          <i style={{ left: `${masterFx.x}%`, top: `${masterFx.y}%` }} />
          <span>ECHO</span>
          <span>SPACE</span>
        </button>
      </div>

      <div className="sd-master-output">
        <span className="sd-module-title">MASTER OUTPUT</span>
        <div className="sd-output-controls">
          <VerticalFader
            label="OUT"
            value={masterLevel}
            onChange={setMasterLevel}
            accent="#edf0f4"
          />
          <SegmentMeter level={masterMeter} accent="#62f5c8" label="OUT" />
          <div className="sd-tempo-column">
            <div className="sd-global-tempo">
              <small>GLOBAL TEMPO</small>
              <strong>{masterBpm.toFixed(1)}</strong>
              <i />
            </div>
            <div>
              <button type="button" onClick={tapTempo}>
                TAP
              </button>
              <button
                type="button"
                className={decks.every((deck) => deck.keyLock) ? 'is-active' : ''}
                onClick={toggleAllKeyLock}
              >
                KEY LOCK
              </button>
            </div>
          </div>
        </div>
      </div>
    </StudioPanel>
  );

  const masterRail = (
    <MasterOutput
      compact={false}
      visible={inspector === 'master'}
      getEngine={getEngine}
      settings={masterProcessing}
      onSettings={setMasterProcessing}
      level={masterLevel}
      onLevel={setMasterLevel}
      limiter={limiter}
      onLimiter={setLimiter}
      compression={aiMaster}
      onCompression={setAiMaster}
      captureActive={captureActive}
    />
  );

  const padStrip = (
    <StudioPanel
      panelId="pads"
      label="Performance pads"
      className="sd-pad-strip"
      aria-label="Performance pads"
    >
      <header>
        <span>PERFORMANCE PADS</span>
        <strong>BANK A</strong>
      </header>
      <div className="sd-pads">
        {pads.map((pad, index) => (
          <div
            className="sd-pad-cell"
            key={`${index}-${pad.name}`}
            style={{ '--sd-accent': pad.accent }}
          >
            <button
              type="button"
              className={activePad === index ? 'is-hit' : ''}
              onClick={() => triggerPad(index)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{pad.name}</strong>
            </button>
            <div>
              <button
                type="button"
                onClick={() => padInputRefs.current[index]?.click()}
                aria-label={`Load Pad ${index + 1}`}
              >
                <Plus size={11} />
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={pad.gain}
                onChange={(event) => changePadGain(index, Number(event.target.value))}
                aria-label={`Pad ${index + 1} gain`}
              />
            </div>
            <input
              ref={(element) => {
                padInputRefs.current[index] = element;
              }}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => {
                void loadPad(index, event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </div>
        ))}
      </div>
    </StudioPanel>
  );

  return (
    <>
      <SEO {...PAGE_SEO.studio} />
      <StructuredData
        data={musicToolSchema('studio', [
          'Deck mixing',
          'Audio recording',
          'MIDI instruments',
          'Multitrack arrangement',
          'WAV export',
        ])}
      />
      <PanelLayoutProvider workspace={activeView}>
        <section
          className="stemdeck-web sd-studio-next sd-session-shell"
          data-compact-icons={compactIcons}
        >
          {sourceChooserOpen && (
            <SourceChooser
              inputActive={microphoneActive}
              onClose={() => setSourceChooserOpen(false)}
              onTrack={() => {
                setSourceChooserOpen(false);
                deckImportRef.current?.click();
              }}
              onConnect={async (deviceId, label) => {
                await getEngine().openMicrophone(deviceId);
                setMicrophoneActive(true);
                setInspector('input');
                setNotice(
                  `${label} connected safely. Arm recording and enable monitoring separately in the Input strip.`
                );
              }}
            />
          )}
          <a className="sd-skip-link" href="#studio-workspace">
            Skip to workspace
          </a>
          <div className="sd-app-frame">
            <header className="sd-command-bar" ref={commandBarRef}>
              <nav className="sd-view-nav" aria-label="STEMDECK workspaces">
                {VIEWS.map(([value, label, Icon]) => (
                  <button
                    type="button"
                    key={value}
                    className={activeView === value ? 'is-active' : ''}
                    aria-current={activeView === value ? 'page' : undefined}
                    title={label}
                    onClick={() => setActiveView(value)}
                    onDragOver={(event) => {
                      if (
                        value !== 'library' &&
                        Array.from(event.dataTransfer.types).includes(
                          'application/x-sattari-library-track'
                        )
                      )
                        event.preventDefault();
                    }}
                    onDrop={async (event) => {
                      const id = event.dataTransfer.getData('application/x-sattari-library-track');
                      if (!id || value === 'library') return;
                      event.preventDefault();
                      try {
                        const track = (await listLibraryTracks()).find(
                          (item) => item.id === id && !item.trashedAt
                        );
                        const blob = track && (await getLibraryAudio(id));
                        if (!blob)
                          throw new Error(
                            'Library audio is unavailable. Restore it from Trash or reimport it.'
                          );
                        const file = new File([blob], track.name, { type: blob.type });
                        if (value === 'arranger') {
                          setActiveView('arranger');
                          await arrangerRef.current?.importFiles([file]);
                        } else if (value === 'decks') {
                          const deckId = await loadLibraryTrack(track, file, 'auto');
                          if (deckId) {
                            setFocusedDeckId(deckId);
                            setActiveView('decks');
                          }
                        }
                      } catch (error) {
                        setNotice(error.message);
                      }
                    }}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
              <div className="sd-command-leading">
                <div className="sd-global-transport">
                  <StudioAction
                    type="button"
                    className="is-primary"
                    icon={transportPlaying ? Pause : Play}
                    label={transportPlaying ? 'Pause' : arrangementTransport ? 'Play' : 'Play All'}
                    onClick={toggleGlobalTransport}
                    disabled={!transportAvailable}
                    aria-label={
                      arrangementTransport
                        ? `${transportPlaying ? 'Pause' : 'Play'} arrangement transport`
                        : anyPlaying
                          ? 'Pause all decks'
                          : 'Play all decks'
                    }
                  />
                </div>
                <div className="sd-project-clock">
                  <label className="sd-tempo-chip">
                    <span>Tempo</span>
                    <input
                      type="number"
                      min="40"
                      max="240"
                      value={masterBpm}
                      onChange={(event) =>
                        setMasterBpm(clampNumber(Number(event.target.value) || 120, 40, 240))
                      }
                      aria-label="Global tempo"
                    />
                    <small>BPM</small>
                  </label>
                  <label className="sd-project-key">
                    <span>Key</span>
                    <select
                      value={projectKey}
                      onChange={(event) => setProjectKey(event.target.value)}
                      aria-label="Project key"
                    >
                      {PROJECT_KEYS.map((key) => (
                        <option key={key}>{key}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="sd-title-block">
                <h1 className="sd-product-brand">STEMDECK</h1>
                <small>
                  <i className={restored ? 'is-ready' : ''} />
                  {restored ? 'Local session' : 'Restoring…'}
                </small>
              </div>
              <div className="sd-system-actions">
                <button
                  type="button"
                  onClick={toggleCapture}
                  disabled={captureBusy || !restored}
                  className={captureActive ? 'sd-record-button is-recording' : 'sd-record-button'}
                  aria-label={captureActive ? 'Stop recording live set' : 'Record live set'}
                  title={captureActive ? 'Stop recording live set' : 'Record live set'}
                >
                  <span className="sd-record-glyph" aria-hidden="true">
                    {captureActive ? (
                      <Square size={12} fill="currentColor" />
                    ) : (
                      <Circle size={14} fill="currentColor" />
                    )}
                  </span>
                  <span className="sd-capture-label">
                    {captureBusy ? 'Saving…' : captureActive ? 'Finish capture' : 'Capture'}
                  </span>
                </button>
                <StudioAction
                  type="button"
                  icon={Mic2}
                  label="Input inspector"
                  aria-expanded={inspector === 'input'}
                  aria-controls="session-inspector"
                  onClick={(event) => toggleInspector('input', event)}
                />
                <SessionOutputStatus
                  getEngine={getEngine}
                  expanded={inspector === 'master'}
                  onClick={(event) => toggleInspector('master', event)}
                />
                <StudioAction
                  type="button"
                  className={advancedVisible ? 'is-active sd-tools-button' : 'sd-tools-button'}
                  onClick={() => setAdvancedVisible((value) => !value)}
                  aria-expanded={advancedVisible}
                  icon={SlidersHorizontal}
                  label={advancedVisible ? 'Close tools' : 'Tools'}
                />
                <StudioAction
                  type="button"
                  onClick={() => setSettingsOpen((value) => !value)}
                  aria-label="Settings"
                  aria-expanded={settingsOpen}
                  icon={Settings}
                  label="Settings"
                />
              </div>
            </header>

            {advancedVisible ? (
              <div className="sd-advanced-strip">
                <span className="sd-alpha-guide">LIVE TOOLS / MIXER / PROJECT / MIDI / AUDIO</span>
                <label className="sd-session-field">
                  SESSION
                  <input
                    value={sessionName}
                    onChange={(event) => setSessionName(event.target.value)}
                  />
                </label>
                <StudioAction
                  icon={Save}
                  label="SAVE PROJECT"
                  onClick={() => void exportSession()}
                />
                <StudioAction
                  type="button"
                  className={activeView === 'mixer' ? 'is-active' : ''}
                  onClick={() => setActiveView('mixer')}
                  icon={SlidersHorizontal}
                  label="MIXER"
                />
                <StudioAction
                  type="button"
                  className={activeView === 'files' ? 'is-active' : ''}
                  onClick={() => setActiveView('files')}
                  icon={FolderOpen}
                  label="FILES"
                />
                <StudioAction
                  icon={Radio}
                  label="MIDI"
                  className={midiActive ? 'is-active' : ''}
                  onClick={toggleMidi}
                />
                <StudioAction
                  type="button"
                  className={microphoneActive ? 'is-active' : ''}
                  onClick={toggleMicrophone}
                  icon={Mic2}
                  label="MIC"
                />
                <StudioAction
                  icon={FolderOpen}
                  label="IMPORT SET"
                  onClick={() => deckImportRef.current?.click()}
                />
                <span>
                  Audio device settings are managed by your browser. Open master for output level
                  and limiter controls.
                </span>
                <button type="button" onClick={() => projectInputRef.current?.click()}>
                  OPEN PROJECT
                </button>
                <button type="button" onClick={newSession}>
                  NEW PROJECT
                </button>
                <button
                  type="button"
                  disabled={typeof document === 'undefined' || !document.fullscreenEnabled}
                  title={
                    typeof document === 'undefined' || !document.fullscreenEnabled
                      ? 'Fullscreen is unavailable in this browser'
                      : 'Toggle fullscreen'
                  }
                  onClick={async () => {
                    try {
                      if (document.fullscreenElement) await document.exitFullscreen();
                      else await document.documentElement.requestFullscreen();
                    } catch {
                      setNotice('Fullscreen could not be opened. Your browser may not allow it.');
                    }
                  }}
                >
                  <Maximize2 size={13} /> FULLSCREEN
                </button>
              </div>
            ) : null}

            {settingsOpen ? (
              <aside className="sd-settings-popover" aria-label="Studio settings">
                <header>
                  <strong>Settings</strong>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    aria-label="Close settings"
                  >
                    <X size={13} />
                  </button>
                </header>
                <label>
                  <span>Compact icons</span>
                  <input
                    type="checkbox"
                    checked={compactIcons}
                    onChange={(event) => setCompactIcons(event.target.checked)}
                    aria-describedby="sd-icon-preference-help"
                  />
                </label>
                <p id="sd-icon-preference-help" className="sd-setting-help">
                  Symbols for common actions. Turn off to show text labels.
                </p>
                <label>
                  <span>Limiter</span>
                  <input
                    type="checkbox"
                    checked={limiter}
                    onChange={(event) => setLimiter(event.target.checked)}
                  />
                </label>
                <label>
                  <span>Master assist</span>
                  <input
                    type="checkbox"
                    checked={aiMaster}
                    onChange={(event) => setAiMaster(event.target.checked)}
                  />
                </label>
                <label>
                  <span>Reverse crossfader</span>
                  <input
                    type="checkbox"
                    checked={crossfaderReverse}
                    onChange={(event) => setCrossfaderReverse(event.target.checked)}
                  />
                </label>
                <button type="button" onClick={newSession}>
                  Reset session
                </button>
              </aside>
            ) : null}

            {transfer ? (
              <div className="sd-transfer-banner">
                <KeyRound size={13} />
                <span>
                  LEARN MAP: <strong>{transfer.trackName}</strong> / {transfer.key} / {transfer.bpm}{' '}
                  BPM
                </span>
                <button type="button" onClick={() => setTransfer(null)}>
                  <X size={12} />
                </button>
              </div>
            ) : null}
            <details
              className="sd-notice"
              open={
                unsavedRecordingRef.current || (captureActive && recordingHealth?.error)
                  ? true
                  : undefined
              }
              data-visible={notice !== 'STEMDECK browser engine ready.'}
            >
              <summary>
                <span role={recordingHealth?.error && captureActive ? 'alert' : 'status'}>
                  {captureActive && recordingHealth?.error ? recordingHealth.error : notice}
                </span>
              </summary>
              <div className="sd-session-notice-body">
                <ToolReferenceLink tool="studio" />
                <label>
                  <input
                    type="checkbox"
                    checked={captureSeparateSources}
                    disabled={captureActive}
                    onChange={(event) => setCaptureSeparateSources(event.target.checked)}
                  />{' '}
                  Multitrack capture (recommended)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={longSession}
                    disabled={captureActive}
                    onChange={(event) => setLongSession(event.target.checked)}
                  />{' '}
                  Long-session WAV capture
                </label>
                {captureActive && recordingHealth && (
                  <span role={recordingHealth.error ? 'alert' : undefined}>
                    {recordingHealth.error ||
                      `${Math.floor(recordingHealth.duration)}s · audio saved through ${Math.floor(recordingHealth.durableAudioSeconds)}s · ${recordingHealth.committedEvents} events saved · ${Math.round(recordingHealth.pendingBytes / 1048576)} MB pending`}
                  </span>
                )}
                {unsavedRecordingRef.current && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const { blob, name } = unsavedRecordingRef.current;
                        const url = URL.createObjectURL(blob);
                        const anchor = document.createElement('a');
                        anchor.href = url;
                        anchor.download = name;
                        anchor.click();
                        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
                      }}
                    >
                      Download unsaved take
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Have you verified that the downloaded take is saved? This releases the in-memory recovery copy.'
                          )
                        )
                          return;
                        unsavedRecordingRef.current = null;
                        setNotice('Recording backup confirmed. You can record another take.');
                      }}
                    >
                      I saved the backup
                    </button>
                  </>
                )}
                <small>
                  {loadedDecks.length} DECKS / {loadedStems.length} STEMS / {recordings.length}{' '}
                  TAKES
                </small>
              </div>
            </details>

            <main
              id="studio-workspace"
              tabIndex={-1}
              className={`sd-workspace sd-view-${activeView}`}
            >
              <header className="sd-workspace-heading">
                <div>
                  <h2>
                    {
                      {
                        decks: 'Perform',
                        arranger: 'Arrange',
                        library: 'Library',
                        mixer: 'Mixer',
                        files: 'Project files',
                      }[activeView]
                    }
                  </h2>
                  <span className="sd-workspace-eyebrow">{sessionName}</span>
                </div>
                <div className="sd-workspace-quick-actions">
                  {captureActive ? (
                    <span className="sd-session-capture-state" role="status">
                      ● Capturing · {Math.floor(recordingHealth?.duration || 0)}s
                    </span>
                  ) : (
                    arranger.captures.length > 0 && (
                      <button
                        type="button"
                        className="sd-open-performance"
                        disabled={captureBusy}
                        onClick={() => {
                          setActiveView('arranger');
                          arrangerRef.current?.openPerformance();
                        }}
                      >
                        Open performance in Arrange <span>Take {arranger.captures.length}</span>
                      </button>
                    )
                  )}
                  {activeView === 'arranger' && (
                    <button type="button" onClick={() => arrangerRef.current?.openExport()}>
                      Export
                    </button>
                  )}
                  <PanelLayoutActions />
                  <StudioAction
                    type="button"
                    icon={Plus}
                    label={activeView === 'library' ? 'Import songs' : 'Import audio'}
                    onClick={() => {
                      if (activeView === 'arranger') arrangerRef.current?.importAudio();
                      else
                        (activeView === 'library'
                          ? libraryImportRef
                          : deckImportRef
                        ).current?.click();
                    }}
                  />
                  <StudioAction
                    type="button"
                    onClick={() => void exportSession()}
                    aria-label="Save project file"
                    icon={Save}
                    label="Save project"
                  />
                </div>
              </header>
              {activeView === 'decks' ? (
                <>
                  <div className="sd-performance-coach">
                    <strong>{coachMessage}</strong>
                    <label className="sd-performance-crossfade">
                      Crossfade
                      <input
                        type="range"
                        aria-label="Performance crossfader"
                        min="0"
                        max="100"
                        value={crossfader}
                        onChange={(event) => setCrossfader(Number(event.target.value))}
                      />
                    </label>
                    <div className="sd-scene-buttons" aria-label="Performance scenes">
                      {decks.map((deck) => (
                        <button
                          type="button"
                          key={deck.id}
                          className={
                            loadedDecks.length && focusedDeck.id === deck.id ? 'is-active' : ''
                          }
                          onClick={() => setFocusedDeckId(deck.id)}
                        >
                          {deck.id}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={!loadedDecks.length ? 'is-active' : ''}
                        onClick={startAutomix}
                      >
                        Auto mix
                      </button>
                    </div>
                  </div>
                  {deckConsole}
                </>
              ) : null}

              {activeView === 'library' ? (
                <>
                  <MusicLibrary
                    fileInputRef={libraryImportRef}
                    decks={decks}
                    onLoad={onLibraryLoad}
                    analysisBlocked={anyPlaying || captureActive}
                    onArrange={async (file) => {
                      setActiveView('arranger');
                      await arrangerRef.current?.importFiles([file]);
                    }}
                  />
                  <details className="sd-library-session-assets">
                    <summary>Current session audio & recordings</summary>
                    <div className="sd-library-view">
                      <aside className="sd-library-sidebar">
                        <strong>CURRENT SESSION</strong>
                        <button
                          type="button"
                          className={libraryCollection === 'session' ? 'is-active' : ''}
                          aria-pressed={libraryCollection === 'session'}
                          onClick={() => setLibraryCollection('session')}
                        >
                          <Library size={13} /> Session audio <span>{loadedDecks.length}</span>
                        </button>
                        <button
                          type="button"
                          className={libraryCollection === 'stems' ? 'is-active' : ''}
                          aria-pressed={libraryCollection === 'stems'}
                          onClick={() => setLibraryCollection('stems')}
                        >
                          <ListMusic size={13} /> Stem lanes <span>{loadedStems.length}</span>
                        </button>
                        <button
                          type="button"
                          className={libraryCollection === 'recordings' ? 'is-active' : ''}
                          aria-pressed={libraryCollection === 'recordings'}
                          onClick={() => setLibraryCollection('recordings')}
                        >
                          <Circle size={13} /> Recordings <span>{recordings.length}</span>
                        </button>
                        <button type="button" onClick={() => deckImportRef.current?.click()}>
                          <Plus size={13} /> Load deck files
                        </button>
                      </aside>
                      <section className="sd-library-table">
                        <header>
                          <span>TRACK</span>
                          <span>DECK</span>
                          <span>BPM</span>
                          <span>KEY</span>
                          <span>TIME</span>
                        </header>
                        {libraryCollection === 'session' &&
                          (loadedDecks.length ? (
                            loadedDecks.map((deck) => (
                              <button
                                type="button"
                                key={deck.id}
                                onClick={() => {
                                  setFocusedDeckId(deck.id);
                                  setActiveView('decks');
                                }}
                              >
                                <span style={{ '--sd-accent': deck.accent }}>
                                  <i />
                                  {deck.title}
                                </span>
                                <strong>{deck.id}</strong>
                                <span>{deck.bpm}</span>
                                <span>{deck.keyName}</span>
                                <span>{formatTime(deck.duration)}</span>
                              </button>
                            ))
                          ) : (
                            <div className="sd-library-empty">
                              <FolderOpen size={22} />
                              <strong>No tracks loaded</strong>
                              <button type="button" onClick={() => deckImportRef.current?.click()}>
                                Load deck files
                              </button>
                            </div>
                          ))}
                        {libraryCollection === 'stems' &&
                          (loadedStems.length ? (
                            loadedStems.map((lane) => (
                              <button
                                type="button"
                                key={`${lane.deckId}:${lane.id}`}
                                onClick={() => {
                                  setFocusedDeckId(lane.deckId);
                                  updateDeck(lane.deckId, { activeToolTab: 'STEMS' });
                                  setActiveView('decks');
                                }}
                              >
                                <span>{lane.name || lane.label}</span>
                                <strong>{lane.deckId}</strong>
                                <span>{decks.find((deck) => deck.id === lane.deckId)?.bpm}</span>
                                <span>
                                  {decks.find((deck) => deck.id === lane.deckId)?.keyName}
                                </span>
                                <span>{formatTime(lane.duration)}</span>
                              </button>
                            ))
                          ) : (
                            <div className="sd-library-empty">
                              <strong>No separated stems loaded</strong>
                              <p>Open a deck’s Stems tab to import separated audio.</p>
                            </div>
                          ))}
                        {libraryCollection === 'recordings' && !recordings.length && (
                          <div className="sd-library-empty">
                            <strong>No recordings yet</strong>
                            <p>Record a performance to save it here.</p>
                          </div>
                        )}
                        {libraryCollection === 'recordings' &&
                          recordings.map((recording) => (
                            <button
                              type="button"
                              key={recording.id}
                              onClick={() => downloadRecording(recording)}
                            >
                              <span>
                                <Circle size={10} />
                                {recording.name}
                              </span>
                              <strong>REC</strong>
                              <span>--</span>
                              <span>--</span>
                              <span>{Math.max(1, Math.round(recording.size / 1024))} KB</span>
                            </button>
                          ))}
                      </section>
                    </div>
                  </details>
                </>
              ) : null}

              {activeView === 'mixer' ? (
                <div className="sd-mixer-view">
                  {arranger.tracks.length > 0 && (
                    <section
                      className="sd-session-track-mixer"
                      aria-label="Arrangement track mixer"
                    >
                      <header>
                        <strong>Arrangement tracks</strong>
                        <span>Changes apply to the timeline and mixdown.</span>
                      </header>
                      <div>
                        {arranger.tracks.map((track) => (
                          <section
                            key={track.id}
                            className="sd-session-track-strip"
                            aria-label={`Mix ${track.name}`}
                          >
                            <strong>{track.name}</strong>
                            <small>
                              {track.offline
                                ? 'Offline · enable in Arrange'
                                : track.role === 'reference'
                                  ? 'Safety reference'
                                  : track.kind === 'midi'
                                    ? 'Instrument'
                                    : 'Audio'}
                            </small>
                            <VerticalFader
                              label={`${track.name} gain`}
                              value={track.gain}
                              max={300}
                              accent="#9bd8ca"
                              onChange={(gain) =>
                                arrangerRef.current?.updateTrack(track.id, { gain })
                              }
                            />
                            <label>
                              Pan
                              <input
                                type="range"
                                min="-1"
                                max="1"
                                step=".01"
                                value={track.pan}
                                aria-label={`${track.name} pan`}
                                onChange={(event) =>
                                  arrangerRef.current?.updateTrack(track.id, {
                                    pan: Number(event.target.value),
                                  })
                                }
                              />
                            </label>
                            <div>
                              <button
                                type="button"
                                aria-pressed={track.muted}
                                onClick={() =>
                                  arrangerRef.current?.updateTrack(track.id, {
                                    muted: !track.muted,
                                  })
                                }
                              >
                                Mute
                              </button>
                              <button
                                type="button"
                                aria-pressed={track.solo}
                                onClick={() =>
                                  arrangerRef.current?.updateTrack(track.id, { solo: !track.solo })
                                }
                              >
                                Solo
                              </button>
                            </div>
                          </section>
                        ))}
                      </div>
                    </section>
                  )}
                  {decks.map((deck) => (
                    <StudioPanel
                      panelId={`mixer-${deck.id}`}
                      label={`Deck ${deck.id}`}
                      className="sd-mixer-channel"
                      key={deck.id}
                      style={{ '--sd-accent': deck.accent }}
                    >
                      <header>
                        <strong>DECK {deck.id}</strong>
                        <span>{deck.title}</span>
                      </header>
                      <div className="sd-mixer-eq">
                        {['high', 'mid', 'low'].map((band) => (
                          <Knob
                            key={band}
                            label={band.toUpperCase()}
                            value={deck.eq[band]}
                            onChange={(value) =>
                              changeDeck(deck.id, { eq: { ...deck.eq, [band]: value } })
                            }
                            accent={deck.accent}
                          />
                        ))}
                        <Knob
                          label="FILT"
                          value={deck.filter}
                          onChange={(filter) => changeDeck(deck.id, { filter })}
                          accent={deck.accent}
                        />
                      </div>
                      <div className="sd-mixer-fader">
                        <VerticalFader
                          label="CHANNEL"
                          value={deck.fader}
                          onChange={(fader) => changeDeck(deck.id, { fader })}
                          accent={deck.accent}
                        />
                        <SegmentMeter
                          level={deckMeters[deck.id] || 0}
                          accent={deck.accent}
                          label={deck.id}
                        />
                      </div>
                      <div className="sd-channel-buttons">
                        <button
                          type="button"
                          className={deck.muted ? 'is-active' : ''}
                          aria-pressed={deck.muted}
                          aria-label={`Mute deck ${deck.id}`}
                          onClick={() => changeDeck(deck.id, { muted: !deck.muted })}
                        >
                          MUTE
                        </button>
                        <button
                          type="button"
                          className={deck.solo ? 'is-active is-solo' : ''}
                          aria-pressed={deck.solo}
                          aria-label={`Solo deck ${deck.id}`}
                          onClick={() => changeDeck(deck.id, { solo: !deck.solo })}
                        >
                          SOLO
                        </button>
                      </div>
                    </StudioPanel>
                  ))}
                  {masterConsole}
                  {padStrip}
                </div>
              ) : null}

              <ArrangementEditor
                ref={arrangerRef}
                project={arranger}
                recordings={recordings}
                onChange={setArranger}
                getEngine={getEngine}
                bpm={masterBpm}
                master={{
                  level: masterLevel,
                  processing: masterProcessing,
                  limiter,
                  compression: aiMaster,
                  mode: aiMasterMode,
                }}
                decks={decks}
                visible={activeView === 'arranger'}
                ready={restored && !projectPendingRef.current}
                onBusy={arrangerBusy}
                onPlaying={arrangerPlayback}
              />

              {activeView === 'files' ? (
                <StudioPanel
                  panelId="project-files"
                  label="Project files"
                  as="div"
                  className="sd-files-view"
                >
                  <header>
                    <div>
                      <small>Project browser</small>
                      <strong>{sessionName}</strong>
                    </div>
                    <span>{restored ? 'Local session ready' : 'Restoring session…'}</span>
                  </header>
                  <div className="sd-file-actions">
                    <button type="button" onClick={() => deckImportRef.current?.click()}>
                      <FolderOpen size={16} />
                      <span>Import audio set</span>
                      <small>Load up to four tracks into Decks A-D</small>
                    </button>
                    <button type="button" onClick={() => projectInputRef.current?.click()}>
                      <ListMusic size={16} />
                      <span>Open project</span>
                      <small>Restore a portable Sattari Studio project</small>
                    </button>
                    <button type="button" onClick={() => void exportSession()}>
                      <Save size={16} />
                      <span>Save project</span>
                      <small>Export decks, mixer state, pads, and notes</small>
                    </button>
                    <button type="button" onClick={newSession}>
                      <Plus size={16} />
                      <span>New project</span>
                      <small>Open a clean four-deck session</small>
                    </button>
                  </div>
                  <section className="sd-files-list">
                    <header>
                      <span>Local recordings</span>
                      <span>
                        {recordings.length} {recordings.length === 1 ? 'file' : 'files'}
                      </span>
                    </header>
                    {recordings.length ? (
                      recordings.map((recording) => (
                        <button
                          type="button"
                          key={recording.id}
                          onClick={() => downloadRecording(recording)}
                        >
                          <Circle size={10} />
                          <strong>{recording.name}</strong>
                          <span>{Math.max(1, Math.round(recording.size / 1024))} KB</span>
                        </button>
                      ))
                    ) : (
                      <p>No master recordings yet.</p>
                    )}
                  </section>
                </StudioPanel>
              ) : null}
            </main>

            <aside
              id="session-inspector"
              className="sd-session-inspector"
              aria-label="Session inspector"
              hidden={!inspector}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  closeInspector();
                }
              }}
            >
              <header>
                <strong ref={inspectorHeading} tabIndex={-1}>
                  {inspector === 'input' ? 'Input' : 'Master output'}
                </strong>
                <button type="button" aria-label="Close inspector" onClick={closeInspector}>
                  <X size={18} />
                </button>
              </header>
              <div hidden={inspector !== 'input'}>
                <InputStrip
                  getEngine={getEngine}
                  visible={inspector === 'input'}
                  onChoose={() => setSourceChooserOpen(true)}
                  onActiveChange={setMicrophoneActive}
                />
              </div>
              {masterRail}
            </aside>

            <input
              ref={projectInputRef}
              type="file"
              accept="application/json,.json,.sattari"
              hidden
              onChange={(event) => {
                void importSession(event.target.files?.[0]);
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
                const files = [...event.target.files];
                const targetDeck = deckImportTargetRef.current;
                deckImportTargetRef.current = null;
                if (targetDeck && files[0]) void loadLane(targetDeck, 'fullMix', files[0]);
                else void importDeckSet(files);
                event.target.value = '';
              }}
            />
          </div>
        </section>
      </PanelLayoutProvider>
    </>
  );
}
