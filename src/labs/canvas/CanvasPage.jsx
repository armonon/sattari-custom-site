import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Music, Pause, Play, Video } from 'lucide-react';
import LabShell from '../LabShell';
import { downloadBlob, safeFileName } from '../files';
import { analyseBuffer, demoView, featuresAt, loopView } from './canvasFeatures';
import { drawFrame, PALETTES, SCENES } from './canvasScenes';
import { browserFormats, EXPORT_SIZES, LOOP_LENGTHS, recorderMimeType } from './canvasExport';
import { entryFile, useLockerOpen } from '../../suite/suiteKit';

const PREVIEW = { width: 720, height: 1280 };
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

const LIMITATIONS = [
  'Recording runs in real time: an 8 second loop takes 8 seconds, and the tab must stay visible while it records.',
  'MP4 export depends on your browser (recent Chrome, Edge and Safari). Firefox records WebM only; Spotify Canvas needs MP4, so convert WebM files first.',
  'The loop restarts with the audio. Pick a loop start on a downbeat for the cleanest seam; there is no crossfade yet.',
  'Kick detection is a simple low-band onset detector. Busy bass lines or very soft kicks can be missed or double-counted.',
  'Browser-recorded WebM files may lack a duration in their header, so some players show no length until re-saved.',
];

function formatSeconds(value) {
  const minutes = Math.floor(value / 60);
  const seconds = (value % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${seconds}`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url, name: file.name });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That image could not be opened. Try a JPG or PNG.'));
    };
    image.src = url;
  });
}

export default function CanvasPage() {
  const canvasRef = useRef(null);
  const meterRefs = useRef({});
  const audio = useRef({ context: null, source: null, gain: null, startedAt: 0 });
  const clock = useRef({ origin: 0 });
  const settings = useRef(null);

  const [track, setTrack] = useState(null);
  const [cover, setCover] = useState(null);
  const [scene, setScene] = useState('pulse');
  const [paletteId, setPaletteId] = useState('golden');
  const [colors, setColors] = useState(PALETTES[1].colors);
  const [reactivity, setReactivity] = useState(0.8);
  const [loopStart, setLoopStart] = useState(0);
  const [loopLength, setLoopLength] = useState(8);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [sizeId, setSizeId] = useState('720');
  const [formats, setFormats] = useState(null);
  const [variant, setVariant] = useState(0);
  const [formatId, setFormatId] = useState('');
  const [includeAudio, setIncludeAudio] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(null);
  const [status, setStatus] = useState({
    text: 'Drop a track to start. Until then, a built-in 120 BPM pulse drives the preview.',
  });

  const maxStart = track ? Math.max(0, track.duration - loopLength) : 0;
  const start = Math.min(loopStart, maxStart);
  const length = track ? Math.min(loopLength, track.duration - start) : loopLength;
  const view = useMemo(
    () => (track ? loopView(track.analysis, start, length) : demoView(length)),
    [track, start, length]
  );

  useEffect(() => {
    settings.current = {
      scene,
      colors,
      react: reactivity,
      title,
      artist,
      view,
      cover: cover?.image || null,
      variant,
    };
  });

  useEffect(() => {
    const available = browserFormats();
    setFormats(available);
    setFormatId(available[0]?.id || '');
  }, []);

  const loopTime = useCallback(() => {
    const { context, source, startedAt } = audio.current;
    const L = settings.current.view.length;
    if (context && source) return (((context.currentTime - startedAt) % L) + L) % L;
    return (((performance.now() / 1000 - clock.current.origin) % L) + L) % L;
  }, []);

  // One render loop for the page's lifetime; it reads the latest settings.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return undefined;
    clock.current.origin = performance.now() / 1000;
    let frame = 0;
    const tick = () => {
      const s = settings.current;
      if (s) {
        const t = loopTime();
        const f = featuresAt(s.view, t);
        drawFrame(ctx, { ...s, t, f });
        for (const key of ['low', 'high', 'kick']) {
          meterRefs.current[key]?.style.setProperty('--fill', `${Math.round(f[key] * 100)}%`);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loopTime]);

  const ensureContext = () => {
    if (!audio.current.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('This browser does not support Web Audio.');
      const context = new Context();
      const gain = context.createGain();
      gain.connect(context.destination);
      audio.current.context = context;
      audio.current.gain = gain;
    }
    return audio.current.context;
  };

  const stopPlayback = useCallback(() => {
    const { source } = audio.current;
    if (source) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
      source.disconnect();
      audio.current.source = null;
    }
    clock.current.origin = performance.now() / 1000;
    setPlaying(false);
  }, []);

  const startPlayback = useCallback(
    (extraDestination) => {
      if (!track) return;
      const context = ensureContext();
      stopPlayback();
      const source = context.createBufferSource();
      source.buffer = track.buffer;
      source.loop = true;
      source.loopStart = start;
      source.loopEnd = start + length;
      source.connect(audio.current.gain);
      if (extraDestination) source.connect(extraDestination);
      audio.current.startedAt = context.currentTime;
      source.start(context.currentTime, start);
      audio.current.source = source;
      setPlaying(true);
      return context.resume();
    },
    [track, start, length, stopPlayback]
  );

  // Moving the loop while playing restarts it at the new start.
  useEffect(() => {
    if (audio.current.source && !recording) startPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, length]);

  useEffect(
    () => () => {
      stopPlayback();
      audio.current.context?.close?.();
    },
    [stopPlayback]
  );

  useEffect(() => () => cover && URL.revokeObjectURL(cover.url), [cover]);

  // Audio or cover art sent from the Locker or another suite app (?tcc-open=).
  useLockerOpen('canvas', (entry) => {
    const file = entryFile(entry);
    if (/^image\//.test(file.type)) void onCover(file);
    else void onAudio(file);
  });

  const onAudio = async (file) => {
    if (!file) return;
    if (file.size > MAX_AUDIO_BYTES) {
      setStatus({
        text: 'That file is over 200 MB. Use a shorter or compressed file.',
        error: true,
      });
      return;
    }
    setStatus({ text: `Decoding ${file.name}…` });
    try {
      const context = ensureContext();
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      const analysis = analyseBuffer(buffer);
      stopPlayback();
      setTrack({ name: file.name, buffer, analysis, duration: buffer.duration });
      // Start on the first detected kick, if there is one in the first half.
      const firstKick = analysis.onsets.find((time) => time < buffer.duration / 2) || 0;
      setLoopStart(Math.max(0, Math.min(firstKick, buffer.duration - loopLength)));
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 40));
      setStatus({
        text: `${file.name}: ${formatSeconds(buffer.duration)}, ${analysis.onsets.length} kicks detected. Press play to hear the loop.`,
      });
    } catch (error) {
      setStatus({
        text: `Could not decode that file (${error.message || 'unknown format'}). Try WAV, MP3 or M4A.`,
        error: true,
      });
    }
  };

  const onCover = async (file) => {
    if (!file) return;
    try {
      setCover(await loadImage(file));
    } catch (error) {
      setStatus({ text: error.message, error: true });
    }
  };

  const choosePalette = (palette) => {
    setPaletteId(palette.id);
    setColors(palette.colors);
  };

  const setColor = (index, value) =>
    setColors((current) => current.map((color, i) => (i === index ? value : color)));

  const exportStill = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${safeFileName(title, 'canvas')}-still.png`);
    }, 'image/png');
  };

  const exportLoop = async () => {
    const format = formats?.find((item) => item.id === formatId) || formats?.[0];
    const canvas = canvasRef.current;
    if (!format || !canvas) return;
    const size = EXPORT_SIZES.find((item) => item.id === sizeId) || EXPORT_SIZES[0];
    const seconds = settings.current.view.length;
    const stream = canvas.captureStream(30);
    let destination = null;
    try {
      if (includeAudio && track) {
        destination = ensureContext().createMediaStreamDestination();
        destination.stream.getAudioTracks().forEach((item) => stream.addTrack(item));
      }
      canvas.width = size.width;
      canvas.height = size.height;
      const mimeType = recorderMimeType(format, Boolean(destination), (type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: size.width >= 1080 ? 12_000_000 : 8_000_000,
      });
      const chunks = [];
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
      const stopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      setRecording({ seconds, elapsed: 0 });
      setStatus({ text: `Recording ${seconds} s at ${size.label}. Keep this tab visible.` });
      if (track) await startPlayback(destination);
      else clock.current.origin = performance.now() / 1000;
      recorder.start(250);
      const began = performance.now();
      await new Promise((resolve) => {
        const timer = setInterval(() => {
          const elapsed = (performance.now() - began) / 1000;
          setRecording({ seconds, elapsed: Math.min(seconds, elapsed) });
          if (elapsed >= seconds) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
      recorder.stop();
      await stopped;
      stopPlayback();
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      downloadBlob(
        blob,
        `${safeFileName(title, 'canvas')}-${size.width}x${size.height}-${seconds}s.${format.ext}`
      );
      setStatus({
        text: `Saved a ${seconds} s ${format.label} loop (${(blob.size / 1e6).toFixed(1)} MB).`,
      });
    } catch (error) {
      stopPlayback();
      setStatus({ text: `Recording failed: ${error.message || error}`, error: true });
    } finally {
      stream.getTracks().forEach((item) => item.stop());
      destination?.disconnect();
      canvas.width = PREVIEW.width;
      canvas.height = PREVIEW.height;
      setRecording(null);
    }
  };

  return (
    <LabShell
      lab="canvas"
      name="Canvas"
      tagline="Drop a track and cover art. Get a looping, audio-reactive 9:16 video for Spotify Canvas, Reels and TikTok."
      limitations={LIMITATIONS}
    >
      <div className="lab-workspace">
        <div className="lab-panel" aria-label="Canvas settings" role="group">
          <h2>1. Sources</h2>
          <label className="lab-drop">
            <Music size={20} aria-hidden="true" />
            <strong>{track ? track.name : 'Drop a track'}</strong>
            <span>{track ? formatSeconds(track.duration) : 'WAV, MP3, M4A, FLAC, OGG'}</span>
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac,.aif,.aiff"
              aria-label="Track"
              disabled={Boolean(recording)}
              onChange={(event) => onAudio(event.target.files?.[0])}
            />
          </label>
          <label className="lab-drop">
            <ImageIcon size={20} aria-hidden="true" />
            <strong>{cover ? cover.name : 'Add cover art (optional)'}</strong>
            <span>Square JPG or PNG works best</span>
            <input
              type="file"
              accept="image/*"
              aria-label="Cover art"
              disabled={Boolean(recording)}
              onChange={(event) => onCover(event.target.files?.[0])}
            />
          </label>

          <h2>2. Look</h2>
          <div className="lab-field">
            <span>Scene</span>
            <div className="lab-segment" role="group" aria-label="Scene">
              {SCENES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.detail}
                  aria-pressed={scene === item.id}
                  onClick={() => setScene(item.id)}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                title="Cycle through variations of this scene"
                onClick={() => setVariant((value) => (value + 1) % 6)}
              >
                Vary
              </button>
            </div>
          </div>
          <div className="lab-field">
            <span>Palette</span>
            <div className="lab-swatches" role="group" aria-label="Palette">
              {PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  className="lab-swatch"
                  aria-label={palette.label}
                  title={palette.label}
                  aria-pressed={paletteId === palette.id}
                  style={{
                    background: `linear-gradient(135deg, ${palette.colors[0]} 0 40%, ${palette.colors[1]} 40% 70%, ${palette.colors[2]} 70%)`,
                  }}
                  onClick={() => choosePalette(palette)}
                />
              ))}
            </div>
          </div>
          <div className="lab-row">
            {['Background', 'Accent', 'Highlight'].map((label, index) => (
              <label key={label} className="lab-field">
                <span>{label}</span>
                <input
                  type="color"
                  value={colors[index]}
                  onChange={(event) => setColor(index, event.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="lab-field">
            <span>
              Kick reaction <output>{Math.round(reactivity * 100)}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={reactivity}
              onChange={(event) => setReactivity(Number(event.target.value))}
            />
          </label>
          <div className="lab-grid-2">
            <label className="lab-field">
              <span>Title</span>
              <input
                type="text"
                value={title}
                maxLength={40}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="lab-field">
              <span>Artist</span>
              <input
                type="text"
                value={artist}
                maxLength={40}
                onChange={(event) => setArtist(event.target.value)}
              />
            </label>
          </div>

          <h2>3. Loop</h2>
          <div className="lab-field">
            <span>Length</span>
            <div className="lab-segment" role="group" aria-label="Loop length">
              {LOOP_LENGTHS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={loopLength === value}
                  disabled={Boolean(recording)}
                  onClick={() => setLoopLength(value)}
                >
                  {value} s
                </button>
              ))}
            </div>
          </div>
          <label className="lab-field">
            <span>
              Loop start <output>{formatSeconds(start)}</output>
            </span>
            <input
              type="range"
              min="0"
              max={maxStart || 0}
              step="0.05"
              value={start}
              disabled={!track || Boolean(recording)}
              onChange={(event) => setLoopStart(Number(event.target.value))}
            />
          </label>
        </div>

        <div className="lab-panel lab-canvas-stage">
          <canvas
            ref={canvasRef}
            width={PREVIEW.width}
            height={PREVIEW.height}
            aria-label="Canvas preview"
            role="img"
          />
          <div className="lab-meters" aria-hidden="true">
            {[
              ['low', 'Low'],
              ['high', 'High'],
              ['kick', 'Kick'],
            ].map(([key, label]) => (
              <span key={key} className="lab-meter">
                {label}
                <i
                  ref={(node) => {
                    meterRefs.current[key] = node;
                  }}
                />
              </span>
            ))}
          </div>
          <div className="lab-row">
            <button
              type="button"
              className="lab-button"
              disabled={!track || Boolean(recording)}
              onClick={() => (playing ? stopPlayback() : startPlayback())}
            >
              {playing ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
              {playing ? 'Pause' : 'Play loop'}
            </button>
            <button
              type="button"
              className="lab-button"
              disabled={Boolean(recording)}
              onClick={exportStill}
            >
              <Download size={16} aria-hidden="true" /> Still PNG
            </button>
          </div>
          <div className="lab-row">
            <label className="lab-field">
              <span>Size</span>
              <select
                value={sizeId}
                disabled={Boolean(recording)}
                onChange={(event) => setSizeId(event.target.value)}
              >
                {EXPORT_SIZES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="lab-field">
              <span>Format</span>
              <select
                value={formatId}
                disabled={!formats?.length || Boolean(recording)}
                onChange={(event) => setFormatId(event.target.value)}
              >
                {(formats || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="lab-row lab-field">
            <input
              type="checkbox"
              checked={includeAudio}
              disabled={!track || Boolean(recording)}
              onChange={(event) => setIncludeAudio(event.target.checked)}
            />
            Include audio (for Reels/TikTok; Spotify Canvas must be silent)
          </label>
          <button
            type="button"
            className="lab-button is-primary"
            disabled={!formats?.length || Boolean(recording)}
            onClick={exportLoop}
          >
            <Video size={16} aria-hidden="true" />
            {recording
              ? `Recording ${recording.elapsed.toFixed(1)} / ${recording.seconds} s`
              : `Export ${length} s loop`}
          </button>
          {formats?.length === 0 && (
            <p className="lab-status is-error">
              This browser cannot record canvas video. Try recent Chrome, Edge or Safari.
            </p>
          )}
          <p className={`lab-status${status.error ? ' is-error' : ''}`} role="status">
            {status.text}
          </p>
        </div>
      </div>
    </LabShell>
  );
}
