import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AudioWaveform,
  ChevronDown,
  Circle,
  Download,
  FileAudio,
  Layers3,
  Link2,
  ListMusic,
  Mic2,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  Waves,
} from 'lucide-react';
import { analyzeAudioFile } from '../utils/audioAnalysis';
import {
  clearStudioSession,
  getAudioAsset,
  loadStudioSession,
  putAudioAsset,
  saveStudioSession,
} from '../utils/audioProjectStore';
import { SEO } from '../utils/seo';
import { StudioAudioEngine } from '../utils/studioAudioEngine';

const DECK_SEEDS = [
  { id: 'A', color: 'cyan', side: 'left' },
  { id: 'B', color: 'coral', side: 'right' },
  { id: 'C', color: 'green', side: 'left' },
  { id: 'D', color: 'gold', side: 'right' },
];

const LANE_DEFINITIONS = [
  { id: 'fullMix', label: 'Full mix', color: 'cyan' },
  { id: 'drums', label: 'Drums', color: 'green' },
  { id: 'bass', label: 'Bass', color: 'gold' },
  { id: 'music', label: 'Music', color: 'cyan' },
  { id: 'vocals', label: 'Vocals', color: 'coral' },
];

const PERFORMANCE_PADS = [
  ['Kick', 72],
  ['Snare', 180],
  ['Hat', 420],
  ['Clap', 260],
  ['Low', 110],
  ['Rise', 760],
  ['Perc', 330],
  ['Tone', 610],
];

function createLane(definition) {
  return {
    ...definition,
    assetId: '',
    name: '',
    level: definition.id === 'fullMix' ? 82 : 76,
    muted: false,
    solo: false,
    duration: 0,
    status: 'empty',
  };
}

function createDeck(seed) {
  return {
    ...seed,
    title: 'Empty deck',
    keyName: '--',
    bpm: 96,
    gain: 82,
    looping: false,
    synced: false,
    playing: false,
    duration: 0,
    waveform: Array.from({ length: 96 }, () => 8),
    analysis: null,
    lanes: Object.fromEntries(
      LANE_DEFINITIONS.map((definition) => [definition.id, createLane(definition)])
    ),
  };
}

function createEmptyDecks() {
  return DECK_SEEDS.map(createDeck);
}

function formatTime(seconds, includeHours = false) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  if (includeHours) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function DeckWaveform({ color, peaks, playing, position, duration, onSeek }) {
  const progress = duration ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <button
      type="button"
      className={`studio-waveform studio-waveform-${color}${playing ? ' is-playing' : ''}`}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        onSeek(((event.clientX - bounds.left) / bounds.width) * duration);
      }}
      disabled={!duration}
      aria-label="Seek in deck audio"
    >
      {peaks.map((height, index) => (
        <span key={index} style={{ '--wave-height': `${height}%` }} />
      ))}
      <i className="studio-playhead" style={{ left: `${progress}%` }} />
    </button>
  );
}

function StemLane({ lane, onLoad, onChange }) {
  const ready = lane.status === 'ready';

  return (
    <div className={`stem-lane${ready ? '' : ' is-unavailable'}`}>
      <span className={`stem-dot stem-dot-${lane.color}`} />
      <button
        type="button"
        className="stem-lane-name"
        onClick={onLoad}
        title={`Load ${lane.label.toLowerCase()}`}
      >
        <strong>{lane.status === 'loading' ? 'Decoding...' : lane.name || lane.label}</strong>
      </button>
      <button
        type="button"
        className={lane.muted ? 'is-active' : ''}
        onClick={() => onChange({ muted: !lane.muted })}
        disabled={!ready}
        title={`Mute ${lane.label}`}
        aria-label={`Mute ${lane.label}`}
        aria-pressed={lane.muted}
      >
        M
      </button>
      <button
        type="button"
        className={lane.solo ? 'is-active is-solo' : ''}
        onClick={() => onChange({ solo: !lane.solo })}
        disabled={!ready}
        title={`Solo ${lane.label}`}
        aria-label={`Solo ${lane.label}`}
        aria-pressed={lane.solo}
      >
        S
      </button>
      <input
        type="range"
        min="0"
        max="100"
        value={lane.level}
        onChange={(event) => onChange({ level: Number(event.target.value) })}
        disabled={!ready}
        aria-label={`${lane.label} level`}
      />
    </div>
  );
}

function StudioDeck({
  deck,
  masterBpm,
  position,
  onLoadLane,
  onDeckChange,
  onLaneChange,
  onTogglePlay,
  onStop,
  onSeek,
}) {
  const fileInputsRef = useRef({});
  const requestLane = (laneId) => fileInputsRef.current[laneId]?.click();

  return (
    <article className={`studio-deck studio-deck-${deck.color} studio-deck-${deck.id}`}>
      <header>
        <div className="deck-identity">
          <span>Deck</span>
          <strong>{deck.id}</strong>
        </div>
        <button
          type="button"
          className="deck-title"
          onClick={() => requestLane('fullMix')}
          title="Load full mix"
        >
          <span>{deck.title}</span>
          <ChevronDown size={14} />
        </button>
        <span className="deck-key">{deck.keyName}</span>
      </header>

      <div className="deck-main-row">
        <button
          type="button"
          className="deck-play-button"
          onClick={onTogglePlay}
          disabled={!deck.duration}
          aria-label={deck.playing ? `Pause deck ${deck.id}` : `Play deck ${deck.id}`}
          title={deck.duration ? (deck.playing ? 'Pause' : 'Play') : 'Load audio to play'}
        >
          {deck.playing ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <div className="deck-wave-shell">
          <DeckWaveform
            color={deck.color}
            peaks={deck.waveform}
            playing={deck.playing}
            position={position}
            duration={deck.duration}
            onSeek={onSeek}
          />
          <div className="deck-timeline">
            <span>{formatTime(position)}</span>
            <span>{formatTime(deck.duration)}</span>
          </div>
        </div>
      </div>

      <div className="deck-transport-row">
        <div className="deck-bpm-control">
          <span>BPM</span>
          <button
            type="button"
            onClick={() => onDeckChange({ bpm: Math.max(40, deck.bpm - 1) })}
            aria-label="Lower source BPM"
          >
            <Minus size={12} />
          </button>
          <strong>{deck.bpm}</strong>
          <button
            type="button"
            onClick={() => onDeckChange({ bpm: Math.min(220, deck.bpm + 1) })}
            aria-label="Raise source BPM"
          >
            <Plus size={12} />
          </button>
        </div>
        <button
          type="button"
          className={deck.looping ? 'deck-tool is-active' : 'deck-tool'}
          onClick={() => onDeckChange({ looping: !deck.looping })}
          aria-pressed={deck.looping}
        >
          <RefreshCw size={13} /> 4 beat
        </button>
        <button
          type="button"
          className={deck.synced ? 'deck-tool is-active' : 'deck-tool'}
          onClick={() => onDeckChange({ synced: !deck.synced })}
          aria-pressed={deck.synced}
        >
          <Link2 size={13} /> {deck.synced ? masterBpm : 'Sync'}
        </button>
        <button type="button" className="deck-tool" onClick={onStop}>
          <RefreshCw size={13} /> Start
        </button>
      </div>

      <div className="deck-stem-header">
        <span>Audio lanes</span>
        <button type="button" onClick={() => requestLane('drums')}>
          <Plus size={13} /> Add stem
        </button>
      </div>
      <div className="deck-stems">
        {LANE_DEFINITIONS.map((definition) => (
          <StemLane
            key={definition.id}
            lane={deck.lanes[definition.id]}
            onLoad={() => requestLane(definition.id)}
            onChange={(updates) => onLaneChange(definition.id, updates)}
          />
        ))}
      </div>

      <div className="deck-footer-controls">
        <label>
          <Volume2 size={14} />
          <input
            type="range"
            min="0"
            max="100"
            value={deck.gain}
            onChange={(event) => onDeckChange({ gain: Number(event.target.value) })}
            aria-label={`Deck ${deck.id} gain`}
          />
        </label>
        <button type="button" onClick={() => requestLane('fullMix')}>
          <Upload size={13} /> Load track
        </button>
      </div>

      {LANE_DEFINITIONS.map((definition) => (
        <input
          key={definition.id}
          ref={(element) => {
            fileInputsRef.current[definition.id] = element;
          }}
          data-lane={definition.id}
          type="file"
          accept="audio/*"
          hidden
          onChange={(event) => {
            onLoadLane(definition.id, event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      ))}
    </article>
  );
}

export default function SattariStudioPage() {
  const engineRef = useRef(null);
  const objectUrlsRef = useRef(new Map());
  const animationRef = useRef(0);
  const [decks, setDecks] = useState(createEmptyDecks);
  const [positions, setPositions] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [crossfader, setCrossfader] = useState(50);
  const [masterLevel, setMasterLevel] = useState(82);
  const [masterBpm, setMasterBpm] = useState(96);
  const [meterLevel, setMeterLevel] = useState(0);
  const [activePad, setActivePad] = useState(null);
  const [captureActive, setCaptureActive] = useState(false);
  const [sessionName, setSessionName] = useState('Untitled session');
  const [transfer, setTransfer] = useState(null);
  const [libraryTab, setLibraryTab] = useState('session');
  const [limiter, setLimiter] = useState(true);
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [studioNotice, setStudioNotice] = useState('');
  const [restored, setRestored] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const savedSession = loadStudioSession();
      let nextDecks = savedSession?.decks || createEmptyDecks();
      let nextSessionName = savedSession?.sessionName || 'Untitled session';
      const nextRecordings = savedSession?.recordings || [];
      const restoredMasterBpm = savedSession?.masterBpm || 96;
      let receivedTransfer = null;

      try {
        const transferValue = window.localStorage.getItem('sattari-studio-transfer-v1');
        if (transferValue) {
          receivedTransfer = JSON.parse(transferValue);
          const firstDeck = nextDecks.find((deck) => deck.id === 'A') || createDeck(DECK_SEEDS[0]);
          const fullMix = {
            ...firstDeck.lanes.fullMix,
            assetId: receivedTransfer.audioAssetId || firstDeck.lanes.fullMix.assetId,
            name: receivedTransfer.trackName || firstDeck.lanes.fullMix.name,
            status: receivedTransfer.audioAssetId ? 'loading' : firstDeck.lanes.fullMix.status,
            duration: receivedTransfer.analysis?.duration || firstDeck.lanes.fullMix.duration,
          };
          const transferredDeck = {
            ...firstDeck,
            title: receivedTransfer.trackName || firstDeck.title,
            keyName: receivedTransfer.key || firstDeck.keyName,
            bpm: receivedTransfer.bpm || firstDeck.bpm,
            duration: receivedTransfer.analysis?.duration || firstDeck.duration,
            waveform: receivedTransfer.analysis?.waveform || firstDeck.waveform,
            analysis: receivedTransfer.analysis || firstDeck.analysis,
            lanes: { ...firstDeck.lanes, fullMix },
          };
          nextDecks = nextDecks.map((deck) => (deck.id === 'A' ? transferredDeck : deck));
          nextSessionName = `${receivedTransfer.trackName || 'Learn'} session`;
          window.localStorage.removeItem('sattari-studio-transfer-v1');
        }
      } catch {
        receivedTransfer = null;
      }

      if (cancelled) return;
      setDecks(nextDecks);
      setSessionName(nextSessionName);
      setRecordings(nextRecordings);
      setCrossfader(savedSession?.crossfader ?? 50);
      setMasterLevel(savedSession?.masterLevel ?? 82);
      setMasterBpm(receivedTransfer?.bpm || restoredMasterBpm);
      setLimiter(savedSession?.limiter ?? true);
      setTransfer(receivedTransfer);

      const engine = getEngine();
      engine.setCrossfader(savedSession?.crossfader ?? 50);
      engine.setMasterLevel(savedSession?.masterLevel ?? 82);
      engine.setLimiter(savedSession?.limiter ?? true);
      const hydratedDecks = nextDecks.map((deck) => ({
        ...deck,
        playing: false,
        lanes: Object.fromEntries(
          Object.entries(deck.lanes).map(([laneId, lane]) => [laneId, { ...lane }])
        ),
      }));

      for (const deck of hydratedDecks) {
        engine.ensureDeck(deck.id, deck.side);
        engine.setDeckGain(deck.id, deck.gain);
        for (const [laneId, lane] of Object.entries(deck.lanes)) {
          if (!lane.assetId) continue;
          try {
            const asset = await getAudioAsset(lane.assetId);
            if (!asset || cancelled) {
              lane.status = 'error';
              continue;
            }
            const url = URL.createObjectURL(asset.blob);
            objectUrlsRef.current.set(`${deck.id}:${laneId}`, url);
            lane.duration = await engine.loadLane(deck.id, deck.side, laneId, url);
            lane.name = lane.name || asset.name;
            lane.status = 'ready';
            engine.setLaneState(deck.id, laneId, {
              level: lane.level,
              muted: lane.muted,
              solo: lane.solo,
            });
          } catch {
            lane.status = 'error';
          }
        }
        engine.setPlaybackRate(
          deck.id,
          deck.synced ? (receivedTransfer?.bpm || restoredMasterBpm) / deck.bpm : 1
        );
        engine.setLoop(deck.id, deck.looping, deck.bpm);
      }

      if (!cancelled) {
        setDecks(hydratedDecks);
        setRestored(true);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [getEngine]);

  useEffect(() => {
    if (!restored) return;
    saveStudioSession({
      sessionName,
      decks,
      recordings,
      crossfader,
      masterLevel,
      masterBpm,
      limiter,
      transfer,
    });
  }, [
    crossfader,
    decks,
    limiter,
    masterBpm,
    masterLevel,
    recordings,
    restored,
    sessionName,
    transfer,
  ]);

  useEffect(() => {
    let lastUpdate = 0;
    const tick = (timestamp) => {
      const engine = engineRef.current;
      if (engine && timestamp - lastUpdate >= 50) {
        const nextPositions = {};
        decks.forEach((deck) => {
          const position = engine.getDeckPosition(deck.id);
          nextPositions[deck.id] = position;
          if (deck.playing && !deck.looping && deck.duration && position >= deck.duration) {
            engine.stopDeck(deck.id);
            updateDeck(deck.id, { playing: false });
          }
        });
        setPositions((current) =>
          Object.keys(nextPositions).some(
            (deckId) => Math.abs(nextPositions[deckId] - (current[deckId] || 0)) >= 0.02
          )
            ? nextPositions
            : current
        );
        const nextMeterLevel = engine.getMeterLevel();
        setMeterLevel((current) =>
          Math.abs(nextMeterLevel - current) >= 0.01 ? nextMeterLevel : current
        );
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
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
      engineRef.current?.dispose();
      engineRef.current = null;
    },
    []
  );

  useEffect(() => getEngine().setCrossfader(crossfader), [crossfader, getEngine]);
  useEffect(() => getEngine().setMasterLevel(masterLevel), [getEngine, masterLevel]);
  useEffect(() => getEngine().setLimiter(limiter), [getEngine, limiter]);
  useEffect(() => {
    const engine = getEngine();
    decks.forEach((deck) => {
      if (deck.synced) engine.setPlaybackRate(deck.id, masterBpm / deck.bpm);
    });
  }, [decks, getEngine, masterBpm]);

  const loadLane = async (deckId, laneId, file) => {
    if (!file || !file.type.startsWith('audio/')) return;
    updateDeck(deckId, (deck) => ({
      lanes: {
        ...deck.lanes,
        [laneId]: { ...deck.lanes[laneId], status: 'loading', name: file.name },
      },
    }));
    setStudioNotice(`Analyzing ${file.name} locally...`);

    try {
      const analysis = await analyzeAudioFile(file);
      const asset = await putAudioAsset(file, { name: file.name, analysis });
      const key = `${deckId}:${laneId}`;
      const oldUrl = objectUrlsRef.current.get(key);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.set(key, url);
      const deck = decks.find((item) => item.id === deckId);
      const engine = getEngine();
      const duration = await engine.loadLane(deckId, deck.side, laneId, url);

      if (laneId === 'fullMix') {
        engine.setLoop(deckId, deck.looping, analysis.bpm);
        engine.setPlaybackRate(deckId, deck.synced ? masterBpm / analysis.bpm : 1);
      }

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
        if (laneId === 'fullMix') {
          Object.assign(updates, {
            title: file.name.replace(/\.[^/.]+$/, ''),
            keyName: analysis.key.replace(' major', ' maj').replace(' minor', ' min'),
            bpm: analysis.bpm,
            duration,
            waveform: analysis.waveform,
            analysis,
          });
        }
        return updates;
      });
      setStudioNotice(`${file.name} is ready.`);
    } catch (error) {
      updateDeck(deckId, (deck) => ({
        lanes: { ...deck.lanes, [laneId]: { ...deck.lanes[laneId], status: 'error' } },
      }));
      setStudioNotice(error instanceof Error ? error.message : 'Audio could not be loaded.');
    }
  };

  const changeDeck = (deckId, updates) => {
    const deck = decks.find((item) => item.id === deckId);
    const nextDeck = { ...deck, ...updates };
    const engine = getEngine();
    if ('gain' in updates) engine.setDeckGain(deckId, updates.gain);
    if ('looping' in updates || 'bpm' in updates)
      engine.setLoop(deckId, nextDeck.looping, nextDeck.bpm);
    if ('synced' in updates || 'bpm' in updates)
      engine.setPlaybackRate(deckId, nextDeck.synced ? masterBpm / nextDeck.bpm : 1);
    updateDeck(deckId, updates);
  };

  const changeLane = (deckId, laneId, updates) => {
    getEngine().setLaneState(deckId, laneId, updates);
    updateDeck(deckId, (deck) => ({
      lanes: { ...deck.lanes, [laneId]: { ...deck.lanes[laneId], ...updates } },
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

  const toggleGlobalTransport = async () => {
    const loadedDecks = decks.filter((deck) => deck.duration);
    if (loadedDecks.some((deck) => deck.playing)) {
      getEngine().pauseAll();
      setDecks((current) => current.map((deck) => ({ ...deck, playing: false })));
      return;
    }
    await getEngine().playAll();
    setDecks((current) => current.map((deck) => ({ ...deck, playing: Boolean(deck.duration) })));
  };

  const stopGlobalTransport = () => {
    getEngine().stopAll();
    setPositions({ A: 0, B: 0, C: 0, D: 0 });
    setDecks((current) => current.map((deck) => ({ ...deck, playing: false })));
  };

  const triggerPad = async (index, frequency) => {
    setActivePad(index);
    window.setTimeout(() => setActivePad(null), 150);
    await getEngine().triggerPad(index, frequency);
  };

  const toggleCapture = async () => {
    try {
      if (!captureActive) {
        await getEngine().startRecording();
        setCaptureActive(true);
        setStudioNotice('Master recording started.');
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
      setLibraryTab('recordings');
      setStudioNotice(`${name} saved locally.`);
    } catch (error) {
      setCaptureActive(false);
      setStudioNotice(error instanceof Error ? error.message : 'Recording is unavailable.');
    }
  };

  const toggleMicrophone = async () => {
    try {
      if (microphoneActive) {
        getEngine().closeMicrophone();
        setMicrophoneActive(false);
      } else {
        await getEngine().openMicrophone();
        setMicrophoneActive(true);
      }
    } catch {
      setStudioNotice('Microphone permission was not granted.');
    }
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

  const exportSession = () => {
    const manifest = {
      schema: 'SattariStudio.arrangement.v2',
      product: 'Sattari Studio',
      sessionName,
      createdAt: new Date().toISOString(),
      master: { bpm: masterBpm, level: masterLevel, crossfader, limiter },
      decks,
      recordings,
      source: transfer || null,
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'sattari-session'}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const newSession = () => {
    if (
      !window.confirm(
        'Start a new session? Current local audio assets will remain in your library.'
      )
    )
      return;
    engineRef.current?.stopAll();
    engineRef.current?.dispose();
    engineRef.current = null;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    clearStudioSession();
    setDecks(createEmptyDecks());
    setPositions({ A: 0, B: 0, C: 0, D: 0 });
    setSessionName('Untitled session');
    setTransfer(null);
    setRecordings([]);
    setCrossfader(50);
    setMasterLevel(82);
    setMasterBpm(96);
    setLimiter(true);
    setMicrophoneActive(false);
    setCaptureActive(false);
    setLibraryTab('session');
    setStudioNotice('New session ready.');
  };

  const loadedDecks = decks.filter((deck) => deck.duration);
  const loadedStems = decks.flatMap((deck) =>
    Object.values(deck.lanes)
      .filter((lane) => lane.id !== 'fullMix' && lane.assetId)
      .map((lane) => ({ ...lane, deckId: deck.id, deckColor: deck.color }))
  );
  const anyPlaying = decks.some((deck) => deck.playing);
  const masterPosition = Math.max(0, ...Object.values(positions));
  const activeMeterBars = Math.round(Math.min(1, Math.max(0, meterLevel)) * 18);

  return (
    <>
      <SEO
        title="Sattari Studio - Create, Remix and Perform"
        description="A local four-deck audio workspace for arranging, recording, practicing, and shaping music in the browser."
        image="/sattari site/audio-suite/create.png"
        url="https://sattarimusic.com/studio"
      />
      <section className="audio-workspace studio-workspace">
        <div className="audio-workspace-topbar studio-topbar">
          <div>
            <p className="audio-workspace-kicker">Sattari creation system</p>
            <h1>Studio</h1>
          </div>
          <div className="audio-product-switch" aria-label="Audio products">
            <Link to="/hub">Hub</Link>
            <Link to="/learn">Learn</Link>
            <Link to="/studio" className="is-active">
              Studio
            </Link>
          </div>
          <div className="studio-session-name">
            <span>Session</span>
            <input
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
              aria-label="Session name"
            />
          </div>
          <div className="studio-header-actions">
            <button
              type="button"
              onClick={toggleCapture}
              className={captureActive ? 'is-recording' : ''}
            >
              <Circle size={13} fill="currentColor" /> {captureActive ? 'Stop' : 'Record'}
            </button>
            <button type="button" onClick={newSession} title="New session" aria-label="New session">
              <Trash2 size={15} />
            </button>
            <button
              type="button"
              onClick={exportSession}
              title="Export session"
              aria-label="Export session"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {transfer && (
          <div className="studio-transfer-banner">
            <span>
              <Sparkles size={16} />
            </span>
            <div>
              <small>Music map received from Learn</small>
              <strong>
                {transfer.trackName} / {transfer.key} / {transfer.bpm} BPM
              </strong>
            </div>
            <button type="button" onClick={() => setTransfer(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="studio-control-strip">
          <div className="studio-clock">
            <span>MASTER</span>
            <strong>{formatTime(masterPosition, true)}</strong>
          </div>
          <div className="studio-global-transport">
            <button
              type="button"
              title="Return to start"
              aria-label="Return to start"
              onClick={stopGlobalTransport}
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              className="is-primary"
              title={anyPlaying ? 'Pause loaded decks' : 'Play loaded decks'}
              aria-label={anyPlaying ? 'Pause loaded decks' : 'Play loaded decks'}
              onClick={toggleGlobalTransport}
              disabled={!loadedDecks.length}
            >
              {anyPlaying ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <button type="button" title="Stop" aria-label="Stop" onClick={stopGlobalTransport}>
              <span className="stop-icon" />
            </button>
          </div>
          <div className="studio-master-readout studio-master-tempo">
            <button
              type="button"
              onClick={() => setMasterBpm((value) => Math.max(40, value - 1))}
              aria-label="Lower master BPM"
            >
              <Minus size={11} />
            </button>
            <span>{masterBpm}</span>
            <button
              type="button"
              onClick={() => setMasterBpm((value) => Math.min(220, value + 1))}
              aria-label="Raise master BPM"
            >
              <Plus size={11} />
            </button>
            <small>BPM</small>
          </div>
          <div className="studio-sync-status">
            <i /> {restored ? 'Saved locally' : 'Restoring'}
          </div>
          <button
            type="button"
            className={`studio-input-readout${microphoneActive ? ' is-active' : ''}`}
            onClick={toggleMicrophone}
          >
            <Mic2 size={15} />
            <span>Input</span>
            <strong>{microphoneActive ? 'Live' : 'Off'}</strong>
          </button>
        </div>

        {studioNotice && (
          <div className="studio-notice" role="status">
            {studioNotice}
          </div>
        )}

        <div className="studio-body-grid">
          <aside className="studio-browser workspace-panel">
            <div className="studio-panel-title">
              <ListMusic size={16} />
              <strong>Library</strong>
            </div>
            <nav aria-label="Studio library">
              <button
                type="button"
                className={libraryTab === 'session' ? 'is-active' : ''}
                onClick={() => setLibraryTab('session')}
              >
                <Waves size={15} />
                <span>Session audio</span>
                <small>{loadedDecks.length}</small>
              </button>
              <button
                type="button"
                className={libraryTab === 'stems' ? 'is-active' : ''}
                onClick={() => setLibraryTab('stems')}
              >
                <Layers3 size={15} />
                <span>Stem lanes</span>
                <small>{loadedStems.length}</small>
              </button>
              <button
                type="button"
                className={libraryTab === 'recordings' ? 'is-active' : ''}
                onClick={() => setLibraryTab('recordings')}
              >
                <Radio size={15} />
                <span>Recordings</span>
                <small>{recordings.length}</small>
              </button>
              <button
                type="button"
                className={libraryTab === 'exports' ? 'is-active' : ''}
                onClick={() => setLibraryTab('exports')}
              >
                <FileAudio size={15} />
                <span>Project</span>
                <small>JSON</small>
              </button>
            </nav>
            <div className="studio-browser-divider" />
            <p className="studio-browser-label">
              {libraryTab === 'session'
                ? 'Loaded tracks'
                : libraryTab === 'stems'
                  ? 'Loaded stems'
                  : libraryTab === 'recordings'
                    ? 'Local recordings'
                    : 'Portable session'}
            </p>
            {libraryTab === 'session' &&
              loadedDecks.map((deck) => (
                <button
                  type="button"
                  className="studio-library-track"
                  key={deck.id}
                  onClick={() =>
                    document
                      .querySelector(`.studio-deck-${deck.id}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                >
                  <span className={`track-color track-color-${deck.color}`} />
                  <span>
                    <strong>{deck.title}</strong>
                    <small>
                      {deck.bpm} BPM / {deck.keyName}
                    </small>
                  </span>
                </button>
              ))}
            {libraryTab === 'stems' &&
              loadedStems.map((lane) => (
                <button
                  type="button"
                  className="studio-library-track"
                  key={`${lane.deckId}-${lane.id}`}
                  onClick={() =>
                    document
                      .querySelector(`.studio-deck-${lane.deckId}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                >
                  <span className={`track-color track-color-${lane.color}`} />
                  <span>
                    <strong>{lane.name}</strong>
                    <small>
                      Deck {lane.deckId} / {lane.label}
                    </small>
                  </span>
                </button>
              ))}
            {libraryTab === 'recordings' &&
              recordings.map((recording) => (
                <button
                  type="button"
                  className="studio-library-track"
                  key={recording.id}
                  onClick={() => downloadRecording(recording)}
                >
                  <span className="track-color track-color-coral" />
                  <span>
                    <strong>{recording.name}</strong>
                    <small>{Math.max(1, Math.round(recording.size / 1024))} KB / download</small>
                  </span>
                </button>
              ))}
            {libraryTab === 'exports' && (
              <div className="studio-project-summary">
                <strong>{sessionName}</strong>
                <span>
                  {loadedDecks.length} deck{loadedDecks.length === 1 ? '' : 's'} /{' '}
                  {loadedStems.length} stem{loadedStems.length === 1 ? '' : 's'}
                </span>
                <button type="button" onClick={exportSession}>
                  <Download size={14} /> Export project
                </button>
              </div>
            )}
            {libraryTab === 'session' && !loadedDecks.length && (
              <p className="studio-browser-empty">No audio loaded</p>
            )}
            {libraryTab === 'stems' && !loadedStems.length && (
              <p className="studio-browser-empty">No stems loaded</p>
            )}
            {libraryTab === 'recordings' && !recordings.length && (
              <p className="studio-browser-empty">No recordings yet</p>
            )}
            {(libraryTab === 'session' || libraryTab === 'stems') && (
              <button
                type="button"
                className="studio-browser-import"
                onClick={() =>
                  document
                    .querySelector(
                      `.studio-deck-A input[data-lane="${libraryTab === 'stems' ? 'drums' : 'fullMix'}"]`
                    )
                    ?.click()
                }
              >
                <Plus size={15} /> {libraryTab === 'stems' ? 'Add stem' : 'Import audio'}
              </button>
            )}
          </aside>

          <div className="studio-decks-grid">
            {decks.map((deck) => (
              <StudioDeck
                key={deck.id}
                deck={deck}
                masterBpm={masterBpm}
                position={positions[deck.id] || 0}
                onLoadLane={(laneId, file) => loadLane(deck.id, laneId, file)}
                onDeckChange={(updates) => changeDeck(deck.id, updates)}
                onLaneChange={(laneId, updates) => changeLane(deck.id, laneId, updates)}
                onTogglePlay={() => toggleDeck(deck.id)}
                onStop={() => {
                  getEngine().stopDeck(deck.id);
                  updateDeck(deck.id, { playing: false });
                  setPositions((current) => ({ ...current, [deck.id]: 0 }));
                }}
                onSeek={(seconds) => getEngine().seekDeck(deck.id, seconds)}
              />
            ))}
          </div>

          <aside className="studio-master workspace-panel">
            <div className="studio-panel-title">
              <SlidersHorizontal size={16} />
              <strong>Master</strong>
            </div>
            <div className="studio-meter" aria-label="Master level meter">
              {Array.from({ length: 18 }, (_, index) => (
                <span
                  key={index}
                  className={`${index > 14 ? 'is-hot' : index > 10 ? 'is-warm' : ''}${index >= activeMeterBars ? ' is-idle' : ''}`}
                />
              ))}
            </div>
            <div className="studio-master-value">
              <strong>{masterLevel}</strong>
              <span>%</span>
            </div>
            <label className="studio-master-fader">
              <input
                type="range"
                min="0"
                max="100"
                value={masterLevel}
                onChange={(event) => setMasterLevel(Number(event.target.value))}
                aria-label="Master volume"
              />
            </label>
            <div className="studio-master-tools">
              <button
                type="button"
                className={microphoneActive ? 'is-active' : ''}
                onClick={toggleMicrophone}
              >
                <Mic2 size={15} /> Mic
              </button>
              <button
                type="button"
                className={limiter ? 'is-active' : ''}
                onClick={() => setLimiter((value) => !value)}
              >
                <AudioWaveform size={15} /> Limit
              </button>
            </div>
            <div className="studio-master-divider" />
            <div className="studio-record-block">
              <span className={captureActive ? 'is-live' : ''}>
                <Circle size={13} fill="currentColor" />
              </span>
              <div>
                <strong>Master recording</strong>
                <small>
                  {captureActive
                    ? 'Recording the master output'
                    : `${recordings.length} local take${recordings.length === 1 ? '' : 's'}`}
                </small>
              </div>
            </div>
            <button type="button" className="studio-save-button" onClick={exportSession}>
              <Save size={15} /> Export project
            </button>
          </aside>
        </div>

        <div className="studio-performance-strip">
          <div className="studio-pads-section">
            <div className="performance-heading">
              <span>Performance pads</span>
              <small>Bank A</small>
            </div>
            <div className="studio-pads">
              {PERFORMANCE_PADS.map(([label, frequency], index) => (
                <button
                  type="button"
                  key={label}
                  className={activePad === index ? 'is-hit' : ''}
                  onClick={() => triggerPad(index, frequency)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
          </div>
          <div className="studio-crossfader-section">
            <div className="performance-heading">
              <span>Crossfader</span>
              <small>
                {crossfader === 50
                  ? 'Center'
                  : crossfader < 50
                    ? `A/C ${100 - crossfader}%`
                    : `B/D ${crossfader}%`}
              </small>
            </div>
            <div className="studio-crossfader-labels">
              <span>A / C</span>
              <span>B / D</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={crossfader}
              onChange={(event) => setCrossfader(Number(event.target.value))}
              aria-label="Crossfader"
            />
            <button type="button" onClick={() => setCrossfader(50)}>
              Reset center
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
