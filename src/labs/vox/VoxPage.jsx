import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, LoaderCircle, Mic, Play, Square } from 'lucide-react';
import AudioLabShell from '../audio/AudioLabShell';
import { formatTime, LabDrop, LabWaveform } from '../audio/AudioLabParts';
import {
  baseName,
  decodeMono,
  downloadBlob,
  isAudioFile,
  LAB_RATE,
  peaksOf,
  wavBlob,
} from '../audio/audioLabFiles';
import useVoxRecorder from './useVoxRecorder';
import { hzToMidi, keyLabel, NOTE_NAMES, scalePitchClasses, VOX_MAX_SECONDS } from './voxDsp';

const LIMITS = [
  'One clean, solo (monophonic) voice. Backing tracks, reverb-heavy or polyphonic audio confuse the pitch tracker.',
  'Pitch detection is YIN-based (no neural model yet) and the shifter is a simple PSOLA: large corrections and harmonies can sound phasey or robotic.',
  'Harmony is one diatonic voice (3rd or 5th above), generated from the same take, so it moves exactly with the lead.',
  'Up to 3 minutes per take. Processing is offline (not live while you sing); changes re-render in about a second.',
  'Key detection reads the notes you sang and can pick the relative major/minor; check it and override if needed.',
];

const STRENGTH_DEFAULT = 0.8;

function createWorker() {
  return new Worker(new URL('./vox.worker.js', import.meta.url), { type: 'module' });
}

function PitchGraph({ analysis, curve, keyChoice, duration }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !analysis) return undefined;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = rect.width,
        height = 180;
      canvas.width = Math.max(1, width * scale);
      canvas.height = height * scale;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(scale, scale);
      const { f0, hopSeconds, offsetSeconds } = analysis;
      const midis = [];
      for (const hz of f0) if (hz) midis.push(hzToMidi(hz));
      if (!midis.length) return;
      midis.sort((a, b) => a - b);
      const low = Math.floor(midis[Math.floor(midis.length * 0.02)]) - 2;
      const high = Math.ceil(midis[Math.floor(midis.length * 0.98)]) + 2;
      const y = (midi) => height - ((midi - low) / Math.max(1, high - low)) * height;
      const x = (seconds) => (seconds / Math.max(0.1, duration)) * width;
      const classes = scalePitchClasses(keyChoice.root, keyChoice.mode);
      const styles = getComputedStyle(canvas);
      context.font = '10px Inter, sans-serif';
      for (let note = low; note <= high; note++) {
        if (!classes.includes(((note % 12) + 12) % 12)) continue;
        context.fillStyle = styles.getPropertyValue('--alab-line') || '#34383b';
        context.fillRect(0, y(note), width, 1);
        context.fillStyle = styles.getPropertyValue('--alab-muted') || '#a4acae';
        context.fillText(NOTE_NAMES[((note % 12) + 12) % 12], 2, y(note) - 2);
      }
      const plot = (color, shiftAt) => {
        context.fillStyle = color;
        for (let i = 0; i < f0.length; i++) {
          if (!f0[i]) continue;
          const midi = hzToMidi(f0[i]) + shiftAt(i);
          context.fillRect(x(offsetSeconds + i * hopSeconds), y(midi) - 1, 2, 2);
        }
      };
      plot('rgba(160, 168, 170, 0.55)', () => 0);
      if (curve) plot(styles.getPropertyValue('--alab-accent') || '#b9e7c8', (i) => curve[i] || 0);
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [analysis, curve, keyChoice, duration]);
  return (
    <canvas
      ref={ref}
      className="alab-pitch-graph"
      role="img"
      aria-label="Detected pitch in grey, corrected pitch in colour, scale notes as lines"
    />
  );
}

export default function VoxPage() {
  const [take, setTake] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [keyChoice, setKeyChoice] = useState({ root: 0, mode: 'major' });
  const [strength, setStrength] = useState(STRENGTH_DEFAULT);
  const [speedMs, setSpeedMs] = useState(40);
  const [harmony, setHarmony] = useState('none');
  const [harmonyGain, setHarmonyGain] = useState(0.6);
  const [render, setRender] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [playing, setPlaying] = useState(null);
  const worker = useRef(null);
  const currentId = useRef(null);
  const serial = useRef(0);
  const audio = useRef(null);
  const source = useRef(null);

  useEffect(() => {
    const instance = createWorker();
    worker.current = instance;
    instance.onmessage = ({ data }) => {
      if (data.id !== currentId.current) return;
      if (data.type === 'progress') setProgress(data.progress);
      if (data.type === 'loaded') {
        setProgress(null);
        setAnalysis(data);
        if (data.key.valid) setKeyChoice({ root: data.key.root, mode: data.key.mode });
      }
      if (data.type === 'rendered' && data.serial === serial.current) {
        setRender(data);
        setRendering(false);
      }
      if (data.type === 'error') {
        setProgress(null);
        setRendering(false);
        setError(data.message);
      }
    };
    instance.onerror = (event) => {
      event.preventDefault?.();
      setProgress(null);
      setRendering(false);
      setError('The Vox engine stopped. Reload the page and try a shorter take.');
    };
    return () => {
      instance.terminate();
      try {
        source.current?.stop();
      } catch {
        /* already stopped */
      }
      void audio.current?.close().catch(() => {});
    };
  }, []);

  const stopPlayback = useCallback(() => {
    if (source.current) {
      source.current.onended = null;
      try {
        source.current.stop();
      } catch {
        /* already stopped */
      }
      source.current = null;
    }
    setPlaying(null);
  }, []);

  const loadTake = useCallback(
    async (blob, name) => {
      stopPlayback();
      setError('');
      setAnalysis(null);
      setRender(null);
      try {
        const decoded = await decodeMono(blob, LAB_RATE);
        if (decoded.duration > VOX_MAX_SECONDS + 1)
          throw new Error('Takes can be up to 3 minutes. Trim the file and try again.');
        if (decoded.duration < 1) throw new Error('The take is shorter than a second.');
        const id = crypto.randomUUID();
        currentId.current = id;
        setTake({ id, name, ...decoded, peaks: peaksOf(decoded.samples) });
        setProgress(0);
        worker.current.postMessage({
          type: 'load',
          id,
          samples: decoded.samples.slice(),
          rate: decoded.rate,
        });
      } catch (problem) {
        setTake(null);
        setError(problem.message);
      }
    },
    [stopPlayback]
  );

  const recorder = useVoxRecorder((blob) => void loadTake(blob, 'vox-recording'));

  // Re-render whenever a setting changes (debounced; stale renders are dropped).
  useEffect(() => {
    if (!take || !analysis || analysis.id !== take.id) return undefined;
    const timer = setTimeout(() => {
      serial.current += 1;
      setRendering(true);
      worker.current.postMessage({
        type: 'render',
        id: take.id,
        serial: serial.current,
        options: {
          root: keyChoice.root,
          mode: keyChoice.mode,
          strength,
          speedMs,
          harmony: harmony === 'none' ? null : harmony,
          harmonyGain,
        },
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [take, analysis, keyChoice, strength, speedMs, harmony, harmonyGain]);

  const play = async (which) => {
    stopPlayback();
    const samples = which === 'original' ? take?.samples : render?.mix;
    if (!samples) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    audio.current ||= new Context();
    await audio.current.resume();
    const buffer = audio.current.createBuffer(1, samples.length, LAB_RATE);
    buffer.copyToChannel(samples, 0);
    const node = audio.current.createBufferSource();
    node.buffer = buffer;
    node.connect(audio.current.destination);
    node.onended = () => {
      if (source.current === node) {
        source.current = null;
        setPlaying(null);
      }
    };
    node.start();
    source.current = node;
    setPlaying(which);
  };

  const exportWav = (samples, suffix) =>
    downloadBlob(wavBlob([samples], LAB_RATE), `${baseName(take.name)}-${suffix}.wav`);

  const detected = analysis?.key;
  const busy = progress !== null || recorder.status !== 'idle';

  return (
    <AudioLabShell
      tool="vox"
      title="Vox"
      eyebrow="Sattari Studio lab"
      summary="Record or drop a vocal, let Vox find the key, then pull every note to the scale with as much or as little strength as you like. Add a third or fifth harmony and export WAV."
      description="Record or drop a vocal, detect its key, pitch-correct it to the scale with a strength control, add a harmony and export WAV in your browser."
      limits={LIMITS}
    >
      <div className="alab-workspace">
        <div className="alab-input-row">
          <section className="alab-card alab-record" aria-label="Record">
            <h2>Record</h2>
            <p className="alab-note">Headphones on. Browser voice processing is switched off.</p>
            {recorder.status === 'recording' ? (
              <button type="button" className="alab-button alab-danger" onClick={recorder.stop}>
                <Square size={16} aria-hidden="true" /> Stop · {formatTime(recorder.elapsed)}
              </button>
            ) : (
              <button
                type="button"
                className="alab-button alab-primary"
                disabled={busy}
                onClick={() => void recorder.start()}
              >
                <Mic size={16} aria-hidden="true" />{' '}
                {recorder.status === 'requesting' ? 'Waiting for microphone…' : 'Record a take'}
              </button>
            )}
            <meter
              className="alab-meter"
              min="0"
              max="1"
              low="0.7"
              high="0.95"
              optimum="0.5"
              value={recorder.level}
              aria-label="Input level"
            />
            {recorder.error && (
              <p className="alab-bad" role="alert">
                {recorder.error}
              </p>
            )}
          </section>
          <LabDrop
            title="Or drop a vocal"
            hint="Dry solo vocal · WAV, MP3, M4A · up to 3 min"
            disabled={busy}
            onFiles={(files) => {
              const file = files.find(isAudioFile);
              if (file) void loadTake(file, file.name);
              else if (files.length) setError('Choose an audio file.');
            }}
          />
        </div>
        {error && (
          <div className="alab-error" role="alert">
            <p>{error}</p>
          </div>
        )}

        {take && (
          <section className="alab-card" aria-label="Take">
            <div className="alab-card-head">
              <div>
                <h2 title={take.name}>{take.name}</h2>
                <p className="alab-note">
                  {formatTime(take.duration)} · mono · 44.1 kHz
                  {analysis && ` · ${Math.round(analysis.voiced * 100)}% voiced`}
                </p>
              </div>
            </div>
            <LabWaveform peaks={take.peaks} color="#e998bc" />
            {progress !== null && (
              <div className="alab-progress" role="status">
                <div>
                  <span>
                    <LoaderCircle className="alab-spin" size={14} aria-hidden="true" /> Tracking
                    pitch
                  </span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <progress max="1" value={progress} aria-label="Pitch tracking progress" />
              </div>
            )}
            {analysis && (
              <>
                <div className="alab-controls">
                  <fieldset>
                    <legend>Key</legend>
                    <p className="alab-note" aria-live="polite">
                      {detected?.valid
                        ? `Detected ${keyLabel(detected)}${detected.margin < 0.1 ? ' (tentative)' : ''}${detected.alternative ? ` · alt. ${detected.alternative}` : ''}`
                        : 'No clear key found. Pick one.'}
                    </p>
                    <div className="alab-pair">
                      <select
                        aria-label="Key root"
                        value={keyChoice.root}
                        onChange={(event) =>
                          setKeyChoice((value) => ({ ...value, root: Number(event.target.value) }))
                        }
                      >
                        {NOTE_NAMES.map((name, index) => (
                          <option key={name} value={index}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Scale"
                        value={keyChoice.mode}
                        onChange={(event) =>
                          setKeyChoice((value) => ({ ...value, mode: event.target.value }))
                        }
                      >
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                        <option value="chromatic">Chromatic</option>
                      </select>
                    </div>
                  </fieldset>
                  <label className="alab-slider">
                    <span>
                      Strength <output>{Math.round(strength * 100)}%</output>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={strength}
                      onChange={(event) => setStrength(Number(event.target.value))}
                    />
                  </label>
                  <label className="alab-slider">
                    <span>
                      Glide <output>{speedMs === 0 ? 'Instant' : `${speedMs} ms`}</output>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="5"
                      value={speedMs}
                      onChange={(event) => setSpeedMs(Number(event.target.value))}
                    />
                  </label>
                  <fieldset>
                    <legend>Harmony</legend>
                    <div className="alab-segmented">
                      {[
                        ['none', 'Off'],
                        ['third', '3rd above'],
                        ['fifth', '5th above'],
                      ].map(([value, label]) => (
                        <label key={value} className={harmony === value ? 'is-on' : undefined}>
                          <input
                            type="radio"
                            name="vox-harmony"
                            value={value}
                            checked={harmony === value}
                            onChange={() => setHarmony(value)}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {harmony !== 'none' && (
                      <label className="alab-slider">
                        <span>
                          Harmony level <output>{Math.round(harmonyGain * 100)}%</output>
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={harmonyGain}
                          onChange={(event) => setHarmonyGain(Number(event.target.value))}
                        />
                      </label>
                    )}
                  </fieldset>
                </div>
                <PitchGraph
                  analysis={analysis}
                  curve={render?.curve}
                  keyChoice={keyChoice}
                  duration={take.duration}
                />
                <div className="alab-actions">
                  {playing ? (
                    <button type="button" className="alab-button" onClick={stopPlayback}>
                      <Square size={16} aria-hidden="true" /> Stop {playing}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="alab-button alab-primary"
                        disabled={!render}
                        onClick={() => void play('tuned')}
                      >
                        <Play size={16} aria-hidden="true" /> Play tuned
                      </button>
                      <button
                        type="button"
                        className="alab-button"
                        onClick={() => void play('original')}
                      >
                        <Play size={16} aria-hidden="true" /> Play original
                      </button>
                    </>
                  )}
                  {rendering && (
                    <span className="alab-status" role="status">
                      <LoaderCircle className="alab-spin" size={14} aria-hidden="true" /> Rendering
                    </span>
                  )}
                  <button
                    type="button"
                    className="alab-button"
                    disabled={!render}
                    onClick={() => exportWav(render.mix, 'vox-tuned')}
                  >
                    <Download size={16} aria-hidden="true" /> Export WAV
                  </button>
                  {render?.harmony && (
                    <>
                      <button
                        type="button"
                        className="alab-text-button"
                        onClick={() => exportWav(render.lead, 'vox-lead')}
                      >
                        Lead only
                      </button>
                      <button
                        type="button"
                        className="alab-text-button"
                        onClick={() => exportWav(render.harmony, 'vox-harmony')}
                      >
                        Harmony only
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </AudioLabShell>
  );
}
