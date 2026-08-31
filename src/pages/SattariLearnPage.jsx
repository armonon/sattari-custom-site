import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AudioWaveform,
  Cable,
  Check,
  ChevronRight,
  Drum,
  FileAudio,
  Gauge,
  Guitar,
  Headphones,
  Lightbulb,
  Mic2,
  Music2,
  Pause,
  Piano,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  Upload,
  Zap,
} from 'lucide-react';
import { SEO } from '../utils/seo';

const analysis = {
  key: 'A minor',
  bpm: 96,
  feel: 'Laid-back 4/4',
  chords: ['Am7', 'Fmaj7', 'C', 'G'],
  sections: [
    { name: 'Intro', range: '0:00 - 0:14', width: 16 },
    { name: 'Verse', range: '0:14 - 0:44', width: 34 },
    { name: 'Hook', range: '0:44 - 1:12', width: 29 },
    { name: 'Bridge', range: '1:12 - 1:31', width: 21 },
  ],
};

const instruments = [
  { id: 'piano', label: 'Piano', icon: Piano },
  { id: 'guitar', label: 'Guitar', icon: Guitar },
  { id: 'drums', label: 'Drums', icon: Drum },
  { id: 'bass', label: 'Bass', icon: Music2 },
];

const practicePlans = {
  piano: [
    ['Find the home note', 'Play A below middle C and listen for the sense of rest.'],
    ['Build the movement', 'Move through Am7, Fmaj7, C, and G at half speed.'],
    ['Add the top voice', 'Hold each chord and play E, E, G, D above it.'],
  ],
  guitar: [
    ['Anchor the progression', 'Start with open Am, Fmaj7, C, and G shapes.'],
    ['Clean chord changes', 'Loop two bars and change on beats one and three.'],
    ['Shape the groove', 'Use down, down-up, rest, up-down-up.'],
  ],
  drums: [
    ['Lock the pulse', 'Tap quarter notes at 96 BPM for two full phrases.'],
    ['Find the backbeat', 'Place the snare on beats two and four.'],
    ['Add subdivision', 'Keep eighth notes even while the kick moves.'],
  ],
  bass: [
    ['Play the roots', 'Follow A, F, C, and G with one note per bar.'],
    ['Lead the changes', 'Approach each new root from one step below.'],
    ['Make it breathe', 'Leave beat four open before every chord change.'],
  ],
};

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiNoteName(note) {
  const octave = Math.floor(note / 12) - 1;
  return `${noteNames[note % 12]}${octave}`;
}

function LearnWaveform({ active = false }) {
  const bars = useMemo(
    () => Array.from({ length: 72 }, (_, index) => 18 + ((index * 17 + index * index * 3) % 70)),
    []
  );

  return (
    <div className={`learn-waveform${active ? ' is-active' : ''}`} aria-hidden="true">
      {bars.map((height, index) => (
        <span key={index} style={{ '--wave-height': `${height}%` }} />
      ))}
      <i />
    </div>
  );
}

function PianoGuide() {
  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', 'B'];

  return (
    <div className="learn-piano" aria-label="Piano guide highlighting notes in A minor">
      {notes.map((note, index) => (
        <span
          key={`${note}-${index}`}
          className={['A', 'C', 'E'].includes(note) ? 'is-chord-tone' : ''}
          data-note={note}
        />
      ))}
    </div>
  );
}

function ChordStrip() {
  const [activeChord, setActiveChord] = useState(0);

  return (
    <div className="learn-chord-strip" aria-label="Chord progression">
      {analysis.chords.map((chord, index) => (
        <button
          type="button"
          key={chord}
          className={index === activeChord ? 'is-current' : ''}
          onClick={() => setActiveChord(index)}
        >
          <span>{index + 1}</span>
          <strong>{chord}</strong>
          <small>{index === activeChord ? 'Selected' : `Bar ${index * 2 + 1}`}</small>
        </button>
      ))}
    </div>
  );
}

export default function SattariLearnPage() {
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const teachTimerRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [trackName, setTrackName] = useState('Sattari Demo Groove');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(true);
  const [activeMode, setActiveMode] = useState('analyze');
  const [instrument, setInstrument] = useState('piano');
  const [dropActive, setDropActive] = useState(false);
  const [selectedSection, setSelectedSection] = useState(1);
  const [progressionLoop, setProgressionLoop] = useState(false);
  const [activeExercise, setActiveExercise] = useState(null);
  const [tapTimes, setTapTimes] = useState([]);
  const [midiState, setMidiState] = useState({ status: 'idle', note: '' });
  const [micState, setMicState] = useState('idle');

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (teachTimerRef.current) window.clearTimeout(teachTimerRef.current);
    },
    [audioUrl]
  );

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('audio/')) return;

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const nextUrl = URL.createObjectURL(file);
    setAudioUrl(nextUrl);
    setTrackName(file.name.replace(/\.[^/.]+$/, ''));
    setAnalysisReady(false);
    setIsPlaying(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDropActive(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const handleTeach = () => {
    setIsAnalyzing(true);
    setAnalysisReady(false);
    if (teachTimerRef.current) window.clearTimeout(teachTimerRef.current);
    teachTimerRef.current = window.setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisReady(true);
      setActiveMode('analyze');
    }, 1100);
  };

  const togglePlayback = async () => {
    if (!audioUrl || !audioRef.current) return;

    if (audioRef.current.paused) {
      await audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTap = () => {
    const now = performance.now();
    setTapTimes((times) => [...times.slice(-7), now]);
  };

  const rhythmScore = useMemo(() => {
    if (tapTimes.length < 2) return null;
    const targetInterval = 60000 / analysis.bpm;
    const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
    const averageError =
      intervals.reduce((sum, interval) => sum + Math.abs(interval - targetInterval), 0) /
      intervals.length;
    return Math.max(0, Math.round(100 - (averageError / targetInterval) * 100));
  }, [tapTimes]);

  const connectMidi = async () => {
    if (!navigator.requestMIDIAccess) {
      setMidiState({ status: 'unsupported', note: '' });
      return;
    }

    try {
      const access = await navigator.requestMIDIAccess();
      const inputs = Array.from(access.inputs.values());
      inputs.forEach((input) => {
        input.onmidimessage = (event) => {
          const [command, note, velocity] = event.data;
          if ((command & 0xf0) === 0x90 && velocity > 0) {
            setMidiState({ status: 'connected', note: midiNoteName(note) });
          }
        };
      });
      setMidiState({ status: inputs.length ? 'connected' : 'empty', note: '' });
    } catch {
      setMidiState({ status: 'denied', note: '' });
    }
  };

  const connectMic = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState('unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicState('ready');
    } catch {
      setMicState('denied');
    }
  };

  const saveForStudio = () => {
    window.localStorage.setItem(
      'sattari-studio-transfer-v1',
      JSON.stringify({ trackName, key: analysis.key, bpm: analysis.bpm, chords: analysis.chords })
    );
  };

  return (
    <>
      <SEO
        title="Sattari Learn - Turn Songs Into Lessons"
        description="Analyze songs, understand the music, and build guided practice for piano, guitar, drums, and bass with Sattari Learn."
        image="/sattari site/audio-suite/brain.png"
        url="https://sattarimusic.com/learn"
      />
      <section className="audio-workspace learn-workspace">
        <div className="audio-workspace-topbar">
          <div>
            <p className="audio-workspace-kicker">Sattari music intelligence</p>
            <h1>Learn</h1>
          </div>
          <div className="audio-product-switch" aria-label="Audio products">
            <Link to="/hub">Hub</Link>
            <Link to="/learn" className="is-active">
              Learn
            </Link>
            <Link to="/studio">Studio</Link>
          </div>
          <span className="workspace-status">
            <i /> Interactive preview
          </span>
        </div>

        <div className="learn-intro">
          <div>
            <p className="audio-workspace-kicker">Bring the song. Leave with a way to play it.</p>
            <h2>
              Hear what is happening.
              <br />
              Practice what matters.
            </h2>
          </div>
          <p>
            Turn a track into chords, structure, instrument-specific exercises, and a rhythm
            challenge. Your music stays in this browser during this preview.
          </p>
        </div>

        <div className="learn-command-grid">
          <aside className="learn-source-panel workspace-panel">
            <div className="workspace-panel-heading">
              <span>01</span>
              <div>
                <p>Source</p>
                <strong>Choose a song</strong>
              </div>
            </div>

            <button
              type="button"
              className={`learn-dropzone${dropActive ? ' is-dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDropActive(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDropActive(false)}
              onDrop={handleDrop}
            >
              <span className="dropzone-icon">
                <Upload size={21} />
              </span>
              <strong>Drop an audio file</strong>
              <small>or choose from your device</small>
              <span className="learn-file-types">MP3&nbsp;&nbsp; WAV&nbsp;&nbsp; M4A</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(event) => loadFile(event.target.files?.[0])}
            />

            <div className="learn-track-card">
              <div className="learn-track-art">
                <FileAudio size={22} />
              </div>
              <div className="learn-track-copy">
                <strong>{trackName}</strong>
                <span>{audioUrl ? 'Local audio file' : 'Built-in lesson map'}</span>
              </div>
              <button
                type="button"
                onClick={togglePlayback}
                disabled={!audioUrl}
                aria-label={isPlaying ? 'Pause track' : 'Play track'}
                title={audioUrl ? (isPlaying ? 'Pause' : 'Play') : 'Upload audio to play'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>
            <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => setIsPlaying(false)} />

            <button
              type="button"
              className="learn-teach-button"
              onClick={handleTeach}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <RefreshCw size={18} className="is-spinning" />
              ) : (
                <Sparkles size={18} />
              )}
              {isAnalyzing ? 'Listening...' : 'Teach this song'}
              {!isAnalyzing && <ChevronRight size={17} />}
            </button>

            <div className="learn-private-note">
              <Headphones size={15} />
              <span>Local preview. Uploaded audio is not saved.</span>
            </div>
          </aside>

          <div className="learn-analysis-panel workspace-panel">
            <div className="workspace-panel-heading analysis-heading">
              <span>02</span>
              <div>
                <p>Music map</p>
                <strong>{analysisReady ? 'Ready to explore' : 'Waiting for analysis'}</strong>
              </div>
              <div className={`analysis-state${analysisReady ? ' is-ready' : ''}`}>
                {analysisReady ? <Check size={14} /> : <AudioWaveform size={14} />}
                {analysisReady ? 'Demo analysis' : 'Not analyzed'}
              </div>
            </div>

            <LearnWaveform active={isPlaying || isAnalyzing} />

            <div className="learn-stat-grid">
              <div>
                <span>Key</span>
                <strong>{analysis.key}</strong>
                <small>Relative C major</small>
              </div>
              <div>
                <span>Tempo</span>
                <strong>
                  {analysis.bpm} <small>BPM</small>
                </strong>
                <small>Steady pocket</small>
              </div>
              <div>
                <span>Feel</span>
                <strong>{analysis.feel}</strong>
                <small>8th-note pulse</small>
              </div>
            </div>

            <div className="learn-section-map" aria-label="Song sections">
              {analysis.sections.map((section, index) => (
                <button
                  type="button"
                  key={section.name}
                  className={index === selectedSection ? 'is-selected' : ''}
                  style={{ width: `${section.width}%` }}
                  onClick={() => setSelectedSection(index)}
                >
                  <strong>{section.name}</strong>
                  <span>{section.range}</span>
                </button>
              ))}
            </div>

            <div className="learn-progression-heading">
              <div>
                <span>Core progression</span>
                <small>Four bars, repeating</small>
              </div>
              <button
                type="button"
                className={progressionLoop ? 'is-active' : ''}
                title="Loop progression"
                aria-label="Loop progression"
                aria-pressed={progressionLoop}
                onClick={() => setProgressionLoop((value) => !value)}
              >
                <RefreshCw size={15} />
              </button>
            </div>
            <ChordStrip />
          </div>
        </div>

        <div className="learn-mode-bar" role="tablist" aria-label="Learn modes">
          {[
            ['analyze', AudioWaveform, 'Analyze'],
            ['practice', Music2, 'Practice'],
            ['challenge', Target, 'Challenge'],
            ['suggest', Lightbulb, 'Suggest'],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeMode === id}
              className={activeMode === id ? 'is-active' : ''}
              onClick={() => setActiveMode(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>

        <section className="learn-mode-content workspace-panel">
          {activeMode === 'analyze' && (
            <div className="learn-explanation-layout">
              <div className="learn-concept-callout">
                <span className="concept-number">01</span>
                <p>Why it works</p>
                <h3>A minor gives the song its center, while Fmaj7 adds the color.</h3>
                <p className="concept-copy">
                  The progression keeps returning to A, but the shared notes between each chord make
                  the movement feel smooth. Listen for E staying present across the first two
                  chords.
                </p>
              </div>
              <PianoGuide />
              <div className="learn-listen-prompt">
                <Headphones size={18} />
                <div>
                  <strong>Listen for the anchor</strong>
                  <span>The note E works over every chord except G, where D takes over.</span>
                </div>
              </div>
            </div>
          )}

          {activeMode === 'practice' && (
            <div className="learn-practice-layout">
              <div className="learn-mode-title">
                <p>Choose your instrument</p>
                <h3>One song, a practice path that fits you.</h3>
              </div>
              <div className="learn-instrument-switch" aria-label="Choose instrument">
                {instruments.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={instrument === id ? 'is-active' : ''}
                    onClick={() => setInstrument(id)}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="learn-exercise-list">
                {practicePlans[instrument].map(([title, copy], index) => (
                  <article key={title} className={activeExercise === index ? 'is-active' : ''}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{copy}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Start ${title}`}
                      title="Start exercise"
                      onClick={() => setActiveExercise(index)}
                    >
                      <Play size={15} />
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeMode === 'challenge' && (
            <div className="learn-challenge-layout">
              <div className="learn-mode-title">
                <p>Live feedback</p>
                <h3>Can you hold the pocket at {analysis.bpm} BPM?</h3>
                <span>
                  Tap the pad at least four times. We will measure your spacing against the song.
                </span>
              </div>
              <button type="button" className="rhythm-tap-pad" onClick={handleTap}>
                <span>{rhythmScore === null ? 'TAP' : rhythmScore}</span>
                <small>{rhythmScore === null ? 'Find the pulse' : 'Timing score'}</small>
              </button>
              <div className="learn-input-stack">
                <button type="button" onClick={connectMic}>
                  <Mic2 size={19} />
                  <span>
                    <strong>Microphone</strong>
                    <small>
                      {micState === 'ready'
                        ? 'Ready for pitch practice'
                        : micState === 'denied'
                          ? 'Permission was not granted'
                          : 'Check input access'}
                    </small>
                  </span>
                  <i className={micState === 'ready' ? 'is-connected' : ''} />
                </button>
                <button type="button" onClick={connectMidi}>
                  <Cable size={19} />
                  <span>
                    <strong>MIDI controller</strong>
                    <small>
                      {midiState.note
                        ? `Playing ${midiState.note}`
                        : midiState.status === 'connected'
                          ? 'Connected. Play a note.'
                          : midiState.status === 'empty'
                            ? 'No MIDI input found'
                            : 'Connect keys or pads'}
                    </small>
                  </span>
                  <i className={midiState.status === 'connected' ? 'is-connected' : ''} />
                </button>
              </div>
            </div>
          )}

          {activeMode === 'suggest' && (
            <div className="learn-suggest-layout">
              <div className="learn-mode-title">
                <p>Next ideas</p>
                <h3>Use what you learned.</h3>
              </div>
              <div className="learn-suggestion-grid">
                <article>
                  <Gauge size={19} />
                  <span>Make it easier</span>
                  <strong>Practice at 72 BPM</strong>
                  <p>Keep the same chord timing with more room between changes.</p>
                </article>
                <article>
                  <Zap size={19} />
                  <span>Add a bassline</span>
                  <strong>A - C - F - E</strong>
                  <p>Use these approach notes to lead each chord into the next.</p>
                </article>
                <article>
                  <Music2 size={19} />
                  <span>Try a variation</span>
                  <strong>Am9 - Fmaj7 - C/E - G6</strong>
                  <p>Keep the roots and add color without losing the song.</p>
                </article>
              </div>
              <Link to="/studio" className="send-to-studio" onClick={saveForStudio}>
                <span className="send-icon">
                  <Send size={18} />
                </span>
                <span>
                  <small>Ready to create?</small>
                  <strong>Send this music map to Studio</strong>
                </span>
                <ChevronRight size={18} />
              </Link>
            </div>
          )}
        </section>
      </section>
    </>
  );
}
