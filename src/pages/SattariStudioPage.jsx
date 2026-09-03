import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  Disc3,
  FolderOpen,
  KeyRound,
  Library,
  ListMusic,
  Maximize2,
  Mic2,
  Pause,
  Play,
  Plus,
  Radio,
  Redo2,
  Save,
  Scissors,
  Settings,
  SlidersHorizontal,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ArrangementWave,
  EmptyArrangementDrop,
  Knob,
  SegmentMeter,
  StemDeckChannel,
  VerticalFader,
} from '../components/studio/StemDeckChannel';
import { analyzeAudioFile } from '../utils/audioAnalysis';
import {
  clearStudioSession,
  exportAudioAssets,
  getAudioAsset,
  importAudioAssets,
  loadStudioSession,
  putAudioAsset,
  saveStudioSession,
} from '../utils/audioProjectStore';
import { SEO } from '../utils/seo';
import { StudioAudioEngine } from '../utils/studioAudioEngine';
import '../styles-stemdeck-web.css';

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
  ['library', 'SETS', Library],
  ['decks', 'PERFORM', Disc3],
  ['arranger', 'REPLAY', ListMusic],
];

const PROJECT_KEYS = ['Off', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const PIANO_ROWS = ['B4', 'A#4', 'A4', 'G#4', 'G4', 'F#4', 'F4', 'E4', 'D#4', 'D4', 'C#4', 'C4'];

function createLane(definition) {
  return {
    ...definition,
    assetId: '',
    name: '',
    level: definition.id === 'fullMix' ? 82 : 76,
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
    bpm: 96,
    beatOffset: 0,
    downbeat: 1,
    gain: 82,
    fader: 82,
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
    activeToolTab: 'CUE',
    hotCues: Array(8).fill(null),
    introEnd: null,
    outroStart: null,
    muted: false,
    solo: false,
    playing: false,
    duration: 0,
    waveform: Array.from({ length: 96 }, (_, index) => 10 + ((index * 17) % 18)),
    analysis: null,
    lanes: Object.fromEntries(
      LANE_DEFINITIONS.map((definition) => [definition.id, createLane(definition)])
    ),
  };
}

function normalizeDeck(saved, index) {
  const base = createDeck(DECK_SEEDS[index]);
  if (!saved) return base;
  return {
    ...base,
    ...saved,
    playing: false,
    accent: base.accent,
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
  const objectUrlsRef = useRef(new Map());
  const animationRef = useRef(0);
  const automixRef = useRef(0);
  const projectInputRef = useRef(null);
  const deckImportRef = useRef(null);
  const padInputRefs = useRef([]);
  const midiAccessRef = useRef(null);
  const tapTimesRef = useRef([]);
  const [decks, setDecks] = useState(createEmptyDecks);
  const [pads, setPads] = useState(createPads);
  const [positions, setPositions] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [deckMeters, setDeckMeters] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [crossfader, setCrossfader] = useState(50);
  const [crossfaderCurve, setCrossfaderCurve] = useState('Smooth');
  const [crossfaderReverse, setCrossfaderReverse] = useState(false);
  const [masterLevel, setMasterLevel] = useState(82);
  const [masterBpm, setMasterBpm] = useState(96);
  const [projectKey, setProjectKey] = useState('Off');
  const [masterFx, setMasterFx] = useState({ x: 28, y: 44 });
  const [masterDeckId, setMasterDeckId] = useState('A');
  const [activePad, setActivePad] = useState(null);
  const [captureActive, setCaptureActive] = useState(false);
  const [sessionName, setSessionName] = useState('Untitled session');
  const [transfer, setTransfer] = useState(null);
  const [limiter, setLimiter] = useState(true);
  const [aiMaster, setAiMaster] = useState(false);
  const [aiMasterMode, setAiMasterMode] = useState('Streaming -14');
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [notice, setNotice] = useState('Sattari Studio browser engine ready.');
  const [restored, setRestored] = useState(false);
  const [activeView, setActiveView] = useState('decks');
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [midiActive, setMidiActive] = useState(false);
  const [snapActive, setSnapActive] = useState(true);
  const [razorActive, setRazorActive] = useState(false);
  const [arrangementLoop, setArrangementLoop] = useState(false);
  const [arrangementZoom, setArrangementZoom] = useState(1);
  const [pianoNotes, setPianoNotes] = useState([]);
  const [focusedDeckId, setFocusedDeckId] = useState('A');

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
    async (nextDecks, nextPads, isCancelled = () => false) => {
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
        engine.setPlaybackRate(deck.id, deck.synced ? masterBpm / deck.bpm : 1);
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
    [getEngine, masterBpm]
  );

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const saved = loadStudioSession();
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
      setRecordings(saved?.recordings || []);
      setCrossfader(saved?.crossfader ?? 50);
      setCrossfaderCurve(saved?.crossfaderCurve || 'Smooth');
      setCrossfaderReverse(saved?.crossfaderReverse ?? false);
      setMasterLevel(saved?.masterLevel ?? 82);
      setMasterBpm(transferred?.bpm || saved?.masterBpm || 96);
      setProjectKey(saved?.projectKey || 'Off');
      setLimiter(saved?.limiter ?? true);
      setAiMaster(saved?.aiMaster ?? false);
      setAiMasterMode(saved?.aiMasterMode || 'Streaming -14');
      setTransfer(transferred);
      const engine = getEngine();
      engine.setCrossfader(saved?.crossfader ?? 50);
      engine.setCrossfaderCurve(saved?.crossfaderCurve || 'Smooth');
      engine.setMasterLevel(saved?.masterLevel ?? 82);
      engine.setLimiter(saved?.limiter ?? true);
      engine.setMasterAssist(saved?.aiMaster ?? false, saved?.aiMasterMode || 'Streaming -14');
      const hydrated = await hydrateAudio(nextDecks, nextPads, () => cancelled);
      if (!cancelled) {
        setDecks(hydrated);
        setRestored(true);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [getEngine, hydrateAudio]);

  useEffect(() => {
    if (!restored) return;
    saveStudioSession({
      sessionName,
      decks,
      pads,
      recordings,
      crossfader,
      crossfaderCurve,
      crossfaderReverse,
      masterLevel,
      masterBpm,
      projectKey,
      limiter,
      aiMaster,
      aiMasterMode,
      transfer,
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
    pads,
    recordings,
    restored,
    projectKey,
    sessionName,
    transfer,
  ]);

  useEffect(() => {
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
        setPositions(nextPositions);
        setDeckMeters(nextMeters);
        lastUpdate = timestamp;
      }
      animationRef.current = window.requestAnimationFrame(tick);
    };
    animationRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationRef.current);
  }, [decks, updateDeck]);

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

  useEffect(() => getEngine().setMasterLevel(masterLevel), [getEngine, masterLevel]);
  useEffect(() => getEngine().setLimiter(limiter), [getEngine, limiter]);
  useEffect(
    () => getEngine().setMasterAssist(aiMaster, aiMasterMode),
    [aiMaster, aiMasterMode, getEngine]
  );

  useEffect(() => {
    const engine = getEngine();
    const soloed = decks.filter((deck) => deck.solo);
    decks.forEach((deck) => {
      engine.setDeckFader(deck.id, !deck.muted && (!soloed.length || deck.solo) ? deck.fader : 0);
      engine.setPlaybackRate(deck.id, deck.synced ? masterBpm / Math.max(1, deck.bpm) : 1);
    });
  }, [decks, getEngine, masterBpm]);

  const loadLane = async (deckId, laneId, file) => {
    if (!file) return;
    setFocusedDeckId(deckId);
    updateDeck(deckId, (deck) => ({
      lanes: {
        ...deck.lanes,
        [laneId]: { ...deck.lanes[laneId], status: 'loading', name: file.name },
      },
    }));
    setNotice(`${laneId === 'fullMix' ? 'Analyzing' : 'Decoding'} ${file.name} locally...`);

    try {
      const analysis = laneId === 'fullMix' ? await analyzeAudioFile(file) : null;
      const asset = await putAudioAsset(file, { name: file.name, analysis });
      const key = `${deckId}:${laneId}`;
      const oldUrl = objectUrlsRef.current.get(key);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.set(key, url);
      const deck = decks.find((item) => item.id === deckId);
      const engine = getEngine();
      const duration = await engine.loadLane(deckId, deck.side, laneId, url);
      const laneState = { ...deck.lanes[laneId], assetId: asset.id, duration, status: 'ready' };
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
          lanes: { ...currentDeck.lanes, [laneId]: lane },
          duration: Math.max(currentDeck.duration, duration),
        };
        if (analysis) {
          Object.assign(updates, {
            title: file.name.replace(/\.[^/.]+$/, ''),
            keyName: analysis.key.replace(' major', ' maj').replace(' minor', ' min'),
            sourceKeyName: analysis.key.replace(' major', ' maj').replace(' minor', ' min'),
            bpm: analysis.bpm,
            duration,
            waveform: analysis.waveform,
            analysis,
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
    } catch (error) {
      updateDeck(deckId, (deck) => ({
        lanes: { ...deck.lanes, [laneId]: { ...deck.lanes[laneId], status: 'error' } },
      }));
      setNotice(error instanceof Error ? error.message : 'Audio could not be loaded.');
    }
  };

  const loadStemSet = async (deckId, files) => {
    const audioFiles = files.filter((file) => file.type.startsWith('audio/') || !file.type);
    if (!audioFiles.length) return;
    setNotice(`Importing ${Math.min(audioFiles.length, 4)} separated stems into Deck ${deckId}...`);
    for (const [index, file] of audioFiles.slice(0, 4).entries()) {
      await loadLane(deckId, stemIdForFile(file, index), file);
    }
    setNotice(`Stem set ready in Deck ${deckId}. Browser mode imported your separated files.`);
  };

  const changeDeck = (deckId, updates) => {
    if (updates.masterDeck) {
      setMasterDeckId(deckId);
      setNotice(`Deck ${deckId} is the sync master.`);
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
    const deck = decks.find((item) => item.id === deckId);
    const engine = getEngine();
    if (deck.playing) {
      engine.pauseDeck(deckId);
      updateDeck(deckId, { playing: false });
    } else if (await engine.playDeck(deckId)) {
      updateDeck(deckId, { playing: true });
    }
  };

  const cueDeck = (deckId) => {
    const engine = getEngine();
    engine.stopDeck(deckId);
    engine.seekDeck(deckId, 0);
    updateDeck(deckId, { playing: false });
    setPositions((current) => ({ ...current, [deckId]: 0 }));
  };

  const toggleGlobalTransport = async () => {
    const loaded = decks.filter((deck) => deck.duration);
    if (loaded.some((deck) => deck.playing)) {
      getEngine().pauseAll();
      setDecks((current) => current.map((deck) => ({ ...deck, playing: false })));
      return;
    }
    await getEngine().playAll();
    setDecks((current) => current.map((deck) => ({ ...deck, playing: Boolean(deck.duration) })));
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
    setPianoNotes(buildMidiPattern(kind, deck.bpm));
    setActiveView('arranger');
    setNotice(
      `${kind === 'drums' ? 'Drum pattern' : 'Pitch pattern'} extracted from Deck ${deckId} into the piano roll.`
    );
  };

  const triggerPad = async (index) => {
    const pad = pads[index];
    setActivePad(index);
    window.setTimeout(() => setActivePad(null), 150);
    await getEngine().triggerPad(index, pad.frequency);
  };

  const loadPad = async (index, file) => {
    if (!file) return;
    try {
      const asset = await putAudioAsset(file, { name: file.name });
      const key = `pad:${index}`;
      const oldUrl = objectUrlsRef.current.get(key);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.set(key, url);
      await getEngine().loadPad(index, url, pads[index].gain);
      setPads((current) =>
        current.map((pad, padIndex) =>
          padIndex === index
            ? { ...pad, assetId: asset.id, name: file.name.replace(/\.[^/.]+$/, '') }
            : pad
        )
      );
      setNotice(`${file.name} loaded on Pad ${index + 1}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Pad sample could not be loaded.');
    }
  };

  const changePadGain = (index, gain) => {
    getEngine().setPadGain(index, gain);
    setPads((current) =>
      current.map((pad, padIndex) => (padIndex === index ? { ...pad, gain } : pad))
    );
  };

  const toggleCapture = async () => {
    try {
      if (!captureActive) {
        await getEngine().startRecording();
        setCaptureActive(true);
        setNotice('Master recording started.');
        return;
      }
      const blob = await getEngine().stopRecording();
      setCaptureActive(false);
      if (!blob) return;
      const name = `${sessionName} take ${recordings.length + 1}.webm`;
      const asset = await putAudioAsset(blob, { name, type: blob.type });
      setRecordings((current) => [
        ...current,
        { id: asset.id, name, createdAt: asset.createdAt, size: asset.size },
      ]);
      setNotice(`${name} saved in the local library.`);
    } catch (error) {
      setCaptureActive(false);
      setNotice(error instanceof Error ? error.message : 'Recording is unavailable.');
    }
  };

  const toggleMicrophone = async () => {
    try {
      if (microphoneActive) {
        getEngine().closeMicrophone();
        setMicrophoneActive(false);
        setNotice('Microphone input closed.');
      } else {
        await getEngine().openMicrophone();
        setMicrophoneActive(true);
        setNotice('Microphone is routed to the master output.');
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
    setDecks((current) =>
      current.map((deck) => (deck.duration ? { ...deck, synced: true } : deck))
    );
    setNotice(`Loaded decks synced to ${masterBpm} BPM.`);
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
    window.clearInterval(automixRef.current);
    const loaded = decks.filter((deck) => deck.duration);
    if (loaded.length < 2) {
      setNotice('Load at least two decks to run AutoMix.');
      return;
    }
    const [source, target] = loaded;
    await getEngine().playDeck(source.id);
    await getEngine().playDeck(target.id);
    updateDeck(source.id, { playing: true });
    updateDeck(target.id, { playing: true });
    let value = source.cfSide === 'right' ? 100 : 0;
    const destination = target.cfSide === 'left' ? 0 : 100;
    const direction = destination > value ? 1 : -1;
    setCrossfader(value);
    automixRef.current = window.setInterval(() => {
      value = direction > 0 ? Math.min(destination, value + 2) : Math.max(destination, value - 2);
      setCrossfader(Math.min(100, Math.max(0, value)));
      if (value === destination) {
        window.clearInterval(automixRef.current);
      }
    }, 90);
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

  const togglePianoNote = (pitch, step) => {
    setPianoNotes((current) => {
      const exists = current.some((note) => note.pitch === pitch && note.step === step);
      return exists
        ? current.filter((note) => note.pitch !== pitch || note.step !== step)
        : [...current, { pitch, step, velocity: 96 }];
    });
  };

  const downloadRecording = async (recording) => {
    const asset = await getAudioAsset(recording.id);
    if (!asset) return;
    const url = URL.createObjectURL(asset.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = recording.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const exportSession = async () => {
    try {
      setNotice('Packing the project and its audio for transfer...');
      const assetIds = [
        ...decks.flatMap((deck) => Object.values(deck.lanes).map((lane) => lane.assetId)),
        ...pads.map((pad) => pad.assetId),
        ...recordings.map((recording) => recording.id),
      ];
      const assets = await exportAudioAssets(assetIds);
      const manifest = {
        schema: 'SattariStudio.project.v4',
        product: 'Sattari Studio',
        sessionName,
        createdAt: new Date().toISOString(),
        master: {
          bpm: masterBpm,
          projectKey,
          level: masterLevel,
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
        source: transfer || null,
        assets,
      };
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sattari-session'}.sattari`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice(
        `Portable project saved with ${assets.length} audio asset${assets.length === 1 ? '' : 's'}.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Project could not be saved.');
    }
  };

  const importSession = async (file) => {
    if (!file) return;
    try {
      const manifest = JSON.parse(await file.text());
      if (!manifest.schema?.startsWith('SattariStudio.'))
        throw new Error('Not a Sattari Studio project.');
      await importAudioAssets(manifest.assets || []);
      const nextDecks = DECK_SEEDS.map((_, index) => normalizeDeck(manifest.decks?.[index], index));
      const nextPads = createPads(manifest.pads);
      engineRef.current?.dispose();
      engineRef.current = null;
      const hydrated = await hydrateAudio(nextDecks, nextPads);
      setDecks(hydrated);
      setPads(nextPads);
      setSessionName(manifest.sessionName || 'Imported session');
      setMasterBpm(manifest.master?.bpm || 96);
      setProjectKey(manifest.master?.projectKey || 'Off');
      setMasterLevel(manifest.master?.level ?? 82);
      setCrossfader(manifest.master?.crossfader ?? 50);
      setCrossfaderCurve(manifest.master?.crossfaderCurve || 'Smooth');
      setCrossfaderReverse(manifest.master?.crossfaderReverse ?? false);
      setLimiter(manifest.master?.limiter ?? true);
      setAiMaster(manifest.master?.aiMaster ?? false);
      setAiMasterMode(manifest.master?.aiMasterMode || 'Streaming -14');
      setPianoNotes(manifest.pianoNotes || []);
      setRecordings(manifest.recordings || []);
      setTransfer(manifest.source || null);
      setNotice(
        manifest.assets?.length
          ? `${file.name} imported with ${manifest.assets.length} embedded audio assets.`
          : `${file.name} imported. Reconnect audio files that are not stored on this device.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Project could not be imported.');
    }
  };

  const importDeckSet = async (files) => {
    for (const [index, file] of files.slice(0, 4).entries()) {
      await loadLane(DECK_SEEDS[index].id, 'fullMix', file);
    }
  };

  const newSession = () => {
    if (!window.confirm('Start a new session? Local audio assets will remain available.')) return;
    engineRef.current?.stopAll();
    engineRef.current?.dispose();
    engineRef.current = null;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    clearStudioSession();
    setDecks(createEmptyDecks());
    setPads(createPads());
    setPositions({ A: 0, B: 0, C: 0, D: 0 });
    setDeckMeters({ A: 0, B: 0, C: 0, D: 0 });
    setSessionName('Untitled session');
    setTransfer(null);
    setRecordings([]);
    setPianoNotes([]);
    setCrossfader(50);
    setMasterLevel(82);
    setMasterBpm(96);
    setProjectKey('Off');
    setFocusedDeckId('A');
    setLimiter(true);
    setMicrophoneActive(false);
    setCaptureActive(false);
    setNotice('New Sattari Studio session ready.');
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.repeat) return;
      const padIndex = ['1', '2', '3', '4', '5', '6', '7', '8'].indexOf(event.key);
      if (padIndex >= 0) {
        event.preventDefault();
        void triggerPad(padIndex);
      }
      if (event.code === 'Space') {
        event.preventDefault();
        void toggleGlobalTransport();
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
  const anyPlaying = decks.some((deck) => deck.playing);
  const masterPosition = Math.max(0, ...Object.values(positions));
  const masterMeter = Math.max(0, ...Object.values(deckMeters));
  const maxDuration = Math.max(60, ...decks.map((deck) => deck.duration || 0));

  const focusedDeck = decks.find((deck) => deck.id === focusedDeckId) || decks[0];

  const deckConsole = (
    <section className="sd-performance-stage" aria-label="Performance sources">
      <div className="sd-focused-deck">
        <div className="sd-decks-grid">
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
        </div>
        <button
          type="button"
          className="sd-source-dock"
          onClick={() => deckImportRef.current?.click()}
        >
          <Plus size={24} />
          <strong>SOURCE</strong>
        </button>
      </div>
    </section>
  );

  const masterConsole = (
    <section className="sd-master-console" aria-label="Sattari Studio master section">
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
    </section>
  );

  const masterRail = (
    <section className="sd-master-rail" aria-label="Master output status">
      <div className="sd-master-rail-title">
        <strong>MASTER OUTPUT</strong>
        <span className={limiter ? 'is-safe' : ''}>{limiter ? 'LIMITER SAFE' : 'LIMITER OFF'}</span>
      </div>
      <SegmentMeter level={masterMeter} accent="#4ad9c4" label="OUT" compact />
      <label className="sd-master-rail-level">
        <span>LEVEL</span>
        <input
          type="range"
          min="0"
          max="125"
          value={masterLevel}
          onChange={(event) => setMasterLevel(Number(event.target.value))}
          aria-label="Master output level"
        />
        <strong>{masterLevel}%</strong>
      </label>
      <div className="sd-master-rail-stats">
        <span>
          LUFS-I <strong>{masterMeter ? '-14.2' : '--'}</strong>
        </span>
        <span>
          PEAK <strong>{masterMeter ? '-1.0' : '--'}</strong>
        </span>
        <span>
          ENGINE <strong className="is-safe">READY</strong>
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setAdvancedVisible(true);
          setActiveView('mixer');
        }}
      >
        OPEN MASTER
      </button>
    </section>
  );

  const arrangementConsole = (
    <section className="sd-arranger" aria-label="Arrangement capture">
      <header className="sd-arranger-toolbar">
        <div>
          <strong>ARRANGEMENT CAPTURE</strong>
          <span>{formatTime(masterPosition, true)}</span>
        </div>
        <div className="sd-arrangement-transport">
          <button type="button" onClick={toggleGlobalTransport} aria-label="Launch arrangement">
            &gt;&gt;&gt;
          </button>
          <button type="button" onClick={toggleGlobalTransport} aria-label="Play arrangement">
            {anyPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button
            type="button"
            className={captureActive ? 'is-recording' : ''}
            onClick={toggleCapture}
            aria-label="Record arrangement"
          >
            <Circle size={11} fill="currentColor" />
          </button>
          <button
            type="button"
            className={arrangementLoop ? 'is-active' : ''}
            onClick={() => setArrangementLoop((value) => !value)}
            aria-label="Loop arrangement"
          >
            LOOP
          </button>
        </div>
        <div className="sd-edit-tools">
          {advancedVisible ? (
            <>
              <button type="button" aria-label="Undo">
                <Undo2 size={13} />
              </button>
              <button type="button" aria-label="Redo">
                <Redo2 size={13} />
              </button>
              <button
                type="button"
                className={razorActive ? 'is-active' : ''}
                onClick={() => setRazorActive((value) => !value)}
              >
                <Scissors size={13} />
              </button>
              <button
                type="button"
                className={snapActive ? 'is-active' : ''}
                onClick={() => setSnapActive((value) => !value)}
              >
                SNAP
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setArrangementZoom((value) => Math.max(0.6, value - 0.2))}
            aria-label="Zoom out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            type="button"
            onClick={() => setArrangementZoom((value) => Math.min(2.2, value + 0.2))}
            aria-label="Zoom in"
          >
            <ZoomIn size={13} />
          </button>
          <button type="button" onClick={() => setArrangementZoom(1)} aria-label="Fit arrangement">
            FIT
          </button>
        </div>
      </header>
      <div className="sd-ruler">
        <span>1</span>
        <span>9</span>
        <span>17</span>
        <span>25</span>
        <span>33</span>
        <span>41</span>
        <span>49</span>
        <span>57</span>
      </div>
      <div className="sd-arrangement-tracks" style={{ '--sd-zoom': arrangementZoom }}>
        {decks.map((deck) => (
          <div className="sd-arrangement-track" key={deck.id}>
            <div className="sd-arrangement-label" style={{ '--sd-accent': deck.accent }}>
              <strong>{deck.id}</strong>
              <span>{deck.title}</span>
            </div>
            <div className="sd-arrangement-lane">
              {deck.duration ? (
                <button
                  type="button"
                  className="sd-arrangement-clip"
                  style={{
                    '--sd-accent': deck.accent,
                    width: `${Math.max(12, (deck.duration / maxDuration) * 88)}%`,
                  }}
                  onClick={() => getEngine().seekDeck(deck.id, 0)}
                >
                  <ArrangementWave peaks={deck.waveform} accent={deck.accent} />
                  <span>{deck.title}</span>
                </button>
              ) : (
                <EmptyArrangementDrop onDrop={(file) => loadLane(deck.id, 'fullMix', file)} />
              )}
            </div>
          </div>
        ))}
        <div className="sd-arrangement-track sd-recording-track">
          <div className="sd-arrangement-label">
            <strong>REC</strong>
            <span>Master takes</span>
          </div>
          <div className="sd-arrangement-lane">
            {recordings.length ? (
              recordings.map((recording) => (
                <button
                  type="button"
                  key={recording.id}
                  className="sd-recording-clip"
                  onClick={() => downloadRecording(recording)}
                >
                  {recording.name}
                </button>
              ))
            ) : (
              <span className="sd-empty-lane">Press record to capture the master output</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  const padStrip = (
    <section className="sd-pad-strip" aria-label="Performance pads">
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
    </section>
  );

  return (
    <>
      <SEO
        title="Sattari Studio - Create, Remix and Perform"
        description="A local-first browser studio for deck mixing, stems, performance pads, arrangement capture, recording and portable music projects."
        image="/sattari site/audio-suite/create.png"
        url="https://sattarimusic.com/studio"
      />
      <section className="stemdeck-web">
        <div className="sd-app-frame">
          <header className="sd-command-bar">
            <nav className="sd-view-nav" aria-label="Sattari Studio workspaces">
              {VIEWS.map(([value, label, Icon]) => (
                <button
                  type="button"
                  key={value}
                  className={activeView === value ? 'is-active' : ''}
                  onClick={() => setActiveView(value)}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="sd-global-transport">
              <button
                type="button"
                className="is-primary"
                onClick={toggleGlobalTransport}
                disabled={!loadedDecks.length}
                aria-label={anyPlaying ? 'Pause all decks' : 'Play all decks'}
              >
                {anyPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{anyPlaying ? 'PAUSE' : 'PLAY ALL'}</span>
              </button>
            </div>
            <div className="sd-title-block">
              <h1>StemDeck</h1>
              <small>
                <i className={restored ? 'is-ready' : ''} />
                {restored ? 'LOCAL SESSION' : 'RESTORING'}
              </small>
            </div>
            <div className="sd-project-clock">
              <label className="sd-tempo-chip">
                <span>GLOBAL TEMPO</span>
                <input
                  type="number"
                  min="40"
                  max="220"
                  value={masterBpm}
                  onChange={(event) => setMasterBpm(Number(event.target.value))}
                  aria-label="Global tempo"
                />
                <small>BPM</small>
              </label>
              <label className="sd-project-key">
                <span>PROJECT KEY</span>
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
            <div className="sd-system-actions">
              <button
                type="button"
                onClick={toggleCapture}
                className={captureActive ? 'sd-record-button is-recording' : 'sd-record-button'}
                aria-label={captureActive ? 'Stop recording live set' : 'Record live set'}
              >
                <Circle size={12} fill="currentColor" />
                <span>{captureActive ? 'STOP' : 'RECORD'}</span>
              </button>
              <button
                type="button"
                className={advancedVisible ? 'is-active sd-tools-button' : 'sd-tools-button'}
                onClick={() => setAdvancedVisible((value) => !value)}
              >
                MORE
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                aria-label="Settings"
              >
                <Settings size={14} />
              </button>
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
              <button type="button" onClick={() => void exportSession()}>
                <Save size={13} /> SAVE PROJECT
              </button>
              <button
                type="button"
                className={activeView === 'mixer' ? 'is-active' : ''}
                onClick={() => setActiveView('mixer')}
              >
                <SlidersHorizontal size={13} /> MIXER
              </button>
              <button
                type="button"
                className={activeView === 'files' ? 'is-active' : ''}
                onClick={() => setActiveView('files')}
              >
                <FolderOpen size={13} /> FILES
              </button>
              <button type="button" className={midiActive ? 'is-active' : ''} onClick={toggleMidi}>
                <Radio size={13} /> MIDI
              </button>
              <button
                type="button"
                className={microphoneActive ? 'is-active' : ''}
                onClick={toggleMicrophone}
              >
                <Mic2 size={13} /> MIC
              </button>
              <button type="button" onClick={() => deckImportRef.current?.click()}>
                <FolderOpen size={13} /> IMPORT SET
              </button>
              <label>
                BUFFER
                <select>
                  <option>Balanced 256</option>
                  <option>Low latency 128</option>
                  <option>Stable 512</option>
                </select>
              </label>
              <label>
                RATE
                <select>
                  <option>48 kHz</option>
                  <option>44.1 kHz</option>
                </select>
              </label>
              <label>
                HEADROOM
                <select>
                  <option>-6 dB</option>
                  <option>-3 dB</option>
                  <option>-9 dB</option>
                </select>
              </label>
              <button type="button" onClick={() => projectInputRef.current?.click()}>
                OPEN PROJECT
              </button>
              <button type="button" onClick={newSession}>
                NEW PROJECT
              </button>
              <button type="button" onClick={() => document.documentElement.requestFullscreen?.()}>
                <Maximize2 size={13} /> FULLSCREEN
              </button>
            </div>
          ) : null}

          {settingsOpen ? (
            <aside className="sd-settings-popover">
              <header>
                <strong>ENGINE SETTINGS</strong>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close settings"
                >
                  <X size={13} />
                </button>
              </header>
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
                RESET SESSION
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
          <div
            className="sd-notice"
            role="status"
            data-visible={notice !== 'Sattari Studio browser engine ready.'}
          >
            <span>{notice}</span>
            <small>
              {loadedDecks.length} DECKS / {loadedStems.length} STEMS / {recordings.length} TAKES
            </small>
          </div>

          <main className={`sd-workspace sd-view-${activeView}`}>
            {activeView === 'decks' ? (
              <>
                <div className="sd-performance-coach">
                  <strong>PRESS PLAY</strong>
                  <div className="sd-scene-buttons" aria-label="Performance scenes">
                    {decks.map((deck, index) => (
                      <button
                        type="button"
                        key={deck.id}
                        className={focusedDeck.id === deck.id ? 'is-active' : ''}
                        onClick={() => setFocusedDeckId(deck.id)}
                      >
                        S{index + 1}
                      </button>
                    ))}
                    <button type="button" onClick={startAutomix}>
                      FLOW
                    </button>
                  </div>
                </div>
                {deckConsole}
              </>
            ) : null}

            {activeView === 'library' ? (
              <div className="sd-library-view">
                <aside className="sd-library-sidebar">
                  <strong>COLLECTIONS</strong>
                  <button type="button" className="is-active">
                    <Library size={13} /> Session audio <span>{loadedDecks.length}</span>
                  </button>
                  <button type="button">
                    <ListMusic size={13} /> Stem lanes <span>{loadedStems.length}</span>
                  </button>
                  <button type="button">
                    <Circle size={13} /> Recordings <span>{recordings.length}</span>
                  </button>
                  <button type="button" onClick={() => deckImportRef.current?.click()}>
                    <Plus size={13} /> Import audio
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
                  {loadedDecks.length ? (
                    loadedDecks.map((deck) => (
                      <button type="button" key={deck.id} onClick={() => setActiveView('decks')}>
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
                        IMPORT AUDIO SET
                      </button>
                    </div>
                  )}
                  {recordings.map((recording) => (
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
            ) : null}

            {activeView === 'mixer' ? (
              <div className="sd-mixer-view">
                {decks.map((deck) => (
                  <section
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
                        onClick={() => changeDeck(deck.id, { muted: !deck.muted })}
                      >
                        MUTE
                      </button>
                      <button
                        type="button"
                        className={deck.solo ? 'is-active is-solo' : ''}
                        onClick={() => changeDeck(deck.id, { solo: !deck.solo })}
                      >
                        SOLO
                      </button>
                    </div>
                  </section>
                ))}
                {masterConsole}
                {padStrip}
              </div>
            ) : null}

            {activeView === 'arranger' ? (
              <div className="sd-arranger-view">
                {arrangementConsole}
                <section className="sd-piano-roll">
                  <header>
                    <strong>PIANO ROLL</strong>
                    <span>{pianoNotes.length} NOTES</span>
                    <button type="button" onClick={() => setPianoNotes([])}>
                      CLEAR
                    </button>
                  </header>
                  <div className="sd-piano-grid">
                    {PIANO_ROWS.map((pitch) => (
                      <div className="sd-piano-row" key={pitch}>
                        <span className={pitch.includes('#') ? 'is-black' : ''}>{pitch}</span>
                        {Array.from({ length: 16 }, (_, step) => {
                          const active = pianoNotes.some(
                            (note) => note.pitch === pitch && note.step === step
                          );
                          return (
                            <button
                              type="button"
                              key={step}
                              className={active ? 'is-note' : ''}
                              onClick={() => togglePianoNote(pitch, step)}
                              aria-label={`${pitch} step ${step + 1}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            {activeView === 'files' ? (
              <div className="sd-files-view">
                <header>
                  <div>
                    <small>PROJECT BROWSER</small>
                    <strong>{sessionName}</strong>
                  </div>
                  <span>{restored ? 'LOCAL SESSION READY' : 'RESTORING SESSION'}</span>
                </header>
                <div className="sd-file-actions">
                  <button type="button" onClick={() => deckImportRef.current?.click()}>
                    <FolderOpen size={16} />
                    <span>IMPORT AUDIO SET</span>
                    <small>Load up to four tracks into Decks A-D</small>
                  </button>
                  <button type="button" onClick={() => projectInputRef.current?.click()}>
                    <ListMusic size={16} />
                    <span>OPEN PROJECT</span>
                    <small>Restore a portable Sattari Studio project</small>
                  </button>
                  <button type="button" onClick={() => void exportSession()}>
                    <Save size={16} />
                    <span>SAVE PROJECT</span>
                    <small>Export decks, mixer state, pads, and notes</small>
                  </button>
                  <button type="button" onClick={newSession}>
                    <Plus size={16} />
                    <span>NEW PROJECT</span>
                    <small>Open a clean four-deck session</small>
                  </button>
                </div>
                <section className="sd-files-list">
                  <header>
                    <span>LOCAL RECORDINGS</span>
                    <span>{recordings.length} FILES</span>
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
              </div>
            ) : null}
          </main>

          {masterRail}

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
              void importDeckSet([...event.target.files]);
              event.target.value = '';
            }}
          />
        </div>
      </section>
    </>
  );
}
