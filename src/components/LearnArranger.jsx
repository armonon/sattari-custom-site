import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
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

function createAudioEngine() {
  const master = new Tone.Gain(0.72).toDestination();
  const chordGain = new Tone.Gain(0.68).connect(master);
  const bassGain = new Tone.Gain(0.72).connect(master);
  const drumGain = new Tone.Gain(0.76).connect(master);

  const chords = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle8' },
    envelope: { attack: 0.018, decay: 0.24, sustain: 0.32, release: 0.9 },
  }).connect(chordGain);
  chords.volume.value = -8;

  const bass = new Tone.MonoSynth({
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
    pitchDecay: 0.035,
    octaves: 5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.08 },
  }).connect(drumGain);
  kick.volume.value = -3;

  const snare = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.07 },
  }).connect(drumGain);
  snare.volume.value = -8;

  const hat = new Tone.MetalSynth({
    frequency: 260,
    envelope: { attack: 0.001, decay: 0.045, release: 0.015 },
    harmonicity: 4.8,
    modulationIndex: 28,
    resonance: 4300,
    octaves: 1.4,
  }).connect(drumGain);
  hat.volume.value = -16;

  const clap = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
  }).connect(drumGain);
  clap.volume.value = -11;

  return {
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
    },
  };
}

export default function LearnArranger({
  bpm = 96,
  initialChords = DEFAULT_PROGRESSION,
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
  const [activeInstrument, setActiveInstrument] = useState('chords');
  const [hitPad, setHitPad] = useState('');

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

  useEffect(() => {
    if (engineRef.current) Tone.getTransport().bpm.rampTo(tempo, 0.05);
  }, [tempo]);

  useEffect(
    () => () => {
      const transport = Tone.getTransport();
      transport.stop();
      transport.cancel(0);
      scheduleRef.current.sequences.forEach((sequence) => sequence.dispose());
      engineRef.current?.dispose();
      if (hitTimerRef.current) window.clearTimeout(hitTimerRef.current);
    },
    []
  );

  const ensureEngine = async () => {
    await Tone.start();
    if (!engineRef.current) {
      engineRef.current = createAudioEngine();
      const current = arrangementRef.current;
      Object.entries(engineRef.current.gains).forEach(([track, gain]) => {
        gain.gain.value = gainFromLevel(current.levels[track], current.mutes[track]);
      });
    }
    setAudioReady(true);
    return engineRef.current;
  };

  const clearSchedule = () => {
    const transport = Tone.getTransport();
    scheduleRef.current.sequences.forEach((sequence) => sequence.dispose());
    if (scheduleRef.current.endEventId !== null) {
      transport.clear(scheduleRef.current.endEventId);
    }
    scheduleRef.current = { sequences: [], endEventId: null };
  };

  const stopTransport = () => {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = '0:0:0';
    clearSchedule();
    setIsPlaying(false);
    setActiveBar(0);
    setActiveStep(-1);
  };

  const scheduleArrangement = (engine) => {
    const transport = Tone.getTransport();
    transport.cancel(0);
    transport.bpm.value = tempo;
    transport.loop = loopEnabled;
    transport.loopStart = '0:0:0';
    transport.loopEnd = '4m';

    const chordSequence = new Tone.Sequence(
      (time, bar) => {
        const current = arrangementRef.current;
        const chord = chordFor(current.progression[bar]);
        engine.chords.triggerAttackRelease(chord.notes, '1m', time, 0.62);
        Tone.getDraw().schedule(() => setActiveBar(bar), time);
      },
      [0, 1, 2, 3],
      '1m'
    ).start(0);

    const bassEvents = Array.from({ length: 16 }, (_, index) => ({
      bar: Math.floor(index / 4),
      beat: index % 4,
    }));
    const bassSequence = new Tone.Sequence(
      (time, event) => {
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
      bassEvents,
      '4n'
    ).start(0);

    const drumEvents = Array.from({ length: 64 }, (_, index) => index % 16);
    const drumSequence = new Tone.Sequence(
      (time, step) => {
        const pattern = arrangementRef.current.drumPattern;
        if (pattern.kick[step]) engine.kick.triggerAttackRelease('C1', '8n', time, 0.9);
        if (pattern.snare[step]) engine.snare.triggerAttackRelease('16n', time, 0.62);
        if (pattern.hat[step]) engine.hat.triggerAttackRelease('32n', time, 0.34);
        Tone.getDraw().schedule(() => setActiveStep(step), time);
      },
      drumEvents,
      '16n'
    ).start(0);

    chordSequence.loop = loopEnabled;
    bassSequence.loop = loopEnabled;
    drumSequence.loop = loopEnabled;

    let endEventId = null;
    if (!loopEnabled) {
      endEventId = transport.scheduleOnce((time) => {
        transport.stop(time);
        Tone.getDraw().schedule(() => {
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
    const transport = Tone.getTransport();

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
    engine.chords.triggerAttackRelease(chordFor(chordName).notes, '2n', undefined, 0.72);
    triggerPad(`chord-${chordName}`);
  };

  const playBass = async (note) => {
    const engine = await ensureEngine();
    engine.bass.triggerAttackRelease(note, '8n', undefined, 0.82);
    triggerPad(`bass-${note}`);
  };

  const playDrum = async (drum) => {
    const engine = await ensureEngine();
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
    <div className="learn-arranger">
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
