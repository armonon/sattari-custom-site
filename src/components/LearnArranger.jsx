import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Drum,
  Guitar,
  Layers3,
  Minus,
  Pause,
  Piano,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';

// Tone.js (~70 KB gzipped, with the audio code it shares a chunk with) is only
// needed once something plays, so it is fetched when the page is idle or first
// touched, instead of with the Learn page.
const loadTone = () => import('tone');

// iOS starts audio only for an AudioContext resumed inside the tap that asks for
// it, and a tap on play can come before Tone.js has downloaded: awaiting the
// import first left the context locked and the first play silent. So the tap
// itself creates and resumes a plain AudioContext, synchronously, and the
// arranger's Tone objects are built on it once Tone has loaded.
function unlockAudioContext(ref) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  ref.current ??= new AudioContextClass();
  if (ref.current.state !== 'running') ref.current.resume().catch(() => {});
  return ref.current;
}

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteFromMidi(midi) {
  return `${CHROMATIC_NOTES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

function createChord(name, root, intervals) {
  const rootIndex = CHROMATIC_NOTES.indexOf(root);
  const chordRoot = 48 + rootIndex;
  const bassRoot = 24 + rootIndex;
  return {
    name,
    notes: intervals.map((interval) => noteFromMidi(chordRoot + interval)),
    root: noteFromMidi(bassRoot),
    tones: intervals.slice(0, 4).map((interval) => noteFromMidi(bassRoot + interval)),
  };
}

const FEATURED_CHORDS = [
  createChord('Am7', 'A', [0, 3, 7, 10]),
  createChord('Fmaj7', 'F', [0, 4, 7, 11]),
  createChord('Dm7', 'D', [0, 3, 7, 10]),
  createChord('Em7', 'E', [0, 3, 7, 10]),
  createChord('E7', 'E', [0, 4, 7, 10]),
];

const CHORD_LIBRARY = [
  ...FEATURED_CHORDS,
  ...CHROMATIC_NOTES.flatMap((root) => [
    createChord(root, root, [0, 4, 7]),
    createChord(`${root}m`, root, [0, 3, 7]),
  ]),
];

const DEFAULT_PROGRESSION = ['Am7', 'Fmaj7', 'C', 'G'];

const BASS_KEYS = ['A1', 'C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'C3'];

const DRUM_ROWS = [
  { id: 'kick', label: 'Kick', color: 'gold' },
  { id: 'snare', label: 'Snare', color: 'coral' },
  { id: 'hat', label: 'Hat', color: 'cyan' },
];

const DEFAULT_DRUM_PATTERN = {
  kick: [
    true,
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    true,
    false,
    false,
    false,
    false,
    false,
    true,
    false,
  ],
  snare: [
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
  ],
  hat: [
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
    true,
    false,
  ],
};

const LIVE_DRUMS = [
  { id: 'kick', label: 'Kick', detail: 'Low punch' },
  { id: 'snare', label: 'Snare', detail: 'Backbeat' },
  { id: 'hat', label: 'Hat', detail: 'Tight pulse' },
  { id: 'clap', label: 'Clap', detail: 'Wide accent' },
];

function chordFor(name) {
  return CHORD_LIBRARY.find((chord) => chord.name === name) || CHORD_LIBRARY[0];
}

function noteAtOctave(note, octaveShift) {
  const match = note.match(/^([A-G]#?)(-?\d)$/);
  if (!match) return note;
  return `${match[1]}${Number(match[2]) + octaveShift}`;
}

function bassNoteFor(chordName, nextChordName, beat, pattern) {
  const chord = chordFor(chordName);
  const nextChord = chordFor(nextChordName);

  if (pattern === 'octaves') {
    return beat % 2 === 0 ? chord.root : noteAtOctave(chord.root, 1);
  }

  if (pattern === 'walk') {
    return beat === 3 ? nextChord.root : chord.tones[Math.min(beat, chord.tones.length - 1)];
  }

  return chord.root;
}

function gainFromLevel(level, muted) {
  if (muted) return 0;
  return Math.pow(level / 100, 1.35);
}

// Everything the arranger plays runs on its own Tone context, wrapping the
// AudioContext the first tap unlocked. Tone's global context is left alone: it
// is the one the Studio runs on, and this one is closed when the arranger goes.
function createAudioEngine(Tone, rawContext) {
  const context = rawContext ? new Tone.Context(rawContext) : Tone.getContext();
  const master = new Tone.Gain({ context, gain: 0.72 }).toDestination();
  const chordGain = new Tone.Gain({ context, gain: 0.68 }).connect(master);
  const bassGain = new Tone.Gain({ context, gain: 0.72 }).connect(master);
  const drumGain = new Tone.Gain({ context, gain: 0.76 }).connect(master);

  const chords = new Tone.PolySynth({
    context,
    voice: Tone.Synth,
    options: {
      oscillator: { type: 'triangle8' },
      envelope: { attack: 0.018, decay: 0.24, sustain: 0.32, release: 0.9 },
    },
  }).connect(chordGain);
  chords.volume.value = -8;

  const bass = new Tone.MonoSynth({
    context,
    oscillator: { type: 'square4' },
    filter: { type: 'lowpass', frequency: 520, rolloff: -24, Q: 1.4 },
    envelope: { attack: 0.012, decay: 0.18, sustain: 0.4, release: 0.22 },
    filterEnvelope: {
      attack: 0.01,
      decay: 0.12,
      sustain: 0.2,
      release: 0.2,
      baseFrequency: 75,
      octaves: 2.5,
    },
  }).connect(bassGain);
  bass.volume.value = -7;

  const kick = new Tone.MembraneSynth({
    context,
    pitchDecay: 0.035,
    octaves: 5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.08 },
  }).connect(drumGain);
  kick.volume.value = -3;

  const snare = new Tone.NoiseSynth({
    context,
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.07 },
  }).connect(drumGain);
  snare.volume.value = -8;

  const hat = new Tone.MetalSynth({
    context,
    frequency: 260,
    envelope: { attack: 0.001, decay: 0.045, release: 0.015 },
    harmonicity: 4.8,
    modulationIndex: 28,
    resonance: 4300,
    octaves: 1.4,
  }).connect(drumGain);
  hat.volume.value = -16;

  const clap = new Tone.NoiseSynth({
    context,
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
  }).connect(drumGain);
  clap.volume.value = -11;

  return {
    context,
    transport: context.transport,
    draw: context.draw,
    master,
    gains: { chords: chordGain, bass: bassGain, drums: drumGain },
    chords,
    bass,
    kick,
    snare,
    hat,
    clap,
    dispose() {
      chords.dispose();
      bass.dispose();
      kick.dispose();
      snare.dispose();
      hat.dispose();
      clap.dispose();
      chordGain.dispose();
      bassGain.dispose();
      drumGain.dispose();
      master.dispose();
      // Only a context this engine made; never Tone's global one.
      if (rawContext) context.dispose();
    },
  };
}

export default function LearnArranger({
  bpm = 96,
  initialChords = DEFAULT_PROGRESSION,
  initialInstrument = 'chords',
  onArrangementChange,
}) {
  const [tempo, setTempo] = useState(bpm);
  const [progression, setProgression] = useState(initialChords);
  const [bassPattern, setBassPattern] = useState('roots');
  const [drumPattern, setDrumPattern] = useState(DEFAULT_DRUM_PATTERN);
  const [mutes, setMutes] = useState({ chords: false, bass: false, drums: false });
  const [levels, setLevels] = useState({ chords: 78, bass: 76, drums: 82 });
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [activeBar, setActiveBar] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const [activeInstrument, setActiveInstrument] = useState(initialInstrument);
  const [hitPad, setHitPad] = useState('');
  const [audioError, setAudioError] = useState('');

  const lifetimeRef = useRef(0);
  const toneRef = useRef(null);
  const audioContextRef = useRef(null);
  const engineRef = useRef(null);
  const scheduleRef = useRef({ sequences: [], endEventId: null });
  const arrangementRef = useRef({
    progression,
    bassPattern,
    drumPattern,
    mutes,
    levels,
    loopEnabled,
  });
  const hitTimerRef = useRef(null);

  useEffect(() => {
    arrangementRef.current = { progression, bassPattern, drumPattern, mutes, levels, loopEnabled };

    if (engineRef.current) {
      Object.entries(engineRef.current.gains).forEach(([track, gain]) => {
        gain.gain.rampTo(gainFromLevel(levels[track], mutes[track]), 0.04);
      });
    }

    onArrangementChange?.({
      schema: 'SattariLearn.practiceArrangement.v1',
      bars: 4,
      bpm: tempo,
      progression,
      bassPattern,
      drumPattern,
      mutes,
      levels,
      loop: loopEnabled,
    });
  }, [
    bassPattern,
    drumPattern,
    levels,
    loopEnabled,
    mutes,
    onArrangementChange,
    progression,
    tempo,
  ]);

  // Fetch Tone once the page is idle (or on the first touch, see the root's
  // onPointerDown), off the critical path, so it is usually in by the first play.
  useEffect(() => {
    let cancelled = false;
    const warm = () =>
      loadTone().then(
        (Tone) => {
          if (!cancelled) toneRef.current ??= Tone;
        },
        () => {}
      );
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(warm, { timeout: 5000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(warm, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.transport.bpm.rampTo(tempo, 0.05);
  }, [tempo]);

  useEffect(
    () => () => {
      lifetimeRef.current += 1;
      // Nothing to stop if nothing ever played.
      const engine = engineRef.current;
      if (engine) {
        engine.transport.stop();
        engine.transport.cancel(0);
      }
      scheduleRef.current.sequences.forEach((sequence) => sequence.dispose());
      engine?.dispose();
      engineRef.current = null;
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
      if (hitTimerRef.current) window.clearTimeout(hitTimerRef.current);
    },
    []
  );

  // Call straight from the tap handler: the unlock must happen before any await.
  const ensureEngine = async () => {
    const lifetime = lifetimeRef.current;
    setAudioError('');
    try {
      const rawContext = unlockAudioContext(audioContextRef);
      if (!rawContext) throw new Error('Audio unavailable');
      toneRef.current ??= await loadTone();
      if (lifetimeRef.current !== lifetime) return null;
      if (!engineRef.current) {
        engineRef.current = createAudioEngine(toneRef.current, rawContext);
        const current = arrangementRef.current;
        Object.entries(engineRef.current.gains).forEach(([track, gain]) => {
          gain.gain.value = gainFromLevel(current.levels[track], current.mutes[track]);
        });
      }
      const engine = engineRef.current;
      await engine.context.resume();
      if (lifetimeRef.current !== lifetime) return null;
      setAudioReady(true);
      return engine;
    } catch {
      if (lifetimeRef.current === lifetime) {
        setAudioError('Audio could not start. Check your output and try again.');
        setIsPlaying(false);
      }
      return null;
    }
  };

  const clearSchedule = (transport) => {
    scheduleRef.current.sequences.forEach((sequence) => sequence.dispose());
    if (scheduleRef.current.endEventId !== null) {
      transport.clear(scheduleRef.current.endEventId);
    }
    scheduleRef.current = { sequences: [], endEventId: null };
  };

  const stopTransport = () => {
    const transport = engineRef.current?.transport;
    if (transport) {
      transport.stop();
      transport.position = '0:0:0';
      clearSchedule(transport);
    }
    setIsPlaying(false);
    setActiveBar(0);
    setActiveStep(-1);
  };

  // Only called after ensureEngine, so Tone is loaded.
  const scheduleArrangement = (engine) => {
    const Tone = toneRef.current;
    const { context, transport, draw } = engine;
    transport.cancel(0);
    transport.bpm.value = tempo;
    transport.loop = loopEnabled;
    transport.loopStart = '0:0:0';
    transport.loopEnd = '4m';

    const chordSequence = new Tone.Sequence({
      context,
      callback: (time, bar) => {
        const current = arrangementRef.current;
        const chord = chordFor(current.progression[bar]);
        engine.chords.triggerAttackRelease(chord.notes, '1m', time, 0.62);
        draw.schedule(() => setActiveBar(bar), time);
      },
      events: [0, 1, 2, 3],
      subdivision: '1m',
    }).start(0);

    const bassEvents = Array.from({ length: 16 }, (_, index) => ({
      bar: Math.floor(index / 4),
      beat: index % 4,
    }));
    const bassSequence = new Tone.Sequence({
      context,
      callback: (time, event) => {
        const current = arrangementRef.current;
        const nextBar = (event.bar + 1) % current.progression.length;
        const note = bassNoteFor(
          current.progression[event.bar],
          current.progression[nextBar],
          event.beat,
          current.bassPattern
        );
        engine.bass.triggerAttackRelease(note, '8n', time, 0.72);
      },
      events: bassEvents,
      subdivision: '4n',
    }).start(0);

    const drumEvents = Array.from({ length: 64 }, (_, index) => index % 16);
    const drumSequence = new Tone.Sequence({
      context,
      callback: (time, step) => {
        const pattern = arrangementRef.current.drumPattern;
        if (pattern.kick[step]) engine.kick.triggerAttackRelease('C1', '8n', time, 0.9);
        if (pattern.snare[step]) engine.snare.triggerAttackRelease('16n', time, 0.62);
        if (pattern.hat[step]) engine.hat.triggerAttackRelease('32n', time, 0.34);
        draw.schedule(() => setActiveStep(step), time);
      },
      events: drumEvents,
      subdivision: '16n',
    }).start(0);

    chordSequence.loop = loopEnabled;
    bassSequence.loop = loopEnabled;
    drumSequence.loop = loopEnabled;

    let endEventId = null;
    if (!loopEnabled) {
      endEventId = transport.scheduleOnce((time) => {
        transport.stop(time);
        draw.schedule(() => {
          setIsPlaying(false);
          setActiveBar(0);
          setActiveStep(-1);
        }, time);
      }, '4m');
    }

    scheduleRef.current = {
      sequences: [chordSequence, bassSequence, drumSequence],
      endEventId,
    };
  };

  const toggleTransport = async () => {
    const engine = await ensureEngine();
    if (!engine) return;
    const { transport } = engine;

    if (transport.state === 'started') {
      transport.pause();
      setIsPlaying(false);
      return;
    }

    if (transport.state === 'paused' && scheduleRef.current.sequences.length) {
      transport.start();
      setIsPlaying(true);
      return;
    }

    stopTransport();
    scheduleArrangement(engine);
    transport.start('+0.05');
    setIsPlaying(true);
  };

  const triggerPad = (id) => {
    setHitPad(id);
    if (hitTimerRef.current) window.clearTimeout(hitTimerRef.current);
    hitTimerRef.current = window.setTimeout(() => setHitPad(''), 140);
  };

  const playChord = async (chordName) => {
    const engine = await ensureEngine();
    if (!engine) return;
    engine.chords.triggerAttackRelease(chordFor(chordName).notes, '2n', undefined, 0.72);
    triggerPad(`chord-${chordName}`);
  };

  const playBass = async (note) => {
    const engine = await ensureEngine();
    if (!engine) return;
    engine.bass.triggerAttackRelease(note, '8n', undefined, 0.82);
    triggerPad(`bass-${note}`);
  };

  const playDrum = async (drum) => {
    const engine = await ensureEngine();
    if (!engine) return;
    if (drum === 'kick') engine.kick.triggerAttackRelease('C1', '8n', undefined, 0.95);
    if (drum === 'snare') engine.snare.triggerAttackRelease('16n', undefined, 0.72);
    if (drum === 'hat') engine.hat.triggerAttackRelease('32n', undefined, 0.48);
    if (drum === 'clap') engine.clap.triggerAttackRelease('16n', undefined, 0.7);
    triggerPad(`drum-${drum}`);
  };

  const setProgressionChord = (index, chordName) => {
    setProgression((current) =>
      current.map((chord, chordIndex) => (chordIndex === index ? chordName : chord))
    );
  };

  const toggleDrumStep = (row, step) => {
    setDrumPattern((current) => ({
      ...current,
      [row]: current[row].map((enabled, index) => (index === step ? !enabled : enabled)),
    }));
  };

  const toggleMute = (track) => {
    setMutes((current) => ({ ...current, [track]: !current[track] }));
  };

  const setLoop = () => {
    stopTransport();
    setLoopEnabled((enabled) => !enabled);
  };

  return (
    <div className="learn-arranger" onPointerDown={() => loadTone().catch(() => {})}>
      {audioError && <p role="alert">{audioError}</p>}
      <header className="learn-arranger-toolbar">
        <div className="learn-arranger-title">
          <span>
            <Layers3 size={17} /> Practice DAW
          </span>
          <strong>Four-bar song lab</strong>
        </div>

        <div className="learn-arranger-transport" aria-label="Arrangement transport">
          <button
            type="button"
            onClick={stopTransport}
            title="Return to start"
            aria-label="Return to start"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={toggleTransport}
            title={isPlaying ? 'Pause arrangement' : 'Play arrangement'}
            aria-label={isPlaying ? 'Pause arrangement' : 'Play arrangement'}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button type="button" onClick={stopTransport} title="Stop" aria-label="Stop arrangement">
            <Square size={13} fill="currentColor" />
          </button>
          <button
            type="button"
            className={loopEnabled ? 'is-active' : ''}
            onClick={setLoop}
            title="Loop four bars"
            aria-label="Loop four bars"
            aria-pressed={loopEnabled}
          >
            <Repeat2 size={16} />
          </button>
        </div>

        <div className="learn-tempo-control">
          <span>BPM</span>
          <button
            type="button"
            onClick={() => setTempo((value) => Math.max(50, value - 1))}
            aria-label="Lower tempo"
          >
            <Minus size={13} />
          </button>
          <strong>{tempo}</strong>
          <button
            type="button"
            onClick={() => setTempo((value) => Math.min(180, value + 1))}
            aria-label="Raise tempo"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="learn-arranger-readout">
          <span className={audioReady ? 'is-ready' : ''} />
          <div>
            <small>{isPlaying ? 'Playing' : audioReady ? 'Audio ready' : 'Instrument idle'}</small>
            <strong>Bar {activeBar + 1} / 4</strong>
          </div>
        </div>
      </header>

      <div className="learn-arranger-scroll">
        <div className="learn-arranger-ruler" aria-hidden="true">
          <span />
          {[0, 1, 2, 3].map((bar) => (
            <strong key={bar} className={isPlaying && activeBar === bar ? 'is-active' : ''}>
              {bar + 1}
            </strong>
          ))}
        </div>

        <div className="learn-arranger-tracks">
          <section className="learn-arranger-track track-chords">
            <div className="learn-track-header">
              <span className="learn-track-type">
                <Piano size={16} />
              </span>
              <div>
                <strong>Chords</strong>
                <small>Warm keys</small>
              </div>
              <button
                type="button"
                className={mutes.chords ? 'is-muted' : ''}
                onClick={() => toggleMute('chords')}
                title="Mute chords"
                aria-label="Mute chords"
                aria-pressed={mutes.chords}
              >
                {mutes.chords ? <VolumeX size={13} /> : 'M'}
              </button>
              <label>
                <Volume2 size={13} />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={levels.chords}
                  onChange={(event) =>
                    setLevels((current) => ({ ...current, chords: Number(event.target.value) }))
                  }
                  aria-label="Chord level"
                />
              </label>
            </div>
            <div className="learn-chord-clips">
              {progression.map((chord, index) => (
                <label
                  key={`${index}-${chord}`}
                  className={isPlaying && activeBar === index ? 'is-active' : ''}
                >
                  <span>Bar {index + 1}</span>
                  <select
                    value={chord}
                    onChange={(event) => setProgressionChord(index, event.target.value)}
                    aria-label={`Chord for bar ${index + 1}`}
                  >
                    {CHORD_LIBRARY.map((option) => (
                      <option key={option.name} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <section className="learn-arranger-track track-bass">
            <div className="learn-track-header">
              <span className="learn-track-type">
                <Guitar size={16} />
              </span>
              <div>
                <strong>Bass</strong>
                <small>Generated line</small>
              </div>
              <button
                type="button"
                className={mutes.bass ? 'is-muted' : ''}
                onClick={() => toggleMute('bass')}
                title="Mute bass"
                aria-label="Mute bass"
                aria-pressed={mutes.bass}
              >
                {mutes.bass ? <VolumeX size={13} /> : 'M'}
              </button>
              <label>
                <Volume2 size={13} />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={levels.bass}
                  onChange={(event) =>
                    setLevels((current) => ({ ...current, bass: Number(event.target.value) }))
                  }
                  aria-label="Bass level"
                />
              </label>
            </div>
            <div className="learn-bass-lane">
              <div className="learn-bass-clips">
                {progression.map((chord, index) => (
                  <button
                    type="button"
                    key={`${chord}-${index}`}
                    className={isPlaying && activeBar === index ? 'is-active' : ''}
                    onClick={() => playBass(chordFor(chord).root)}
                  >
                    <span>{chordFor(chord).root}</span>
                    <small>{bassPattern}</small>
                  </button>
                ))}
              </div>
              <label className="learn-bass-pattern">
                <SlidersHorizontal size={14} />
                <span>Line</span>
                <select
                  value={bassPattern}
                  onChange={(event) => setBassPattern(event.target.value)}
                >
                  <option value="roots">Roots</option>
                  <option value="octaves">Octaves</option>
                  <option value="walk">Walk up</option>
                </select>
              </label>
            </div>
          </section>

          <section className="learn-arranger-track track-drums">
            <div className="learn-track-header">
              <span className="learn-track-type">
                <Drum size={16} />
              </span>
              <div>
                <strong>Drums</strong>
                <small>One-bar pattern</small>
              </div>
              <button
                type="button"
                className={mutes.drums ? 'is-muted' : ''}
                onClick={() => toggleMute('drums')}
                title="Mute drums"
                aria-label="Mute drums"
                aria-pressed={mutes.drums}
              >
                {mutes.drums ? <VolumeX size={13} /> : 'M'}
              </button>
              <label>
                <Volume2 size={13} />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={levels.drums}
                  onChange={(event) =>
                    setLevels((current) => ({ ...current, drums: Number(event.target.value) }))
                  }
                  aria-label="Drum level"
                />
              </label>
            </div>
            <div className="learn-step-sequencer">
              {DRUM_ROWS.map((row) => (
                <div className={`learn-step-row step-${row.color}`} key={row.id}>
                  <span>{row.label}</span>
                  <div>
                    {drumPattern[row.id].map((enabled, step) => (
                      <button
                        type="button"
                        key={step}
                        className={`${enabled ? 'is-on' : ''}${isPlaying && activeStep === step ? ' is-current' : ''}`}
                        onClick={() => toggleDrumStep(row.id, step)}
                        aria-label={`${enabled ? 'Disable' : 'Enable'} ${row.label} step ${step + 1}`}
                        aria-pressed={enabled}
                      >
                        <span>{step % 4 === 0 ? step / 4 + 1 : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="learn-instrument-rack">
        <div className="learn-rack-header">
          <div>
            <span>
              <AudioLines size={15} /> Software instruments
            </span>
            <strong>Play the arrangement</strong>
          </div>
          <div className="learn-rack-tabs" role="tablist" aria-label="Software instruments">
            {[
              ['chords', Piano, 'Chords'],
              ['bass', Guitar, 'Bass'],
              ['drums', Drum, 'Drums'],
            ].map(([id, Icon, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeInstrument === id}
                className={activeInstrument === id ? 'is-active' : ''}
                key={id}
                onClick={() => setActiveInstrument(id)}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className={`learn-live-instrument instrument-${activeInstrument}`}>
          {activeInstrument === 'chords' &&
            progression.map((chord, index) => (
              <button
                type="button"
                key={`${chord}-${index}`}
                className={hitPad === `chord-${chord}` ? 'is-hit' : ''}
                onClick={() => playChord(chord)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{chord}</strong>
                <small>{chordFor(chord).notes.join(' · ')}</small>
              </button>
            ))}

          {activeInstrument === 'bass' &&
            BASS_KEYS.map((note, index) => (
              <button
                type="button"
                key={note}
                className={hitPad === `bass-${note}` ? 'is-hit' : ''}
                onClick={() => playBass(note)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{note}</strong>
              </button>
            ))}

          {activeInstrument === 'drums' &&
            LIVE_DRUMS.map((drum, index) => (
              <button
                type="button"
                key={drum.id}
                className={hitPad === `drum-${drum.id}` ? 'is-hit' : ''}
                onClick={() => playDrum(drum.id)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{drum.label}</strong>
                <small>{drum.detail}</small>
              </button>
            ))}
        </div>
      </section>
    </div>
  );
}
