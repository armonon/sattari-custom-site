import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Download, LoaderCircle, Mic, Pause, Play, Square, Wand2 } from 'lucide-react';
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
import useVoxRecorder from '../vox/useVoxRecorder';
import {
  autoDetectNoiseWindow,
  estimateNoiseProfile,
  LOUDNESS_PRESETS,
  processChain,
} from './cleanDsp';
import { computeSpectrogram, drawSpectrogram } from './cleanSpectrogram';

const LIMITS = [
  'Cannot fix clipping: audio that was already distorted at the source stays distorted.',
  'Not a de-reverb tool: heavy room echo or reverb is not removed, only noise and sibilance.',
  'Noise reduction is spectral gating, not a trained model; heavy denoise amounts can add warbly "musical noise" artifacts.',
  'The de-esser is a broad 4-9 kHz band reduction, not a trained sibilance detector, so it can dull real high-frequency content along with the "ess" sounds.',
  'Loudness targets are LUFS integrated over the whole clip using the same meter as the rest of Studio, not a certified multi-pass broadcast measurement.',
  'One file or recording at a time. Nothing is saved automatically: export the WAV before leaving the page.',
];

const STAGE_LABELS = {
  highPass: 'High-pass (rumble)',
  denoise: 'Noise reduction',
  deEss: 'De-esser',
  compress: 'Compressor',
  normalize: 'Loudness + limiter',
};

function defaultStages(preset) {
  const target = LOUDNESS_PRESETS[preset];
  return {
    highPass: { enabled: true, amount: 100, cutoffHz: 80 },
    denoise: { enabled: true, amount: 60, noiseProfile: null },
    deEss: { enabled: true, amount: 50 },
    compress: {
      enabled: true,
      amount: 100,
      thresholdDb: -24,
      ratio: 3,
      attackMs: 5,
      releaseMs: 60,
    },
    normalize: {
      enabled: true,
      amount: 100,
      targetLufs: target.targetLufs,
      targetPeakDb: target.targetPeakDb,
    },
  };
}

function lufsText(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} LUFS` : '–';
}

function dbtpText(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} dBTP` : '–';
}

/** Spectrogram or waveform preview for one buffer, toggled by the parent's view state. */
function CleanView({ samples, rate, view, color }) {
  const canvasRef = useRef(null);
  const peaks = useMemo(() => (samples ? peaksOf(samples, 320) : null), [samples]);
  useEffect(() => {
    if (view !== 'spectrogram' || !samples || !canvasRef.current) return undefined;
    const canvas = canvasRef.current;
    const render = () => drawSpectrogram(canvas, computeSpectrogram(samples, rate), { color });
    render();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [view, samples, rate, color]);
  if (!samples) return null;
  return view === 'spectrogram' ? (
    <canvas ref={canvasRef} className="alab-pitch-graph" role="img" aria-label="Spectrogram" />
  ) : (
    <LabWaveform peaks={peaks} color={`rgb(${color.join(',')})`} />
  );
}

export default function CleanPage() {
  const [source, setSource] = useState(null); // { samples, rate, duration, name }
  const [error, setError] = useState('');
  const [noiseProfile, setNoiseProfile] = useState(null);
  const [noiseWindow, setNoiseWindow] = useState(null);
  const [preset, setPreset] = useState('podcast');
  const [stages, setStages] = useState(() => defaultStages('podcast'));
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // { samples, before, after }
  const [bufferView, setBufferView] = useState('after'); // 'before' | 'after'
  const [renderMode, setRenderMode] = useState('waveform'); // 'waveform' | 'spectrogram'
  const [playing, setPlaying] = useState(null); // 'dry' | 'wet' | null

  const audioCtx = useRef(null);
  const activeNode = useRef(null);

  const recorder = useVoxRecorder((blob) => void load(blob, 'Microphone take'));

  // Auto-detect a quiet region and learn a default noise profile the moment a
  // recording is decoded, so "one button" works with zero configuration.
  useEffect(() => {
    if (!source) {
      setNoiseProfile(null);
      setNoiseWindow(null);
      return;
    }
    try {
      const window = autoDetectNoiseWindow(source.samples, source.rate);
      const profile = estimateNoiseProfile(source.samples, source.rate, window);
      setNoiseWindow(window);
      setNoiseProfile(profile);
    } catch {
      setNoiseProfile(null);
      setNoiseWindow(null);
    }
  }, [source]);

  // Switching the podcast/music preset updates the normalize stage's targets,
  // but leaves any other hand-tuned stage settings alone.
  useEffect(() => {
    const target = LOUDNESS_PRESETS[preset];
    setStages((prev) => ({
      ...prev,
      normalize: {
        ...prev.normalize,
        targetLufs: target.targetLufs,
        targetPeakDb: target.targetPeakDb,
      },
    }));
  }, [preset]);

  function stopPlayback() {
    if (activeNode.current) {
      try {
        activeNode.current.stop();
      } catch {
        /* already stopped */
      }
      activeNode.current = null;
    }
    setPlaying(null);
  }

  function getAudioContext() {
    if (!audioCtx.current) {
      const Context = window.AudioContext || window.webkitAudioContext;
      audioCtx.current = new Context();
    }
    return audioCtx.current;
  }

  function playSamples(samples, rate, gain, label) {
    stopPlayback();
    const context = getAudioContext();
    const buffer = context.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples, 0);
    const node = context.createBufferSource();
    node.buffer = buffer;
    const gainNode = context.createGain();
    gainNode.gain.value = gain;
    node.connect(gainNode).connect(context.destination);
    node.onended = () => {
      if (activeNode.current === node) {
        activeNode.current = null;
        setPlaying(null);
      }
    };
    node.start();
    activeNode.current = node;
    setPlaying(label);
  }

  // Level-matched A/B: the dry original is usually much quieter than the
  // cleaned result, so playing both at their native levels would just make
  // "cleaned" sound better because it's louder. We gain-compensate the dry
  // playback to roughly the cleaned result's integrated loudness (computed
  // once by processChain's before/after ProgrammeMeter snapshot) so the
  // comparison is about tone, not volume.
  function playOriginal() {
    if (!source || !result) return;
    const gainDb =
      Number.isFinite(result.after.integrated) && Number.isFinite(result.before.integrated)
        ? result.after.integrated - result.before.integrated
        : 0;
    playSamples(source.samples, source.rate, 10 ** (gainDb / 20), 'dry');
  }

  function playCleaned() {
    if (!result) return;
    playSamples(result.samples, source.rate, 1, 'wet');
  }

  async function load(blob, name) {
    setError('');
    setResult(null);
    stopPlayback();
    try {
      const { samples, rate, duration } = await decodeMono(blob, LAB_RATE);
      setSource({ samples, rate, duration, name });
    } catch (err) {
      setError(err.message || 'That file could not be decoded.');
    }
  }

  function choose(files) {
    const file = files.find(isAudioFile);
    if (!file) {
      setError('Drop a WAV, MP3, M4A or similar audio file.');
      return;
    }
    void load(file, file.name);
  }

  function updateStage(name, patch) {
    setStages((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  }

  async function cleanItUp() {
    if (!source) return;
    setProcessing(true);
    setError('');
    stopPlayback();
    try {
      // Let the "processing" state paint before the (synchronous, possibly
      // ~1s on a long clip) DSP chain runs on the main thread.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const chainStages = {
        ...stages,
        denoise: { ...stages.denoise, noiseProfile: stages.denoise.noiseProfile || noiseProfile },
      };
      const next = processChain(source.samples, source.rate, chainStages);
      setResult(next);
      setBufferView('after');
    } catch (err) {
      setError(err.message || 'Cleanup failed. Try a shorter clip.');
    } finally {
      setProcessing(false);
    }
  }

  function exportWav() {
    if (!result || !source) return;
    const blob = wavBlob([result.samples], source.rate);
    downloadBlob(blob, `${baseName(source.name)}-clean.wav`);
  }

  const shownSamples = bufferView === 'after' && result ? result.samples : source?.samples;
  const shownColor = bufferView === 'after' && result ? [185, 231, 200] : [139, 147, 155];

  return (
    <AudioLabShell
      tool="clean"
      title="Clean"
      eyebrow="Sattari Studio lab"
      summary="Drop a voice recording (or record one here) and clean it up on your device: rumble filtered, noise gated, sibilance tamed, dynamics evened out and loudness matched to a podcast or music target, in one click."
      description="Clean a voice recording on-device: high-pass, spectral noise reduction, de-essing, gentle compression and LUFS loudness normalization with a true-peak limiter."
      limits={LIMITS}
    >
      <div className="alab-workspace">
        <LabDrop
          title={source ? 'Choose another recording' : 'Add a voice recording'}
          hint="WAV, MP3, M4A, OGG, WEBM · one take at a time"
          disabled={processing}
          onFiles={choose}
        >
          {recorder.status === 'recording' ? (
            <button type="button" className="alab-button alab-danger" onClick={recorder.stop}>
              <Square size={16} aria-hidden="true" /> Stop ({formatTime(recorder.elapsed)})
            </button>
          ) : (
            <button
              type="button"
              className="alab-text-button"
              disabled={processing || recorder.status === 'requesting'}
              onClick={() => void recorder.start()}
            >
              <Mic size={15} aria-hidden="true" />{' '}
              {recorder.status === 'requesting' ? 'Requesting mic…' : 'Record instead'}
            </button>
          )}
        </LabDrop>

        {(error || recorder.error) && (
          <div className="alab-error" role="alert">
            <p>{error || recorder.error}</p>
          </div>
        )}

        {source && (
          <section className="alab-card" aria-label="Recording">
            <div className="alab-card-head">
              <div>
                <h2 title={source.name}>{source.name}</h2>
                <p className="alab-note">
                  {formatTime(source.duration)}
                  {noiseWindow &&
                    ` · noise profile learned from ${noiseWindow.startSeconds.toFixed(1)}s–${noiseWindow.endSeconds.toFixed(1)}s`}
                </p>
              </div>
              <div className="alab-toolbar-actions">
                <label className="alab-inline-select">
                  Target
                  <select
                    value={preset}
                    disabled={processing}
                    onChange={(event) => setPreset(event.target.value)}
                  >
                    {Object.entries(LOUDNESS_PRESETS).map(([id, info]) => (
                      <option key={id} value={id}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="alab-button alab-primary"
                  disabled={processing}
                  onClick={() => void cleanItUp()}
                >
                  {processing ? (
                    <LoaderCircle className="alab-spin" size={16} aria-hidden="true" />
                  ) : (
                    <Wand2 size={16} aria-hidden="true" />
                  )}{' '}
                  Clean it up
                </button>
              </div>
            </div>

            <div className="alab-drop-actions">
              <div className="alab-segmented" role="group" aria-label="Buffer shown">
                {['before', 'after'].map((id) => (
                  <label key={id} className={bufferView === id ? 'is-on' : undefined}>
                    <input
                      type="radio"
                      name="clean-buffer"
                      checked={bufferView === id}
                      onChange={() => setBufferView(id)}
                      disabled={id === 'after' && !result}
                    />
                    {id === 'before' ? 'Original' : 'Cleaned'}
                  </label>
                ))}
              </div>
              <div className="alab-segmented" role="group" aria-label="View">
                {['waveform', 'spectrogram'].map((id) => (
                  <label key={id} className={renderMode === id ? 'is-on' : undefined}>
                    <input
                      type="radio"
                      name="clean-view"
                      checked={renderMode === id}
                      onChange={() => setRenderMode(id)}
                    />
                    {id === 'waveform' ? 'Waveform' : 'Spectrogram'}
                  </label>
                ))}
              </div>
            </div>

            <CleanView
              samples={shownSamples}
              rate={source.rate}
              view={renderMode}
              color={shownColor}
            />

            {result && (
              <>
                <div className="alab-table-wrap">
                  <table className="alab-table">
                    <thead>
                      <tr>
                        <th scope="col"></th>
                        <th scope="col">Integrated loudness</th>
                        <th scope="col">True peak</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Before</th>
                        <td>{lufsText(result.before.integrated)}</td>
                        <td>{dbtpText(result.before.truePeak)}</td>
                      </tr>
                      <tr>
                        <th scope="row">After</th>
                        <td>{lufsText(result.after.integrated)}</td>
                        <td>{dbtpText(result.after.truePeak)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="alab-actions">
                  <button
                    type="button"
                    className="alab-button"
                    onClick={playing === 'dry' ? stopPlayback : playOriginal}
                  >
                    {playing === 'dry' ? (
                      <Pause size={16} aria-hidden="true" />
                    ) : (
                      <Play size={16} aria-hidden="true" />
                    )}{' '}
                    Original (level-matched)
                  </button>
                  <button
                    type="button"
                    className="alab-button"
                    onClick={playing === 'wet' ? stopPlayback : playCleaned}
                  >
                    {playing === 'wet' ? (
                      <Pause size={16} aria-hidden="true" />
                    ) : (
                      <Play size={16} aria-hidden="true" />
                    )}{' '}
                    Cleaned
                  </button>
                  <button type="button" className="alab-button alab-primary" onClick={exportWav}>
                    <Download size={16} aria-hidden="true" /> Export WAV
                  </button>
                </div>
                <p className="alab-note">
                  &ldquo;Original (level-matched)&rdquo; plays the untouched recording boosted or
                  trimmed to roughly the cleaned clip&rsquo;s loudness, so the comparison is about
                  tone and noise, not volume.
                </p>
              </>
            )}

            <details className="alab-note">
              <summary>Advanced: per-stage amount</summary>
              <div className="alab-controls">
                {Object.entries(stages).map(([name, config]) => (
                  <fieldset key={name}>
                    <legend>
                      <label>
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={(event) => updateStage(name, { enabled: event.target.checked })}
                        />{' '}
                        {STAGE_LABELS[name]}
                      </label>
                    </legend>
                    <label className="alab-slider">
                      <span>
                        Amount <output>{config.amount}%</output>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={config.amount}
                        disabled={!config.enabled}
                        onChange={(event) =>
                          updateStage(name, { amount: Number(event.target.value) })
                        }
                      />
                    </label>
                    {name === 'highPass' && (
                      <label className="alab-slider">
                        <span>
                          Cutoff <output>{config.cutoffHz} Hz</output>
                        </span>
                        <input
                          type="range"
                          min={40}
                          max={200}
                          value={config.cutoffHz}
                          disabled={!config.enabled}
                          onChange={(event) =>
                            updateStage(name, { cutoffHz: Number(event.target.value) })
                          }
                        />
                      </label>
                    )}
                    {name === 'compress' && (
                      <>
                        <label className="alab-slider">
                          <span>
                            Threshold <output>{config.thresholdDb} dB</output>
                          </span>
                          <input
                            type="range"
                            min={-40}
                            max={-6}
                            value={config.thresholdDb}
                            disabled={!config.enabled}
                            onChange={(event) =>
                              updateStage(name, { thresholdDb: Number(event.target.value) })
                            }
                          />
                        </label>
                        <label className="alab-slider">
                          <span>
                            Ratio <output>{config.ratio.toFixed(1)}:1</output>
                          </span>
                          <input
                            type="range"
                            min={1.5}
                            max={6}
                            step={0.1}
                            value={config.ratio}
                            disabled={!config.enabled}
                            onChange={(event) =>
                              updateStage(name, { ratio: Number(event.target.value) })
                            }
                          />
                        </label>
                      </>
                    )}
                  </fieldset>
                ))}
              </div>
            </details>

            <p className="alab-note">
              <AudioLines size={13} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Chain
              order: high-pass → noise reduction → de-esser → compressor → loudness + true-peak
              limiter. Change a setting, then press &ldquo;Clean it up&rdquo; again to re-render.
            </p>
          </section>
        )}
      </div>
    </AudioLabShell>
  );
}
