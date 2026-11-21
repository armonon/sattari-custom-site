import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Repeat,
  SkipBack,
  Square,
  VolumeX,
} from 'lucide-react';
import {
  applyPreset,
  CLIP_SAFE_PEAK,
  createMix,
  describeMix,
  formatDb,
  gainToDb,
  laneGain,
  MAX_GAIN,
  MAX_MASTER,
  MIX_FORMATS,
  MIX_PRESETS,
  mixFileName,
  mixPeak,
  mixWavBlob,
  sliceSources,
  parseWav,
  renderMix,
  soloMix,
} from '../../utils/stemMix';
import StemWaveform from './StemWaveform';
import { aacSupported, encodeMixAac } from '../../utils/mixEncodeAac';
import './StemPlayer.css';

export const formatClock = (seconds) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};
const MIN_LOOP = 0.25;

/** Presets that make sense for the stems this result actually contains. */
export function availablePresets(ids) {
  return MIX_PRESETS.filter(
    (preset) =>
      preset.muted.every((id) => ids.includes(id)) &&
      ids.some((id) => !preset.muted.includes(id)) &&
      (preset.id === 'all' || ids.length === 4)
  );
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Synchronized stem player with one Web Audio clock for every lane.
 *
 * stems: [{ id, label, color, blob (WAV), url, name, peaks }]
 * original: { blob, peaks } | null  — the untouched source, heard only as a
 *   separate A/B reference, never summed into the stem mix or the export.
 */
export default function StemPlayer({
  trackName,
  fileBase,
  stems,
  original = null,
  initialPreset = 'all',
  onEvent = () => {},
  stemActions,
  afterExport,
}) {
  const ids = useMemo(() => stems.map((stem) => stem.id), [stems]);
  const presets = useMemo(() => availablePresets(ids), [ids]);
  const context = useRef(null);
  const buffers = useRef(new Map());
  const laneNodes = useRef(new Map());
  const bus = useRef(null);
  const originalNode = useRef(null);
  const originalBuffer = useRef(null);
  const sourcesPlaying = useRef([]);
  const clock = useRef({ startedAt: 0, offset: 0 });
  const frame = useRef(0);
  const exportAbort = useRef(null);
  const previewCounted = useRef(false);
  const [load, setLoad] = useState({
    status: 'loading',
    message: 'Preparing synchronized playback',
  });
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [listen, setListen] = useState('stems');
  const [originalState, setOriginalState] = useState(original ? 'idle' : 'missing');
  const [loop, setLoop] = useState({ a: null, b: null });
  const [mix, setMix] = useState(() => {
    const base = createMix(ids);
    if (initialPreset?.startsWith('solo:') && ids.includes(initialPreset.slice(5)))
      return soloMix(base, initialPreset.slice(5));
    return presets.some((preset) => preset.id === initialPreset)
      ? applyPreset(base, initialPreset)
      : base;
  });
  const [peak, setPeak] = useState(null);
  const [headroom, setHeadroom] = useState('none');
  const [format, setFormat] = useState('float32');
  const [range, setRange] = useState('full');
  const [aac, setAac] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [exported, setExported] = useState(null);
  const [exportError, setExportError] = useState('');
  const description = describeMix(mix);
  const loopActive = loop.a !== null && loop.b !== null;
  const outputGain =
    headroom === 'prevent-clipping' && peak > CLIP_SAFE_PEAK ? CLIP_SAFE_PEAK / peak : 1;

  // Load the stems as exact 44.1 kHz PCM (no resampling) into AudioBuffers.
  // The same buffers are the export source, so preview and render share data.
  useEffect(() => {
    let cancelled = false;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      setLoad({
        status: 'error',
        message: 'This browser cannot play stems together. Individual WAV downloads still work.',
      });
      return undefined;
    }
    const audio = new Context();
    context.current = audio;
    const master = audio.createGain();
    master.connect(audio.destination);
    bus.current = master;
    const nodes = laneNodes.current;
    const decoded = buffers.current;
    (async () => {
      try {
        let longest = 0;
        for (const stem of stems) {
          const parsed = parseWav(await stem.blob.arrayBuffer());
          if (cancelled) return;
          const length = parsed.channels[0].length;
          const buffer = audio.createBuffer(2, Math.max(1, length), parsed.sampleRate);
          buffer.copyToChannel(parsed.channels[0], 0);
          buffer.copyToChannel(parsed.channels[1] || parsed.channels[0], 1);
          decoded.set(stem.id, buffer);
          const gain = audio.createGain();
          gain.gain.value = 0;
          gain.connect(master);
          nodes.set(stem.id, gain);
          longest = Math.max(longest, buffer.duration);
        }
        if (cancelled) return;
        setDuration(longest);
        setLoad({ status: 'ready', message: '' });
      } catch {
        if (!cancelled)
          setLoad({
            status: 'error',
            message:
              'Playback could not be prepared, possibly because the device is low on memory. The WAV downloads below still work.',
          });
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame.current);
      exportAbort.current?.abort();
      sourcesPlaying.current.forEach((source) => {
        source.onended = null;
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      });
      sourcesPlaying.current = [];
      decoded.clear();
      nodes.clear();
      originalBuffer.current = null;
      originalNode.current = null;
      void audio.close().catch(() => {});
    };
  }, [stems]);

  useEffect(() => {
    let live = true;
    aacSupported().then((ok) => live && setAac(ok));
    return () => {
      live = false;
    };
  }, []);

  // One gain rule for preview and export (laneGain), plus the labelled output
  // gain when "Prevent clipping" is on. The original reference is exclusive.
  useEffect(() => {
    const audio = context.current;
    if (!audio || load.status !== 'ready') return;
    for (const [id, node] of laneNodes.current)
      node.gain.setTargetAtTime(
        listen === 'stems' ? laneGain(mix, id) : 0,
        audio.currentTime,
        0.012
      );
    bus.current?.gain.setTargetAtTime(outputGain, audio.currentTime, 0.012);
    originalNode.current?.gain.setTargetAtTime(
      listen === 'original' ? 1 : 0,
      audio.currentTime,
      0.012
    );
  }, [mix, listen, load.status, outputGain]);

  // Exact peak of the current settings, recomputed shortly after each change.
  useEffect(() => {
    if (load.status !== 'ready') return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const sources = Object.fromEntries(
        [...buffers.current].map(([id, buffer]) => [
          id,
          {
            sampleRate: buffer.sampleRate,
            channels: [buffer.getChannelData(0), buffer.getChannelData(1)],
          },
        ])
      );
      mixPeak(sources, mix, { signal: controller.signal })
        .then((value) => !controller.signal.aborted && setPeak(value))
        .catch(() => {});
    }, 220);
    setPeak(null);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mix, load.status]);

  const now = useCallback(() => {
    const audio = context.current;
    const { startedAt, offset, loopA, loopB } = clock.current;
    if (!audio || !startedAt) return offset;
    const elapsed = Math.max(0, audio.currentTime - startedAt);
    if (loopA !== undefined && loopB !== undefined) {
      const span = loopB - loopA;
      const into = offset + elapsed;
      return into < loopB ? into : loopA + ((into - loopA) % span);
    }
    return offset + elapsed;
  }, []);

  const stopSources = () => {
    sourcesPlaying.current.forEach((source) => {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    });
    sourcesPlaying.current = [];
    cancelAnimationFrame(frame.current);
  };

  const start = async (offsetInput, loopState = loop) => {
    const audio = context.current;
    if (!audio || load.status !== 'ready') return;
    await audio.resume();
    stopSources();
    const looping = loopState.a !== null && loopState.b !== null;
    let offset = Math.min(Math.max(0, offsetInput), duration);
    if (looping && (offset < loopState.a || offset >= loopState.b)) offset = loopState.a;
    if (!looping && offset >= duration - 0.01) offset = 0;
    const when = audio.currentTime + 0.05;
    const schedule = (buffer, node) => {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      if (looping) {
        source.loop = true;
        source.loopStart = loopState.a;
        source.loopEnd = Math.min(loopState.b, buffer.duration);
      }
      source.connect(node);
      if (offset < buffer.duration || looping)
        source.start(when, Math.min(offset, buffer.duration));
      sourcesPlaying.current.push(source);
    };
    for (const [id, buffer] of buffers.current) schedule(buffer, laneNodes.current.get(id));
    if (originalBuffer.current && originalNode.current)
      schedule(originalBuffer.current, originalNode.current);
    clock.current = looping
      ? { startedAt: when, offset, loopA: loopState.a, loopB: loopState.b }
      : { startedAt: when, offset };
    setPlaying(true);
    if (!previewCounted.current) {
      previewCounted.current = true;
      onEvent('preview');
    }
    const tick = () => {
      const at = now();
      if (!looping && at >= duration) {
        stopSources();
        clock.current = { startedAt: 0, offset: 0 };
        setPosition(0);
        setPlaying(false);
        return;
      }
      setPosition(Math.max(0, at));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    const at = now();
    stopSources();
    clock.current = { startedAt: 0, offset: at };
    setPosition(at);
    setPlaying(false);
  };

  const seek = (seconds) => {
    const target = Math.min(Math.max(0, seconds), duration);
    if (playing) void start(target);
    else {
      clock.current = { startedAt: 0, offset: target };
      setPosition(target);
    }
  };

  const changeLoop = (next) => {
    setLoop(next);
    if (playing) void start(now(), next);
  };
  const setLoopPoint = (point) => {
    const at = Math.round(now() * 100) / 100;
    if (point === 'a') {
      const b = loop.b !== null && loop.b - at >= MIN_LOOP ? loop.b : null;
      changeLoop({ a: at, b });
    } else {
      const a = loop.a ?? 0;
      if (at - a < MIN_LOOP) return;
      changeLoop({ a, b: at });
    }
  };

  const ensureOriginal = async () => {
    if (!original || originalBuffer.current || originalState === 'loading')
      return Boolean(originalBuffer.current);
    const audio = context.current;
    setOriginalState('loading');
    try {
      const buffer = await audio.decodeAudioData(await original.blob.arrayBuffer());
      const node = audio.createGain();
      node.gain.value = 0;
      node.connect(audio.destination);
      originalBuffer.current = buffer;
      originalNode.current = node;
      setOriginalState('ready');
      return true;
    } catch {
      setOriginalState('error');
      return false;
    }
  };

  const chooseListen = async (value) => {
    if (value === 'original' && !(await ensureOriginal())) return;
    setListen(value);
    // Restart so a newly decoded original joins the same clock.
    if (playing) void start(now());
  };

  const change = (id, patch) =>
    setMix((current) => ({
      ...current,
      lanes: { ...current.lanes, [id]: { ...current.lanes[id], ...patch } },
    }));

  const exportMix = async () => {
    if (exporting || load.status !== 'ready') return;
    const controller = new AbortController();
    exportAbort.current = controller;
    const snapshot = structuredClone(mix);
    const snapshotHeadroom = headroom;
    const snapshotFormat = format;
    const snapshotRange = range === 'loop' && loopActive ? { start: loop.a, end: loop.b } : null;
    setExportError('');
    setExported(null);
    setExporting({ progress: 0 });
    try {
      // Snapshot the sources too: references to the decoded PCM at this moment.
      const sources = Object.fromEntries(
        [...buffers.current].map(([id, buffer]) => [
          id,
          {
            sampleRate: buffer.sampleRate,
            channels: [buffer.getChannelData(0), buffer.getChannelData(1)],
          },
        ])
      );
      const compressed = snapshotFormat === 'aac';
      const render = await renderMix(
        snapshotRange ? sliceSources(sources, snapshotRange.start, snapshotRange.end) : sources,
        snapshot,
        {
          signal: controller.signal,
          headroom: snapshotHeadroom,
          onProgress: (progress) =>
            setExporting({ progress: compressed ? progress * 0.4 : progress }),
        }
      );
      controller.signal.throwIfAborted();
      const blob = compressed
        ? await encodeMixAac(render, {
            signal: controller.signal,
            onProgress: (progress) => setExporting({ progress: 0.4 + progress * 0.6 }),
          })
        : mixWavBlob(render, snapshotFormat);
      controller.signal.throwIfAborted();
      const name = mixFileName(fileBase, snapshot, {
        ext: MIX_FORMATS[snapshotFormat].ext,
        range: snapshotRange,
      });
      download(blob, name);
      const result = {
        blob,
        name,
        format: snapshotFormat,
        audible: render.audible,
        duration: render.frames / render.sampleRate,
        frames: render.frames,
        sampleRate: render.sampleRate,
        peakDb: render.peakDb,
        outputGainDb: render.outputGainDb,
        range: snapshotRange,
        clippedInFile: snapshotFormat !== 'float32' && render.overFrames > 0,
        overs: render.overFrames,
        preset: describeMix(snapshot).id,
      };
      setExported(result);
      onEvent('mix_exported', result);
    } catch (error) {
      if (!controller.signal.aborted)
        setExportError(
          error?.message || 'The mix could not be rendered. Download individual stems instead.'
        );
    } finally {
      if (exportAbort.current === controller) exportAbort.current = null;
      setExporting(null);
    }
  };

  const labelFor = (id) => stems.find((stem) => stem.id === id)?.label || id;
  const peakDb = peak === null ? null : gainToDb(peak * outputGain);
  const over = peak !== null && peak * outputGain > 1;
  const noneAudible = description.audible.length === 0;
  const progress = duration ? position / duration : 0;
  const soloId = description.id.startsWith('solo:') ? description.id.slice(5) : '';

  return (
    <section className="stem-player" aria-label={`Stem player for ${trackName}`}>
      <div className="stem-player-presets" role="group" aria-label="What do you want to hear?">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={description.id === preset.id}
            title={preset.detail}
            onClick={() => setMix((current) => applyPreset(current, preset.id))}
          >
            {preset.label}
          </button>
        ))}
        <label className="stem-player-solo">
          <span>Solo a part</span>
          <select
            value={soloId}
            onChange={(event) =>
              setMix((current) =>
                event.target.value
                  ? soloMix(current, event.target.value)
                  : applyPreset(current, 'all')
              )
            }
          >
            <option value="">Choose…</option>
            {stems.map((stem) => (
              <option key={stem.id} value={stem.id}>
                {stem.label}
              </option>
            ))}
          </select>
        </label>
        <span
          className={`stem-player-custom${description.id === 'custom' ? ' is-on' : ''}`}
          aria-live="off"
        >
          {description.id === 'custom' ? 'Custom mix' : ''}
        </span>
      </div>
      {ids.length < 4 && (
        <p className="stem-player-note">
          This result has {ids.length} of 4 parts. Separate all parts to build vocal, drum or bass
          practice tracks.
        </p>
      )}

      <div className="stem-player-transport">
        <button
          type="button"
          className="stem-player-play"
          disabled={load.status !== 'ready'}
          onClick={() => (playing ? pause() : void start(clock.current.offset))}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {load.status === 'loading' ? (
            <LoaderCircle className="stem-player-spin" size={20} aria-hidden="true" />
          ) : playing ? (
            <Pause size={20} aria-hidden="true" />
          ) : (
            <Play size={20} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="stem-player-icon"
          disabled={load.status !== 'ready'}
          onClick={() => seek(loopActive ? loop.a : 0)}
          aria-label={loopActive ? 'Back to loop start' : 'Back to start'}
          title={loopActive ? 'Back to loop start' : 'Back to start'}
        >
          <SkipBack size={16} aria-hidden="true" />
        </button>
        <div className="stem-player-scrub">
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.01"
            value={position}
            disabled={load.status !== 'ready'}
            aria-label="Playback position"
            aria-valuetext={`${formatClock(position)} of ${formatClock(duration)}`}
            onChange={(event) => seek(Number(event.target.value))}
          />
          {loopActive && duration > 0 && (
            <span
              className="stem-player-loop-band"
              aria-hidden="true"
              style={{
                left: `${(loop.a / duration) * 100}%`,
                width: `${((loop.b - loop.a) / duration) * 100}%`,
              }}
            />
          )}
        </div>
        <span className="stem-player-time" aria-live="off">
          {formatClock(position)} / {formatClock(duration)}
        </span>
      </div>

      <div className="stem-player-row">
        <div className="stem-player-listen" role="group" aria-label="Listen to">
          <button
            type="button"
            aria-pressed={listen === 'stems'}
            onClick={() => void chooseListen('stems')}
          >
            Stem mix
          </button>
          <button
            type="button"
            aria-pressed={listen === 'original'}
            disabled={!original || originalState === 'error' || load.status !== 'ready'}
            onClick={() => void chooseListen('original')}
            title="Hear the untouched source for comparison. It is never part of your mix."
          >
            {originalState === 'loading' ? 'Loading original…' : 'Original song'}
          </button>
        </div>
        <div className="stem-player-loop" role="group" aria-label="A–B loop">
          <Repeat size={15} aria-hidden="true" />
          <button
            type="button"
            disabled={load.status !== 'ready'}
            onClick={() => setLoopPoint('a')}
          >
            Set A{loop.a !== null ? ` · ${formatClock(loop.a)}` : ''}
          </button>
          <button
            type="button"
            disabled={load.status !== 'ready' || position - (loop.a ?? 0) < MIN_LOOP}
            onClick={() => setLoopPoint('b')}
          >
            Set B{loop.b !== null ? ` · ${formatClock(loop.b)}` : ''}
          </button>
          <button
            type="button"
            disabled={loop.a === null && loop.b === null}
            onClick={() => changeLoop({ a: null, b: null })}
          >
            Clear loop
          </button>
        </div>
      </div>
      {originalState === 'error' && (
        <p className="stem-player-note" role="alert">
          The original song could not be decoded for comparison. The stems are unaffected.
        </p>
      )}
      {listen === 'original' && (
        <p className="stem-player-note">
          You are hearing the original song. Mixer settings apply to the stem mix and your download.
        </p>
      )}
      {load.message && (
        <p
          className={load.status === 'error' ? 'stem-player-error' : 'stem-player-note'}
          role={load.status === 'error' ? 'alert' : 'status'}
        >
          {load.message}
        </p>
      )}

      <ul className="stem-player-lanes">
        {stems.map((stem) => {
          const lane = mix.lanes[stem.id];
          const audible = laneGain(mix, stem.id) > 0;
          return (
            <li
              key={stem.id}
              className={`stem-player-lane${audible ? '' : ' is-silent'}`}
              style={{ '--lane-color': stem.color }}
            >
              <span className="stem-player-lane-name">
                <strong>{stem.label}</strong>
                <small>
                  {audible ? formatDb(gainToDb(lane.gain)) : lane.muted ? 'Muted' : 'Not soloed'}
                </small>
              </span>
              <span className="stem-player-lane-buttons">
                <button
                  type="button"
                  aria-pressed={lane.muted}
                  onClick={() => change(stem.id, { muted: !lane.muted })}
                  aria-label={`Mute ${stem.label}`}
                  title={`Mute ${stem.label}`}
                >
                  <VolumeX size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-pressed={lane.solo}
                  onClick={() => change(stem.id, { solo: !lane.solo })}
                  aria-label={`Solo ${stem.label}`}
                  title={`Solo ${stem.label}`}
                >
                  <Headphones size={15} aria-hidden="true" />
                </button>
              </span>
              <StemWaveform
                peaks={stem.peaks}
                color={stem.color}
                progress={progress}
                loop={
                  loopActive && duration ? { a: loop.a / duration, b: loop.b / duration } : null
                }
                onSeek={load.status === 'ready' ? (fraction) => seek(fraction * duration) : null}
                label={`${stem.label} waveform`}
              />
              <input
                type="range"
                className="stem-player-gain"
                min="0"
                max={MAX_GAIN}
                step="0.01"
                value={lane.gain}
                aria-label={`${stem.label} level`}
                aria-valuetext={formatDb(gainToDb(lane.gain))}
                onChange={(event) => change(stem.id, { gain: Number(event.target.value) })}
              />
              <span className="stem-player-lane-actions">
                <a
                  className="stem-player-icon"
                  href={stem.url}
                  download={stem.name}
                  onClick={() => onEvent('stem_download')}
                  aria-label={`Download ${stem.label} WAV`}
                  title={`Download ${stem.label} WAV`}
                >
                  <Download size={16} aria-hidden="true" />
                </a>
                {stemActions?.(stem)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="stem-player-master">
        <label>
          <span>Master</span>
          <input
            type="range"
            min="0"
            max={MAX_MASTER}
            step="0.01"
            value={mix.master}
            aria-valuetext={formatDb(gainToDb(mix.master))}
            onChange={(event) =>
              setMix((current) => ({ ...current, master: Number(event.target.value) }))
            }
          />
          <output>{formatDb(gainToDb(mix.master))}</output>
        </label>
        <span
          className={`stem-player-peak${over ? ' is-over' : ''}`}
          role="status"
          aria-live="polite"
        >
          {noneAudible
            ? 'Nothing audible'
            : peakDb === null
              ? 'Measuring peak…'
              : `Mix peak ${formatDb(peakDb).replace(' dB', ' dBFS')}`}
          {over && (
            <>
              {' '}
              <AlertTriangle size={14} aria-hidden="true" /> above 0 dBFS
            </>
          )}
        </span>
        <label className="stem-player-check">
          <input
            type="checkbox"
            checked={headroom === 'prevent-clipping'}
            onChange={(event) => setHeadroom(event.target.checked ? 'prevent-clipping' : 'none')}
          />
          Prevent clipping (lower to −1 dBFS peak)
          {outputGain < 1 && <small> · output {formatDb(gainToDb(outputGain))}</small>}
        </label>
      </div>

      <div className="stem-player-export">
        <div>
          <h3>Download my mix</h3>
          <p>
            {noneAudible
              ? 'Unmute at least one part to render a mix.'
              : `Renders ${description.audible.map(labelFor).join(' + ')} exactly as set above, ${
                  range === 'loop' && loopActive
                    ? `${formatClock(loop.a)}–${formatClock(loop.b)} only`
                    : 'full length'
                }.`}
          </p>
        </div>
        <label className="stem-player-format">
          <span className="stem-player-visually-hidden">Length of the mix</span>
          <select
            value={range === 'loop' && loopActive ? 'loop' : 'full'}
            onChange={(event) => setRange(event.target.value)}
            disabled={Boolean(exporting)}
          >
            <option value="full">Whole song</option>
            <option value="loop" disabled={!loopActive}>
              {loopActive
                ? `A–B loop only (${formatClock(loop.a)}–${formatClock(loop.b)})`
                : 'A–B loop only (set A and B first)'}
            </option>
          </select>
        </label>
        <label className="stem-player-format">
          <span className="stem-player-visually-hidden">Mix file format</span>
          <select
            value={format}
            onChange={(event) => setFormat(event.target.value)}
            disabled={Boolean(exporting)}
          >
            {Object.entries(MIX_FORMATS).map(([value, option]) => (
              <option key={value} value={value} disabled={value === 'aac' && aac === false}>
                {value === 'aac' && aac === false
                  ? 'M4A · not supported by this browser'
                  : option.label}
              </option>
            ))}
          </select>
        </label>
        {exporting ? (
          <button
            type="button"
            className="stem-player-button"
            onClick={() => exportAbort.current?.abort()}
          >
            <Square size={14} aria-hidden="true" /> Cancel
          </button>
        ) : (
          <button
            type="button"
            className="stem-player-button is-primary"
            disabled={load.status !== 'ready' || noneAudible}
            onClick={() => void exportMix()}
          >
            <Download size={16} aria-hidden="true" /> Download my mix
          </button>
        )}
      </div>
      {format !== 'float32' && over && headroom === 'none' && (
        <p className="stem-player-note">
          This format cannot store peaks above 0 dBFS; they will be clipped. Use 32-bit float WAV or
          turn on Prevent clipping.
        </p>
      )}
      {format === 'aac' && (
        <p className="stem-player-note">
          M4A is much smaller but lossy, and adds a few milliseconds of encoder delay. Use WAV when
          you will line the mix up with other tracks.
        </p>
      )}
      {exporting && (
        <div className="stem-player-progress" role="status">
          <span>
            {format === 'aac' && exporting.progress >= 0.4 ? 'Encoding M4A…' : 'Rendering mix…'}{' '}
            {Math.round(exporting.progress * 100)}%
          </span>
          <progress max="1" value={exporting.progress} aria-label="Mix render progress" />
        </div>
      )}
      {exportError && (
        <p className="stem-player-error" role="alert">
          {exportError}
        </p>
      )}
      {exported && (
        <div className="stem-player-done" role="status">
          <p>
            <strong>{exported.name}</strong> downloaded ·{' '}
            {exported.audible.map(labelFor).join(' + ')} ·{' '}
            {exported.range
              ? `${formatClock(exported.range.start)}–${formatClock(exported.range.end)} loop`
              : formatClock(exported.duration)}{' '}
            · {MIX_FORMATS[exported.format].label} · peak{' '}
            {formatDb(exported.peakDb).replace(' dB', ' dBFS')}
            {exported.outputGainDb < 0 &&
              ` · lowered ${formatDb(exported.outputGainDb)} to prevent clipping`}
            {exported.clippedInFile && ' · some peaks were clipped at 0 dBFS'}
          </p>
          {afterExport?.(exported)}
        </div>
      )}
    </section>
  );
}
