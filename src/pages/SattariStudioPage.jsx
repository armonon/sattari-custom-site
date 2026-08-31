import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AudioWaveform,
  ChevronDown,
  Circle,
  Download,
  FileAudio,
  Headphones,
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
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Volume2,
  Waves,
} from 'lucide-react';
import { SEO } from '../utils/seo';

const deckSeeds = [
  { id: 'A', title: 'Midnight Drive', keyName: 'A min', bpm: 96, color: 'cyan', side: 'left' },
  { id: 'B', title: 'Empty deck', keyName: '--', bpm: 124, color: 'coral', side: 'right' },
  { id: 'C', title: 'Soul Percussion', keyName: 'D min', bpm: 96, color: 'green', side: 'left' },
  { id: 'D', title: 'Empty deck', keyName: '--', bpm: 96, color: 'gold', side: 'right' },
];

const pads = [
  ['Kick', 72],
  ['Snare', 180],
  ['Hat', 420],
  ['Clap', 260],
  ['Vox', 520],
  ['Rise', 760],
  ['Perc', 330],
  ['One', 610],
];

function DeckWaveform({ color, playing }) {
  const bars = useMemo(
    () => Array.from({ length: 66 }, (_, index) => 12 + ((index * 23 + index * index * 5) % 80)),
    []
  );

  return (
    <div className={`studio-waveform studio-waveform-${color}${playing ? ' is-playing' : ''}`}>
      {bars.map((height, index) => (
        <span key={index} style={{ '--wave-height': `${height}%` }} />
      ))}
      <i className="studio-playhead" />
    </div>
  );
}

function StemLane({ label, color, available = true }) {
  const [muted, setMuted] = useState(false);
  const [solo, setSolo] = useState(false);
  const [gain, setGain] = useState(available ? 74 : 24);

  return (
    <div className={`stem-lane${available ? '' : ' is-unavailable'}`}>
      <span className={`stem-dot stem-dot-${color}`} />
      <strong>{label}</strong>
      <button
        type="button"
        className={muted ? 'is-active' : ''}
        onClick={() => available && setMuted((value) => !value)}
        disabled={!available}
        title={`Mute ${label}`}
        aria-label={`Mute ${label}`}
      >
        M
      </button>
      <button
        type="button"
        className={solo ? 'is-active is-solo' : ''}
        onClick={() => available && setSolo((value) => !value)}
        disabled={!available}
        title={`Solo ${label}`}
        aria-label={`Solo ${label}`}
      >
        S
      </button>
      <input
        type="range"
        min="0"
        max="100"
        value={gain}
        onChange={(event) => setGain(Number(event.target.value))}
        disabled={!available}
        aria-label={`${label} level`}
      />
    </div>
  );
}

function StudioDeck({ deck, masterLevel, crossfader, transportCommand }) {
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [trackName, setTrackName] = useState(deck.title);
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(deck.bpm);
  const [looping, setLooping] = useState(false);
  const [deckGain, setDeckGain] = useState(82);
  const [splitState, setSplitState] = useState('idle');
  const [synced, setSynced] = useState(false);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );

  useEffect(() => {
    if (!audioRef.current) return;
    const sideGain = deck.side === 'left' ? (100 - crossfader) / 50 : crossfader / 50;
    audioRef.current.volume = Math.min(1, (masterLevel / 100) * (deckGain / 100) * sideGain);
  }, [crossfader, deck.side, deckGain, masterLevel]);

  useEffect(() => {
    if (!transportCommand || !audioRef.current) return;

    if (transportCommand.action === 'play' && audioUrl) {
      audioRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }

    if (transportCommand.action === 'stop') {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    }

    if (transportCommand.action === 'reset') {
      audioRef.current.currentTime = 0;
    }
  }, [audioUrl, transportCommand]);

  const loadAudio = (file) => {
    if (!file || !file.type.startsWith('audio/')) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(file));
    setTrackName(file.name.replace(/\.[^/.]+$/, ''));
    setPlaying(false);
  };

  const togglePlay = async () => {
    if (!audioRef.current || !audioUrl) return;
    if (audioRef.current.paused) {
      await audioRef.current.play();
      setPlaying(true);
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  };

  const requestSplit = () => {
    setSplitState('checking');
    window.setTimeout(() => setSplitState('bridge'), 650);
  };

  const cueToStart = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setPlaying(false);
  };

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
          onClick={() => fileInputRef.current?.click()}
          title="Load audio"
        >
          <span>{trackName}</span>
          <ChevronDown size={14} />
        </button>
        <span className="deck-key">{deck.keyName}</span>
      </header>

      <div className="deck-main-row">
        <button
          type="button"
          className="deck-play-button"
          onClick={togglePlay}
          disabled={!audioUrl}
          aria-label={playing ? `Pause deck ${deck.id}` : `Play deck ${deck.id}`}
          title={audioUrl ? (playing ? 'Pause' : 'Play') : 'Load audio to play'}
        >
          {playing ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <div className="deck-wave-shell">
          <DeckWaveform color={deck.color} playing={playing} />
          <div className="deck-timeline">
            <span>00:00</span>
            <span>01:31</span>
          </div>
        </div>
      </div>

      <div className="deck-transport-row">
        <div className="deck-bpm-control">
          <span>BPM</span>
          <button
            type="button"
            onClick={() => setBpm((value) => Math.max(40, value - 1))}
            aria-label="Lower BPM"
          >
            <Minus size={12} />
          </button>
          <strong>{bpm}</strong>
          <button
            type="button"
            onClick={() => setBpm((value) => Math.min(220, value + 1))}
            aria-label="Raise BPM"
          >
            <Plus size={12} />
          </button>
        </div>
        <button
          type="button"
          className={looping ? 'deck-tool is-active' : 'deck-tool'}
          onClick={() => setLooping((value) => !value)}
        >
          <RefreshCw size={13} /> 4 beat
        </button>
        <button
          type="button"
          className={synced ? 'deck-tool is-active' : 'deck-tool'}
          onClick={() => {
            setSynced((value) => !value);
            setBpm(96);
          }}
        >
          <Link2 size={13} /> Sync
        </button>
        <button type="button" className="deck-tool" onClick={cueToStart}>
          <Scissors size={13} /> Cue
        </button>
      </div>

      <div className="deck-stem-header">
        <span>Stem lanes</span>
        <button type="button" onClick={requestSplit} disabled={splitState === 'checking'}>
          <Sparkles size={13} />
          {splitState === 'checking'
            ? 'Checking...'
            : splitState === 'bridge'
              ? 'Desktop bridge needed'
              : 'AI Split'}
        </button>
      </div>
      <div className="deck-stems">
        <StemLane label="Full mix" color={deck.color} />
        <StemLane label="Drums" color="green" available={false} />
        <StemLane label="Bass" color="gold" available={false} />
        <StemLane label="Music" color="cyan" available={false} />
        <StemLane label="Vocals" color="coral" available={false} />
      </div>

      <div className="deck-footer-controls">
        <label>
          <Volume2 size={14} />
          <input
            type="range"
            min="0"
            max="100"
            value={deckGain}
            onChange={(event) => setDeckGain(Number(event.target.value))}
            aria-label={`Deck ${deck.id} gain`}
          />
        </label>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={13} /> Load track
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => loadAudio(event.target.files?.[0])}
      />
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        loop={looping}
        onEnded={() => setPlaying(false)}
      />
    </article>
  );
}

export default function SattariStudioPage() {
  const [crossfader, setCrossfader] = useState(50);
  const [masterLevel, setMasterLevel] = useState(82);
  const [activePad, setActivePad] = useState(null);
  const [captureActive, setCaptureActive] = useState(false);
  const [sessionName, setSessionName] = useState('Untitled session');
  const [transfer, setTransfer] = useState(null);
  const [transportCommand, setTransportCommand] = useState(null);
  const [libraryTab, setLibraryTab] = useState('session');
  const [masterCue, setMasterCue] = useState(false);
  const [limiter, setLimiter] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sattari-studio-transfer-v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        setTransfer(parsed);
        setSessionName(`${parsed.trackName} study`);
      }
    } catch {
      setTransfer(null);
    }
  }, []);

  const triggerPad = (index, frequency) => {
    setActivePad(index);
    window.setTimeout(() => setActivePad(null), 150);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = index % 3 === 0 ? 'sine' : index % 3 === 1 ? 'triangle' : 'square';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.16, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.17);
    oscillator.onended = () => context.close();
  };

  const exportSession = () => {
    const manifest = {
      product: 'Sattari Studio',
      sessionName,
      createdAt: new Date().toISOString(),
      masterLevel,
      crossfader,
      source: transfer || null,
      note: 'Arrangement manifest from the Sattari Studio web preview.',
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sendTransport = (action) => {
    setTransportCommand({ id: Date.now(), action });
  };

  const focusDeck = (deckId) => {
    document.querySelector(`.studio-deck-${deckId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  return (
    <>
      <SEO
        title="Sattari Studio - Create, Remix and Perform"
        description="A web-native four-deck stem workspace for remixing, practicing, and shaping music with the Sattari audio system."
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
              onClick={() => setCaptureActive((value) => !value)}
              className={captureActive ? 'is-recording' : ''}
            >
              <Circle size={13} fill="currentColor" /> {captureActive ? 'Capturing' : 'Capture'}
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
            <strong>00:00:00</strong>
          </div>
          <div className="studio-global-transport">
            <button
              type="button"
              title="Return to start"
              aria-label="Return to start"
              onClick={() => sendTransport('reset')}
            >
              <RefreshCw size={15} />
            </button>
            <button
              type="button"
              className="is-primary"
              title="Play loaded decks"
              aria-label="Play loaded decks"
              onClick={() => sendTransport('play')}
            >
              <Play size={17} />
            </button>
            <button
              type="button"
              title="Stop"
              aria-label="Stop"
              onClick={() => sendTransport('stop')}
            >
              <span className="stop-icon" />
            </button>
          </div>
          <div className="studio-master-readout">
            <span>96.0</span>
            <small>BPM</small>
          </div>
          <div className="studio-sync-status">
            <i /> Link ready
          </div>
          <div className="studio-input-readout">
            <Mic2 size={15} />
            <span>Input</span>
            <strong>Off</strong>
          </div>
        </div>

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
                <small>2</small>
              </button>
              <button
                type="button"
                className={libraryTab === 'stems' ? 'is-active' : ''}
                onClick={() => setLibraryTab('stems')}
              >
                <Layers3 size={15} />
                <span>Stem sets</span>
                <small>0</small>
              </button>
              <button
                type="button"
                className={libraryTab === 'recordings' ? 'is-active' : ''}
                onClick={() => setLibraryTab('recordings')}
              >
                <Radio size={15} />
                <span>Recordings</span>
                <small>0</small>
              </button>
              <button
                type="button"
                className={libraryTab === 'exports' ? 'is-active' : ''}
                onClick={() => setLibraryTab('exports')}
              >
                <FileAudio size={15} />
                <span>Exports</span>
                <small>0</small>
              </button>
            </nav>
            <div className="studio-browser-divider" />
            <p className="studio-browser-label">Quick load</p>
            <button type="button" className="studio-library-track" onClick={() => focusDeck('A')}>
              <span className="track-color track-color-cyan" />
              <span>
                <strong>Midnight Drive</strong>
                <small>96 BPM / A min</small>
              </span>
            </button>
            <button type="button" className="studio-library-track" onClick={() => focusDeck('C')}>
              <span className="track-color track-color-green" />
              <span>
                <strong>Soul Percussion</strong>
                <small>96 BPM / D min</small>
              </span>
            </button>
            <button
              type="button"
              className="studio-browser-import"
              onClick={() => document.querySelector('.studio-deck-A .deck-title')?.click()}
            >
              <Plus size={15} /> Import audio
            </button>
          </aside>

          <div className="studio-decks-grid">
            {deckSeeds.map((deck) => (
              <StudioDeck
                key={deck.id}
                deck={deck}
                masterLevel={masterLevel}
                crossfader={crossfader}
                transportCommand={transportCommand}
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
                <span key={index} className={index > 14 ? 'is-hot' : index > 10 ? 'is-warm' : ''} />
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
                className={masterCue ? 'is-active' : ''}
                onClick={() => setMasterCue((value) => !value)}
              >
                <Headphones size={15} /> Cue
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
                <strong>Arrangement</strong>
                <small>
                  {captureActive ? 'Events are being captured' : 'Capture your performance'}
                </small>
              </div>
            </div>
            <button type="button" className="studio-save-button" onClick={exportSession}>
              <Save size={15} /> Save manifest
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
              {pads.map(([label, frequency], index) => (
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
