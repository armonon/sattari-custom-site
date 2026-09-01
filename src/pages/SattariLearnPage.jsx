import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Layers3,
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
import LearnArranger from '../components/LearnArranger';
import { analyzeAudioFile, detectPitch } from '../utils/audioAnalysis';
import { putAudioAsset } from '../utils/audioProjectStore';
import { SEO } from '../utils/seo';

const STARTER_ANALYSIS = {
  source: 'starter',
  key: 'A minor',
  tonic: 'A',
  mode: 'minor',
  bpm: 96,
  feel: 'Mid-tempo pocket',
  chords: ['Am7', 'Fmaj7', 'C', 'G'],
  sections: [
    { name: 'Opening', range: '0:00 - 0:08', width: 25 },
    { name: 'Part A', range: '0:08 - 0:16', width: 25 },
    { name: 'Part B', range: '0:16 - 0:24', width: 25 },
    { name: 'Closing', range: '0:24 - 0:32', width: 25 },
  ],
  waveform: Array.from({ length: 96 }, (_, index) => 18 + ((index * 17 + index * index * 3) % 70)),
  confidence: { tempo: 1, key: 1, chords: 1 },
};

const instruments = [
  { id: 'piano', label: 'Piano', icon: Piano },
  { id: 'guitar', label: 'Guitar', icon: Guitar },
  { id: 'drums', label: 'Drums', icon: Drum },
  { id: 'bass', label: 'Bass', icon: Music2 },
];

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function buildPracticePlans(analysis) {
  const progression = analysis.chords.join(', ');
  const roots = analysis.chords.map((chord) => chord.match(/^[A-G]#?/)?.[0]).join(', ');
  const slowTempo = Math.max(48, Math.round(analysis.bpm * 0.75));

  return {
    piano: [
      [
        'Find the home note',
        `Play ${analysis.tonic} in two octaves and listen for the center of ${analysis.key}.`,
      ],
      ['Build the movement', `Voice ${progression} at ${slowTempo} BPM, one chord per bar.`],
      [
        'Connect the voices',
        'Keep common notes held while the other fingers move to the next chord.',
      ],
    ],
    guitar: [
      ['Map the progression', `Find playable shapes for ${progression}.`],
      [
        'Clean chord changes',
        `Loop the four changes at ${slowTempo} BPM and land each one on beat one.`,
      ],
      [
        'Shape the groove',
        `Strum eighth notes against the detected ${analysis.bpm} BPM pulse, then remove beats two and four.`,
      ],
    ],
    drums: [
      ['Lock the pulse', `Play quarter notes at ${analysis.bpm} BPM for two complete phrases.`],
      [
        'Build the backbeat',
        'Place the kick on beats one and three and the snare on beats two and four.',
      ],
      [
        'Test the pocket',
        `Alternate one bar of straight eighths with one bar of rests at ${analysis.bpm} BPM.`,
      ],
    ],
    bass: [
      ['Play the roots', `Follow ${roots} with one root per bar.`],
      [
        'Lead the changes',
        `At ${slowTempo} BPM, approach each new root from the nearest scale tone.`,
      ],
      [
        'Make it breathe',
        'Hold beats one through three and leave beat four open before each change.',
      ],
    ],
  };
}

function pitchClassInKey(pitchClass, analysis) {
  const root = noteNames.indexOf(analysis.tonic);
  if (root < 0) return false;
  const intervals = analysis.mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return intervals.some((interval) => noteNames[(root + interval) % 12] === pitchClass);
}

function midiNoteName(note) {
  const octave = Math.floor(note / 12) - 1;
  return `${noteNames[note % 12]}${octave}`;
}

function chordRoot(chord) {
  return chord.match(/^[A-G]#?/)?.[0] || chord;
}

function addChordColor(chord, index) {
  if (/m7$/.test(chord)) return chord.replace(/m7$/, 'm9');
  if (/maj7$/.test(chord) || /7$/.test(chord)) return chord;
  if (/m$/.test(chord)) return `${chord}7`;
  return `${chord}${index === 3 ? '6' : 'add9'}`;
}

function LearnWaveform({ active = false, peaks = STARTER_ANALYSIS.waveform }) {
  return (
    <div className={`learn-waveform${active ? ' is-active' : ''}`} aria-hidden="true">
      {peaks.map((height, index) => (
        <span key={index} style={{ '--wave-height': `${height}%` }} />
      ))}
      <i />
    </div>
  );
}

function PianoGuide({ analysis }) {
  const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', 'B'];

  return (
    <div className="learn-piano" aria-label={`Piano guide highlighting notes in ${analysis.key}`}>
      {notes.map((note, index) => (
        <span
          key={`${note}-${index}`}
          className={pitchClassInKey(note, analysis) ? 'is-chord-tone' : ''}
          data-note={note}
        />
      ))}
    </div>
  );
}

function ChordStrip({ chords }) {
  const [activeChord, setActiveChord] = useState(0);

  return (
    <div className="learn-chord-strip" aria-label="Chord progression">
      {chords.map((chord, index) => (
        <button
          type="button"
          key={`${chord}-${index}`}
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
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const micRuntimeRef = useRef(null);
  const analysisRef = useRef(STARTER_ANALYSIS);
  const [audioUrl, setAudioUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioAssetId, setAudioAssetId] = useState('');
  const [trackName, setTrackName] = useState('Choose a song');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState({ value: 0, label: '' });
  const [analysisError, setAnalysisError] = useState('');
  const [activeMode, setActiveMode] = useState('arrange');
  const [instrument, setInstrument] = useState('piano');
  const [dropActive, setDropActive] = useState(false);
  const [selectedSection, setSelectedSection] = useState(1);
  const [sourceLoop, setSourceLoop] = useState(false);
  const [activeExercise, setActiveExercise] = useState(null);
  const [tapTimes, setTapTimes] = useState([]);
  const [midiState, setMidiState] = useState({ status: 'idle', note: '', inKey: false });
  const [micState, setMicState] = useState({ status: 'idle', pitch: null });
  const [arrangement, setArrangement] = useState(null);
  const [handoffState, setHandoffState] = useState('idle');
  const currentAnalysis = analysisResult || STARTER_ANALYSIS;
  const analysisReady = Boolean(analysisResult);
  const practicePlans = useMemo(() => buildPracticePlans(currentAnalysis), [currentAnalysis]);
  const suggestions = useMemo(
    () => ({
      practiceTempo: Math.max(48, Math.round(currentAnalysis.bpm * 0.75)),
      bassline: currentAnalysis.chords.map(chordRoot).join(' - '),
      variation: currentAnalysis.chords.map(addChordColor).join(' - '),
    }),
    [currentAnalysis]
  );

  useEffect(() => {
    analysisRef.current = currentAnalysis;
  }, [currentAnalysis]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = sourceLoop;
  }, [audioUrl, sourceLoop]);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl]
  );

  useEffect(
    () => () => {
      const runtime = micRuntimeRef.current;
      if (!runtime) return;
      window.cancelAnimationFrame(runtime.frame);
      runtime.stream.getTracks().forEach((track) => track.stop());
      void runtime.context.close();
      micRuntimeRef.current = null;
    },
    []
  );

  const loadFile = (file) => {
    if (!file || !file.type.startsWith('audio/')) return;

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const nextUrl = URL.createObjectURL(file);
    setAudioUrl(nextUrl);
    setSelectedFile(file);
    setAudioAssetId('');
    setTrackName(file.name.replace(/\.[^/.]+$/, ''));
    setAnalysisResult(null);
    setAnalysisProgress({ value: 0, label: '' });
    setAnalysisError('');
    setIsPlaying(false);
    setTapTimes([]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDropActive(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const handleTeach = async () => {
    if (!selectedFile) {
      setAnalysisError('Choose an audio file before starting analysis.');
      fileInputRef.current?.click();
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError('');
    try {
      const result = await analyzeAudioFile(selectedFile, setAnalysisProgress);
      setAnalysisResult(result);
      setSelectedSection(0);
      setTapTimes([]);
      setActiveMode('analyze');
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'This file could not be analyzed.');
    } finally {
      setIsAnalyzing(false);
    }
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
    const targetInterval = 60000 / currentAnalysis.bpm;
    const intervals = tapTimes.slice(1).map((time, index) => time - tapTimes[index]);
    const averageError =
      intervals.reduce((sum, interval) => sum + Math.abs(interval - targetInterval), 0) /
      intervals.length;
    return Math.max(0, Math.round(100 - (averageError / targetInterval) * 100));
  }, [currentAnalysis.bpm, tapTimes]);

  const connectMidi = async () => {
    if (!navigator.requestMIDIAccess) {
      setMidiState({ status: 'unsupported', note: '', inKey: false });
      return;
    }

    try {
      const access = await navigator.requestMIDIAccess();
      const inputs = Array.from(access.inputs.values());
      inputs.forEach((input) => {
        input.onmidimessage = (event) => {
          const [command, note, velocity] = event.data;
          if ((command & 0xf0) === 0x90 && velocity > 0) {
            const pitchClass = noteNames[note % 12];
            setMidiState({
              status: 'connected',
              note: midiNoteName(note),
              inKey: pitchClassInKey(pitchClass, analysisRef.current),
            });
          }
        };
      });
      setMidiState({ status: inputs.length ? 'connected' : 'empty', note: '', inKey: false });
    } catch {
      setMidiState({ status: 'denied', note: '', inKey: false });
    }
  };

  const stopMic = () => {
    const runtime = micRuntimeRef.current;
    if (runtime) {
      window.cancelAnimationFrame(runtime.frame);
      runtime.stream.getTracks().forEach((track) => track.stop());
      void runtime.context.close();
      micRuntimeRef.current = null;
    }
    setMicState({ status: 'idle', pitch: null });
  };

  const connectMic = async () => {
    if (micRuntimeRef.current) {
      stopMic();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicState({ status: 'unsupported', pitch: null });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.1;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const runtime = { stream, context, analyser, samples, frame: 0, lastUpdate: 0 };
      micRuntimeRef.current = runtime;
      setMicState({ status: 'listening', pitch: null });

      const readPitch = () => {
        if (micRuntimeRef.current !== runtime) return;
        const now = performance.now();
        if (now - runtime.lastUpdate > 110) {
          analyser.getFloatTimeDomainData(samples);
          const pitch = detectPitch(samples, context.sampleRate);
          setMicState({
            status: 'listening',
            pitch: pitch
              ? { ...pitch, inKey: pitchClassInKey(pitch.pitchClass, analysisRef.current) }
              : null,
          });
          runtime.lastUpdate = now;
        }
        runtime.frame = window.requestAnimationFrame(readPitch);
      };
      readPitch();
    } catch {
      setMicState({ status: 'denied', pitch: null });
    }
  };

  const saveForStudio = async () => {
    setHandoffState('saving');
    try {
      let nextAssetId = audioAssetId;
      if (selectedFile && !nextAssetId) {
        const asset = await putAudioAsset(selectedFile, {
          name: selectedFile.name,
          analysis: analysisResult,
        });
        nextAssetId = asset.id;
        setAudioAssetId(asset.id);
      }

      window.localStorage.setItem(
        'sattari-studio-transfer-v1',
        JSON.stringify({
          schema: 'SattariLearn.studioTransfer.v2',
          trackName,
          key: currentAnalysis.key,
          bpm: arrangement?.bpm || currentAnalysis.bpm,
          chords: arrangement?.progression || currentAnalysis.chords,
          analysis: currentAnalysis,
          arrangement,
          audioAssetId: nextAssetId || null,
        })
      );
      navigate('/studio');
    } catch (error) {
      setHandoffState('error');
      setAnalysisError(
        error instanceof Error ? error.message : 'Could not prepare the Studio session.'
      );
    }
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
            <i /> Local audio engine
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
            challenge. Analysis and practice audio stay on this device.
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
                <span>
                  {analysisReady
                    ? `${currentAnalysis.durationLabel} / analyzed locally`
                    : audioUrl
                      ? 'Ready for local analysis'
                      : 'Starter progression loaded'}
                </span>
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
              {isAnalyzing ? analysisProgress.label || 'Analyzing...' : 'Analyze & teach'}
              {!isAnalyzing && <ChevronRight size={17} />}
            </button>

            {isAnalyzing && (
              <div className="learn-analysis-progress" aria-live="polite">
                <span style={{ width: `${analysisProgress.value}%` }} />
              </div>
            )}

            {analysisError && <p className="learn-analysis-error">{analysisError}</p>}

            <div className="learn-private-note">
              <Headphones size={15} />
              <span>Private by default. Audio is stored locally only when sent to Studio.</span>
            </div>
          </aside>

          <div className="learn-analysis-panel workspace-panel">
            <div className="workspace-panel-heading analysis-heading">
              <span>02</span>
              <div>
                <p>Music map</p>
                <strong>
                  {analysisReady
                    ? 'Analyzed on this device'
                    : selectedFile
                      ? 'Ready to analyze'
                      : 'Starter map'}
                </strong>
              </div>
              <div className={`analysis-state${analysisReady ? ' is-ready' : ''}`}>
                {analysisReady ? <Check size={14} /> : <AudioWaveform size={14} />}
                {analysisReady ? 'Local analysis' : selectedFile ? 'Not analyzed' : 'Starter'}
              </div>
            </div>

            <LearnWaveform active={isPlaying || isAnalyzing} peaks={currentAnalysis.waveform} />

            <div className="learn-stat-grid">
              <div>
                <span>Key</span>
                <strong>{currentAnalysis.key}</strong>
                <small>
                  {analysisReady
                    ? `${Math.round(currentAnalysis.confidence.key * 100)}% tonal confidence`
                    : 'Starter key'}
                </small>
              </div>
              <div>
                <span>Tempo</span>
                <strong>
                  {currentAnalysis.bpm} <small>BPM</small>
                </strong>
                <small>
                  {analysisReady
                    ? `${Math.round(currentAnalysis.confidence.tempo * 100)}% pulse confidence`
                    : 'Starter tempo'}
                </small>
              </div>
              <div>
                <span>Feel</span>
                <strong>{currentAnalysis.feel}</strong>
                <small>
                  {analysisReady ? `${currentAnalysis.level.rmsDb} dB RMS` : 'Four-bar study'}
                </small>
              </div>
            </div>

            <div className="learn-section-map" aria-label="Song sections">
              {currentAnalysis.sections.map((section, index) => (
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
                <span>{analysisReady ? 'Representative progression' : 'Starter progression'}</span>
                <small>
                  {analysisReady ? 'Estimated across four regions' : 'Four bars, repeating'}
                </small>
              </div>
              <button
                type="button"
                className={sourceLoop ? 'is-active' : ''}
                title="Loop source track"
                aria-label="Loop source track"
                aria-pressed={sourceLoop}
                onClick={() => setSourceLoop((value) => !value)}
                disabled={!audioUrl}
              >
                <RefreshCw size={15} />
              </button>
            </div>
            <ChordStrip chords={currentAnalysis.chords} />
          </div>
        </div>

        <div className="learn-mode-bar" role="tablist" aria-label="Learn modes">
          {[
            ['analyze', AudioWaveform, 'Analyze'],
            ['practice', Music2, 'Practice'],
            ['arrange', Layers3, 'Arrange'],
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
                <p>{analysisReady ? 'What the local analysis heard' : 'Starter concept'}</p>
                <h3>
                  {currentAnalysis.key} is the tonal center around a {currentAnalysis.bpm} BPM
                  pulse.
                </h3>
                <p className="concept-copy">
                  The representative movement is {currentAnalysis.chords.join(' - ')}. Treat these
                  as a practical starting map: listen against the original and correct any passing
                  or extended chords you hear.
                </p>
              </div>
              <PianoGuide analysis={currentAnalysis} />
              <div className="learn-listen-prompt">
                <Headphones size={18} />
                <div>
                  <strong>Find the tonal center</strong>
                  <span>
                    Play {currentAnalysis.tonic}, pause, and compare its sense of rest against the
                    track.
                  </span>
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

          {activeMode === 'arrange' && (
            <LearnArranger
              bpm={currentAnalysis.bpm}
              initialChords={currentAnalysis.chords}
              onArrangementChange={setArrangement}
            />
          )}

          {activeMode === 'challenge' && (
            <div className="learn-challenge-layout">
              <div className="learn-mode-title">
                <p>Live feedback</p>
                <h3>Can you hold the pocket at {currentAnalysis.bpm} BPM?</h3>
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
                      {micState.pitch
                        ? `${micState.pitch.note} / ${micState.pitch.cents >= 0 ? '+' : ''}${micState.pitch.cents} cents / ${micState.pitch.inKey ? 'in key' : 'outside key'}`
                        : micState.status === 'listening'
                          ? 'Listening for a steady note'
                          : micState.status === 'denied'
                            ? 'Permission was not granted'
                            : 'Start live pitch detection'}
                    </small>
                  </span>
                  <i className={micState.status === 'listening' ? 'is-connected' : ''} />
                </button>
                <button type="button" onClick={connectMidi}>
                  <Cable size={19} />
                  <span>
                    <strong>MIDI controller</strong>
                    <small>
                      {midiState.note
                        ? `Playing ${midiState.note} / ${midiState.inKey ? 'in key' : 'outside key'}`
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
                  <strong>Practice at {suggestions.practiceTempo} BPM</strong>
                  <p>
                    Keep the {currentAnalysis.bpm} BPM chord timing with more room between changes.
                  </p>
                </article>
                <article>
                  <Zap size={19} />
                  <span>Add a bassline</span>
                  <strong>{suggestions.bassline}</strong>
                  <p>Start with each detected chord root, then connect the changes by ear.</p>
                </article>
                <article>
                  <Music2 size={19} />
                  <span>Try a variation</span>
                  <strong>{suggestions.variation}</strong>
                  <p>Add color to the estimated progression while keeping its roots intact.</p>
                </article>
              </div>
              <button
                type="button"
                className="send-to-studio"
                onClick={saveForStudio}
                disabled={handoffState === 'saving'}
              >
                <span className="send-icon">
                  <Send size={18} />
                </span>
                <span>
                  <small>Ready to create?</small>
                  <strong>
                    {handoffState === 'saving'
                      ? 'Preparing local session...'
                      : 'Send this music map to Studio'}
                  </strong>
                </span>
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </section>
      </section>
    </>
  );
}
