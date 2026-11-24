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
import StemOverview from './StemOverview';
import StemWaveform from './StemWaveform';
import { aacSupported, encodeMixAac } from '../../utils/mixEncodeAac';
import {
  BEATS_PER_BAR,
  barLoop,
  beatPosition,
  clicksBetween,
  isDownbeat,
  rhythmSignal,
  snapToBeat,
} from '../../utils/stemBeatGrid';
import { pitchRatio, resample, stretchFactor } from '../../utils/timeStretch';
import {
  cleanPracticeState,
  cleanSectionName,
  MAX_SECTIONS,
  PRACTICE_VERSION,
  SECTION_NAME_MAX,
} from '../../utils/practiceState';
import './StemPlayer.css';

export const formatClock = (seconds) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
};
/** m:ss.t for the large transport readout. */
export const formatClockTenths = (seconds) => {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const tenths = Math.floor(safe * 10) / 10;
  return `${Math.floor(tenths / 60)}:${(tenths % 60).toFixed(1).padStart(4, '0')}`;
};
/** Meter height (0–1) for a linear peak: −60 dBFS at the bottom, 0 dBFS at the top. */
export const meterFraction = (peak) =>
  peak > 0 ? Math.min(1, Math.max(0, (20 * Math.log10(peak) + 60) / 60)) : 0;
const MASTER = '__master';
const MIN_LOOP = 0.25;
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 1.25;
export const SEMITONE_RANGE = 6;
// Speed and key changes duplicate every stem in memory; keep them to songs a
// typical laptop or phone can hold twice.
export const PRACTICE_MAX_SECONDS = 6 * 60;

// Vite bundles workers only from a literal `new Worker(new URL(...))`.
function stretchInWorker(stems, alpha) {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('This browser cannot change speed or key here.'));
      return;
    }
    const worker = new Worker(new URL('../../utils/timeStretch.worker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      worker.terminate();
      reject(new Error('Speed change ran out of memory. Try a shorter song.'));
    };
    worker.postMessage({ id: 1, stems, alpha });
  });
}

function trackBeatsInWorker(samples, rate) {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('unavailable'));
      return;
    }
    const worker = new Worker(new URL('../../utils/stemBeatGrid.worker.js', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data.grid);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      worker.terminate();
      reject(new Error('Beat tracking failed.'));
    };
    worker.postMessage({ id: 1, samples, rate }, [samples.buffer]);
  });
}

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
  // A short preview section while the whole song separates: listening and
  // mixing only, no downloads (they would not be the finished song).
  previewOnly = false,
  // A previously saved setup for this song (mix, speed, key, loops, beat
  // switches), and a callback that receives the current one after each change.
  initialPractice = null,
  onPracticeChange = null,
}) {
  const ids = useMemo(() => stems.map((stem) => stem.id), [stems]);
  const presets = useMemo(() => availablePresets(ids), [ids]);
  const [restored] = useState(() => cleanPracticeState(initialPractice, ids));
  const context = useRef(null);
  const buffers = useRef(new Map());
  const laneNodes = useRef(new Map());
  // Post-fader analysers for the level meters (absent where Web Audio lacks them).
  const analysers = useRef(new Map());
  const meterElements = useRef(new Map());
  const bus = useRef(null);
  const originalNode = useRef(null);
  const originalBuffer = useRef(null);
  const sourcesPlaying = useRef([]);
  const clock = useRef({ startedAt: 0, offset: 0 });
  const frame = useRef(0);
  const exportAbort = useRef(null);
  const previewCounted = useRef(false);
  // Practice playback: processed (stretched) buffers and the clicks in flight.
  const playBuffers = useRef(null); // Map id → AudioBuffer, or null for originals
  const originalPlayBuffer = useRef(null);
  const practice = useRef({ speed: 1, semitones: 0, alpha: 1, rate: 1 });
  const clickNodes = useRef([]);
  const clickState = useRef({ scheduledTo: -Infinity });
  const stretchJob = useRef(0);
  const [load, setLoad] = useState({
    status: 'loading',
    message: 'Preparing synchronized playback',
  });
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [listen, setListen] = useState('stems');
  const [originalState, setOriginalState] = useState(original ? 'idle' : 'missing');
  const [loop, setLoop] = useState(() => restored?.loop || { a: null, b: null });
  const [sections, setSections] = useState(() => restored?.sections || []);
  const [mix, setMix] = useState(() => {
    if (restored?.mix) return restored.mix;
    const base = createMix(ids);
    if (initialPreset?.startsWith('solo:') && ids.includes(initialPreset.slice(5)))
      return soloMix(base, initialPreset.slice(5));
    return presets.some((preset) => preset.id === initialPreset)
      ? applyPreset(base, initialPreset)
      : base;
  });
  const [peak, setPeak] = useState(null);
  const [headroom, setHeadroom] = useState(restored?.headroom || 'none');
  const [format, setFormat] = useState('float32');
  const [range, setRange] = useState('full');
  const [aac, setAac] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [exported, setExported] = useState(null);
  const [exportError, setExportError] = useState('');
  const [speed, setSpeed] = useState(restored?.speed ?? 1);
  const [semitones, setSemitones] = useState(restored?.semitones ?? 0);
  const [processing, setProcessing] = useState({ status: 'idle', message: '' });
  const [applyPractice, setApplyPractice] = useState(false);
  const [grid, setGrid] = useState({ status: 'idle', beats: [], bpm: null });
  const [barOffset, setBarOffset] = useState(restored?.barOffset ?? 0);
  const [snap, setSnap] = useState(restored?.snap ?? true);
  const [click, setClick] = useState(restored?.click ?? false);
  const [countIn, setCountIn] = useState(restored?.countIn ?? false);
  const clickOn = useRef(false);
  clickOn.current = click;
  const playingRef = useRef(false);
  playingRef.current = playing;
  const practiceActive = speed !== 1 || semitones !== 0;
  const practiceAllowed = duration <= PRACTICE_MAX_SECONDS;
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
    const taps = analysers.current;
    const tap = (node, id, target) => {
      const analyser = audio.createAnalyser?.();
      if (!analyser) {
        node.connect(target);
        return;
      }
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      node.connect(analyser);
      analyser.connect(target);
      taps.set(id, analyser);
    };
    tap(master, MASTER, audio.destination);
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
          tap(gain, stem.id, master);
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
      taps.clear();
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

  // Level meters: real post-fader peaks from the analysers, drawn straight to
  // the DOM each frame (no React renders), with a short visual fall-off.
  useEffect(() => {
    const elements = meterElements.current;
    const setLevel = (id, value) =>
      elements.get(id)?.style.setProperty('--level', value.toFixed(3));
    if (!playing) {
      for (const id of elements.keys()) setLevel(id, 0);
      return undefined;
    }
    const shown = new Map();
    const data = new Float32Array(1024);
    let handle = 0;
    const step = () => {
      for (const [id, analyser] of analysers.current) {
        analyser.getFloatTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const value = Math.abs(data[i]);
          if (value > peak) peak = value;
        }
        const level = Math.max(meterFraction(peak), (shown.get(id) || 0) - 0.025);
        shown.set(id, level);
        setLevel(id, level);
      }
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [playing]);

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

  // Beat grid from the rhythm stems (drums + bass), tracked off the UI thread.
  useEffect(() => {
    if (load.status !== 'ready') return undefined;
    let live = true;
    const ids = ['drums', 'bass'].filter((id) => buffers.current.has(id));
    const use = ids.length ? ids : [...buffers.current.keys()];
    if (!use.length) return undefined;
    const sets = use.map((id) => {
      const buffer = buffers.current.get(id);
      return [buffer.getChannelData(0), buffer.getChannelData(1)];
    });
    const { samples, rate } = rhythmSignal(sets, buffers.current.get(use[0]).sampleRate);
    setGrid({ status: 'working', beats: [], bpm: null });
    trackBeatsInWorker(samples, rate)
      .then((result) => {
        if (!live) return;
        setGrid(
          result.usable
            ? { status: 'ready', beats: result.beats, bpm: result.bpm }
            : { status: 'none', beats: [], bpm: null }
        );
      })
      .catch(() => live && setGrid({ status: 'none', beats: [], bpm: null }));
    return () => {
      live = false;
    };
  }, [load.status]);

  // Speed / key: stretch every stem coherently in a worker, then swap the
  // playback buffers on the same clock. Debounced so dragging stays smooth.
  useEffect(() => {
    if (load.status !== 'ready') return undefined;
    const job = ++stretchJob.current;
    const audio = context.current;
    if (!practiceActive) {
      const wasActive = Boolean(playBuffers.current);
      playBuffers.current = null;
      originalPlayBuffer.current = null;
      practice.current = { speed: 1, semitones: 0, alpha: 1, rate: 1 };
      setProcessing({ status: 'idle', message: '' });
      if (wasActive && playingRef.current) void start(now());
      return undefined;
    }
    if (!practiceAllowed) {
      setProcessing({
        status: 'error',
        message: `Speed and key changes are available for songs up to ${PRACTICE_MAX_SECONDS / 60} minutes.`,
      });
      return undefined;
    }
    setProcessing({ status: 'working', message: 'Preparing practice playback…' });
    const timer = setTimeout(async () => {
      const alpha = stretchFactor(speed, semitones);
      const rate = pitchRatio(semitones);
      setProcessing({ status: 'working', message: 'Preparing practice playback…' });
      try {
        const copy = (buffer) => [
          buffer.getChannelData(0).slice(),
          buffer.getChannelData(1).slice(),
        ];
        const stems = Object.fromEntries(
          [...buffers.current].map(([id, buffer]) => [id, copy(buffer)])
        );
        const result = await stretchInWorker(stems, alpha);
        // The original has its own sample rate, so it gets its own path.
        const originalResult = originalBuffer.current
          ? await stretchInWorker({ original: copy(originalBuffer.current) }, alpha)
          : null;
        if (job !== stretchJob.current || !audio) return;
        const toBuffer = ([left, right], sampleRate) => {
          const buffer = audio.createBuffer(2, Math.max(1, left.length), sampleRate);
          buffer.copyToChannel(left, 0);
          buffer.copyToChannel(right, 1);
          return buffer;
        };
        playBuffers.current = new Map(
          Object.entries(result).map(([id, channels]) => [
            id,
            toBuffer(channels, buffers.current.get(id).sampleRate),
          ])
        );
        originalPlayBuffer.current = originalResult
          ? toBuffer(originalResult.original, originalBuffer.current.sampleRate)
          : null;
        practice.current = { speed, semitones, alpha, rate };
        setProcessing({ status: 'ready', message: '' });
        if (playingRef.current) void start(now());
      } catch (error) {
        if (job === stretchJob.current)
          setProcessing({ status: 'error', message: error.message || 'Speed change failed.' });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [speed, semitones, load.status, originalState === 'ready']); // eslint-disable-line react-hooks/exhaustive-deps

  // Song-time position. One real second advances the song by `speed` seconds.
  const now = useCallback(() => {
    const audio = context.current;
    const { startedAt, offset, loopA, loopB, speed: rate = 1 } = clock.current;
    if (!audio || !startedAt) return offset;
    const elapsed = Math.max(0, audio.currentTime - startedAt) * rate;
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
    clickNodes.current.forEach((node) => {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    });
    clickNodes.current = [];
    cancelAnimationFrame(frame.current);
  };

  const playClick = (when, accent) => {
    const audio = context.current;
    if (!audio?.createOscillator) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(when);
    osc.stop(when + 0.06);
    clickNodes.current.push(osc);
    if (clickNodes.current.length > 64) clickNodes.current.splice(0, 32);
  };

  const start = async (offsetInput, loopState = loop, { withCountIn = false } = {}) => {
    const audio = context.current;
    if (!audio || load.status !== 'ready') return;
    await audio.resume();
    stopSources();
    const looping = loopState.a !== null && loopState.b !== null;
    let offset = Math.min(Math.max(0, offsetInput), duration);
    if (looping && (offset < loopState.a || offset >= loopState.b)) offset = loopState.a;
    if (!looping && offset >= duration - 0.01) offset = 0;
    // Processed buffers are stretched by alpha (= rate / speed) in buffer
    // time and played at `rate`, so the song advances at `speed`.
    const {
      speed: rateOfSong,
      alpha,
      rate,
    } = playBuffers.current ? practice.current : { speed: 1, alpha: 1, rate: 1 };
    const beat = grid.bpm ? 60 / grid.bpm / rateOfSong : 0;
    const lead = withCountIn && beat ? beat * BEATS_PER_BAR : 0;
    const begin = audio.currentTime + 0.05;
    const when = begin + lead;
    for (let i = 0; lead && i < BEATS_PER_BAR; i++) playClick(begin + i * beat, i === 0);
    const schedule = (buffer, node) => {
      const source = audio.createBufferSource();
      source.buffer = buffer;
      if (source.playbackRate) source.playbackRate.value = rate;
      if (looping) {
        source.loop = true;
        source.loopStart = loopState.a * alpha;
        source.loopEnd = Math.min(loopState.b * alpha, buffer.duration);
      }
      source.connect(node);
      if (offset * alpha < buffer.duration || looping)
        source.start(when, Math.min(offset * alpha, buffer.duration));
      sourcesPlaying.current.push(source);
    };
    const lanes = playBuffers.current || buffers.current;
    for (const [id, buffer] of lanes) schedule(buffer, laneNodes.current.get(id));
    const reference = playBuffers.current ? originalPlayBuffer.current : originalBuffer.current;
    if (reference && originalNode.current) schedule(reference, originalNode.current);
    clock.current = looping
      ? { startedAt: when, offset, loopA: loopState.a, loopB: loopState.b, speed: rateOfSong }
      : { startedAt: when, offset, speed: rateOfSong };
    clickState.current = { scheduledTo: -1e-6 };
    setPlaying(true);
    if (!previewCounted.current) {
      previewCounted.current = true;
      onEvent('preview');
    }
    const tick = () => {
      const at = now();
      // Schedule metronome clicks half a second ahead on the same clock.
      if (clickOn.current && grid.beats.length) {
        const elapsed = Math.max(0, audio.currentTime - when) * rateOfSong;
        const horizon = elapsed + 0.5 * rateOfSong;
        if (horizon > clickState.current.scheduledTo) {
          for (const tickInfo of clicksBetween(
            grid.beats,
            {
              offset,
              loopA: looping ? loopState.a : null,
              loopB: looping ? loopState.b : null,
              barOffset,
            },
            clickState.current.scheduledTo,
            horizon
          ))
            playClick(when + tickInfo.elapsed / rateOfSong, tickInfo.downbeat);
          clickState.current.scheduledTo = horizon;
        }
      }
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
  const gridReady = grid.status === 'ready';
  const setLoopPoint = (point) => {
    const raw = now();
    const at = Math.round((snap && gridReady ? snapToBeat(grid.beats, raw) : raw) * 1000) / 1000;
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

  // A restored loop or saved loop that does not fit this audio is dropped.
  useEffect(() => {
    if (!duration) return;
    const fits = (range) => range.a >= 0 && range.b <= duration + 0.01 && range.b > range.a;
    setLoop((current) =>
      current.a !== null && current.b !== null && !fits(current) ? { a: null, b: null } : current
    );
    setSections((current) => (current.every(fits) ? current : current.filter(fits)));
  }, [duration]);

  // Report the setup after each change so the page can save it with the song.
  const reported = useRef(false);
  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      return;
    }
    onPracticeChange?.({
      v: PRACTICE_VERSION,
      mix,
      speed,
      semitones,
      loop: loop.a !== null && loop.b !== null ? { a: loop.a, b: loop.b } : null,
      sections,
      click,
      countIn,
      snap,
      barOffset,
      headroom,
    });
  }, [mix, speed, semitones, loop, sections, click, countIn, snap, barOffset, headroom]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSection = () => {
    if (loop.a === null || loop.b === null || sections.length >= MAX_SECTIONS) return;
    if (sections.some((section) => section.a === loop.a && section.b === loop.b)) return;
    const used = new Set(sections.map((section) => section.name));
    let number = sections.length + 1;
    while (used.has(`Loop ${number}`)) number++;
    setSections([
      ...sections,
      {
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${sections.length}`,
        name: `Loop ${number}`,
        a: loop.a,
        b: loop.b,
      },
    ]);
  };
  const goSection = (section) => {
    const next = { a: section.a, b: section.b };
    setLoop(next);
    if (playing) void start(section.a, next);
    else {
      clock.current = { startedAt: 0, offset: section.a };
      setPosition(section.a);
    }
  };

  // Keyboard shortcuts for hands-on-instrument practice. One listener reads
  // the latest handlers from a ref; typing in a field is never intercepted.
  const keys = useRef({});
  keys.current = {
    toggle: () =>
      playing ? pause() : void start(clock.current.offset, loop, { withCountIn: countIn }),
    seekBy: (seconds) => seek(now() + seconds),
    setA: () => setLoopPoint('a'),
    setB: () => setLoopPoint('b'),
    clearLoop: () => changeLoop({ a: null, b: null }),
    go: (index) => sections[index] && goSection(sections[index]),
    restart: () => seek(loop.a !== null && loop.b !== null ? loop.a : 0),
    toggleClick: () => grid.status === 'ready' && setClick((value) => !value),
  };
  const shortcutsOn = !previewOnly && load.status === 'ready';
  useEffect(() => {
    if (!shortcutsOn) return undefined;
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target;
      if (
        target?.closest?.('input:not([type="range"]), textarea, select, [contenteditable="true"]')
      )
        return;
      const onControl = Boolean(target?.closest?.('button, a, summary, input'));
      const run = (action) => {
        event.preventDefault();
        action();
      };
      if (event.key === ' ' || event.code === 'Space') {
        if (!onControl) run(keys.current.toggle);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (!onControl) run(() => keys.current.seekBy(event.key === 'ArrowLeft' ? -5 : 5));
      } else if (event.key === '[') run(keys.current.setA);
      else if (event.key === ']') run(keys.current.setB);
      else if (event.key === '\\') run(keys.current.clearLoop);
      else if (event.key === '0' || event.key === 'Home') run(keys.current.restart);
      else if (event.key === 'c' || event.key === 'C') run(keys.current.toggleClick);
      else if (/^[1-9]$/.test(event.key)) run(() => keys.current.go(Number(event.key) - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsOn]);

  const exportMix = async () => {
    if (exporting || load.status !== 'ready') return;
    const controller = new AbortController();
    exportAbort.current = controller;
    const snapshot = structuredClone(mix);
    const snapshotHeadroom = headroom;
    const snapshotFormat = format;
    const snapshotRange = range === 'loop' && loopActive ? { start: loop.a, end: loop.b } : null;
    const snapshotPractice =
      applyPractice && playBuffers.current && practiceActive ? { ...practice.current } : null;
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
      let renderSources = sources;
      let renderRange = snapshotRange;
      if (snapshotPractice) {
        // Bake speed and key into the file: stretched stems resampled by the
        // pitch ratio, so the output timeline is song time / speed.
        renderSources = Object.fromEntries(
          [...playBuffers.current].map(([id, buffer]) => [
            id,
            {
              sampleRate: buffer.sampleRate,
              channels: [0, 1].map((c) =>
                resample(buffer.getChannelData(c), snapshotPractice.rate)
              ),
            },
          ])
        );
        if (snapshotRange)
          renderRange = {
            start: snapshotRange.start / snapshotPractice.speed,
            end: snapshotRange.end / snapshotPractice.speed,
          };
      }
      const render = await renderMix(
        renderRange
          ? sliceSources(renderSources, renderRange.start, renderRange.end)
          : renderSources,
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
      const practiceSuffix = snapshotPractice
        ? `${snapshotPractice.speed !== 1 ? `-${Math.round(snapshotPractice.speed * 100)}pct` : ''}${
            snapshotPractice.semitones
              ? `-${snapshotPractice.semitones > 0 ? 'up' : 'down'}${Math.abs(snapshotPractice.semitones)}st`
              : ''
          }`
        : '';
      const name = mixFileName(`${fileBase}${practiceSuffix}`, snapshot, {
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
        practice: snapshotPractice,
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

  const barMarkers = useMemo(
    () =>
      gridReady && duration
        ? grid.beats
            .filter((_, index) => isDownbeat(index, barOffset))
            .slice(0, 600)
            .map((time) => time / duration)
        : null,
    [gridReady, grid.beats, barOffset, duration]
  );
  const labelFor = (id) => stems.find((stem) => stem.id === id)?.label || id;
  const peakDb = peak === null ? null : gainToDb(peak * outputGain);
  const over = peak !== null && peak * outputGain > 1;
  const noneAudible = description.audible.length === 0;
  const progress = duration ? position / duration : 0;
  const soloId = description.id.startsWith('solo:') ? description.id.slice(5) : '';
  const loopFractions =
    loopActive && duration ? { a: loop.a / duration, b: loop.b / duration } : null;
  const overviewLanes = useMemo(
    () =>
      stems.map((stem) => ({
        id: stem.id,
        color: stem.color,
        peaks: stem.peaks,
        audible: listen === 'stems' && laneGain(mix, stem.id) > 0,
      })),
    [stems, mix, listen]
  );
  const where = gridReady ? beatPosition(grid.beats, position, barOffset) : null;
  const keyLabel =
    semitones === 0 ? 'original' : `${semitones > 0 ? '+' : '−'}${Math.abs(semitones)} st`;
  const ready = load.status === 'ready';
  const meterRef = (id) => (element) => {
    if (element) meterElements.current.set(id, element);
    else meterElements.current.delete(id);
  };

  return (
    <section className="stem-player" aria-label={`Stem player for ${trackName}`}>
      <div className="stem-player-top">
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
        </div>
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
            disabled={!original || originalState === 'error' || !ready}
            onClick={() => void chooseListen('original')}
            title="Hear the untouched source for comparison. It is never part of your mix."
          >
            {originalState === 'loading' ? 'Loading original…' : 'Original song'}
          </button>
        </div>
      </div>
      {ids.length < 4 && (
        <p className="stem-player-note">
          This result has {ids.length} of 4 parts. Separate all parts to build vocal, drum or bass
          practice tracks.
        </p>
      )}

      <div className="stem-player-overview">
        <StemOverview
          lanes={overviewLanes}
          progress={progress}
          loop={loopFractions}
          markers={barMarkers}
          onSeek={ready ? (fraction) => seek(fraction * duration) : null}
        />
        <div className="stem-player-scrub">
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.01"
            value={position}
            disabled={!ready}
            aria-label="Playback position"
            aria-valuetext={`${formatClock(position)} of ${formatClock(duration)}`}
            onChange={(event) => seek(Number(event.target.value))}
          />
        </div>
      </div>

      <div className="stem-player-transport">
        <button
          type="button"
          className="stem-player-icon"
          disabled={!ready}
          onClick={() => seek(loopActive ? loop.a : 0)}
          aria-label={loopActive ? 'Back to loop start' : 'Back to start'}
          title={loopActive ? 'Back to loop start' : 'Back to start'}
        >
          <SkipBack size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="stem-player-play"
          disabled={!ready}
          onClick={() =>
            playing ? pause() : void start(clock.current.offset, loop, { withCountIn: countIn })
          }
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {load.status === 'loading' ? (
            <LoaderCircle className="stem-player-spin" size={22} aria-hidden="true" />
          ) : playing ? (
            <Pause size={22} aria-hidden="true" />
          ) : (
            <Play size={22} aria-hidden="true" />
          )}
        </button>
        <span className="stem-player-time" aria-live="off">
          {formatClockTenths(position)} <small>/ {formatClock(duration)}</small>
        </span>
        <dl className="stem-player-readouts">
          <div>
            <dt>Bar</dt>
            <dd>{where ? `${where.bar}.${where.beat}` : '—'}</dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>{Math.round(speed * 100)}%</dd>
          </div>
          <div>
            <dt>Key</dt>
            <dd>{semitones === 0 ? '±0' : keyLabel}</dd>
          </div>
        </dl>
        <div className="stem-player-loop" role="group" aria-label="A–B loop">
          <Repeat size={15} aria-hidden="true" />
          <button type="button" disabled={!ready} onClick={() => setLoopPoint('a')}>
            Set A{loop.a !== null ? ` · ${formatClock(loop.a)}` : ''}
          </button>
          <button
            type="button"
            disabled={!ready || position - (loop.a ?? 0) < MIN_LOOP}
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

      <div className="stem-player-body">
        <div className="stem-player-mixer">
          <ul className="stem-player-lanes" aria-label="Mixer">
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
                      {audible
                        ? formatDb(gainToDb(lane.gain))
                        : lane.muted
                          ? 'Muted'
                          : 'Not soloed'}
                    </small>
                  </span>
                  <StemWaveform
                    peaks={stem.peaks}
                    color={stem.color}
                    progress={progress}
                    loop={loopFractions}
                    onSeek={ready ? (fraction) => seek(fraction * duration) : null}
                    markers={barMarkers}
                    height={52}
                  />
                  <span className="stem-player-fader-row">
                    <span className="stem-player-meter" ref={meterRef(stem.id)} aria-hidden="true">
                      <i />
                    </span>
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
                  </span>
                  <span className="stem-player-lane-buttons">
                    <button
                      type="button"
                      className="is-mute"
                      aria-pressed={lane.muted}
                      onClick={() => change(stem.id, { muted: !lane.muted })}
                      aria-label={`Mute ${stem.label}`}
                      title={`Mute ${stem.label}`}
                    >
                      <VolumeX size={14} aria-hidden="true" />
                      <span aria-hidden="true">M</span>
                    </button>
                    <button
                      type="button"
                      className="is-solo"
                      aria-pressed={lane.solo}
                      onClick={() => change(stem.id, { solo: !lane.solo })}
                      aria-label={`Solo ${stem.label}`}
                      title={`Solo ${stem.label}`}
                    >
                      <Headphones size={14} aria-hidden="true" />
                      <span aria-hidden="true">S</span>
                    </button>
                  </span>
                  <span className="stem-player-lane-actions" hidden={previewOnly}>
                    <a
                      className="stem-player-icon"
                      href={stem.url}
                      download={stem.name}
                      onClick={() => onEvent('stem_download')}
                      aria-label={`Download ${stem.label} WAV`}
                      title={`Download ${stem.label} WAV`}
                    >
                      <Download size={15} aria-hidden="true" />
                    </a>
                    {stemActions?.(stem)}
                  </span>
                </li>
              );
            })}
            <li className="stem-player-lane is-master">
              <span className="stem-player-lane-name">
                <strong>Master</strong>
                <small>{formatDb(gainToDb(mix.master))}</small>
              </span>
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
              <span className="stem-player-fader-row">
                <span className="stem-player-meter" ref={meterRef(MASTER)} aria-hidden="true">
                  <i />
                </span>
                <input
                  type="range"
                  className="stem-player-gain"
                  min="0"
                  max={MAX_MASTER}
                  step="0.01"
                  value={mix.master}
                  aria-label="Master"
                  aria-valuetext={formatDb(gainToDb(mix.master))}
                  onChange={(event) =>
                    setMix((current) => ({ ...current, master: Number(event.target.value) }))
                  }
                />
              </span>
              <label className="stem-player-check is-compact">
                <input
                  type="checkbox"
                  checked={headroom === 'prevent-clipping'}
                  onChange={(event) =>
                    setHeadroom(event.target.checked ? 'prevent-clipping' : 'none')
                  }
                />
                <span>
                  Prevent clipping (lower to −1 dBFS peak)
                  {outputGain < 1 && <small> · output {formatDb(gainToDb(outputGain))}</small>}
                </span>
              </label>
            </li>
          </ul>
        </div>

        <aside className="stem-player-rail">
          <div className="stem-player-card" role="group" aria-label="Practice tools">
            <h3>
              Practice
              <button
                type="button"
                className="stem-player-text"
                disabled={!practiceActive}
                onClick={() => {
                  setSpeed(1);
                  setSemitones(0);
                }}
              >
                Reset
              </button>
            </h3>
            <div className="stem-player-dials">
              <label className="stem-player-dial stem-player-speed">
                <span className="stem-player-label">Speed</span>
                <b aria-hidden="true">{Math.round(speed * 100)}%</b>
                <input
                  type="range"
                  min={SPEED_MIN}
                  max={SPEED_MAX}
                  step="0.05"
                  value={speed}
                  aria-label="Playback speed"
                  disabled={!ready || !practiceAllowed}
                  aria-valuetext={`${Math.round(speed * 100)} percent`}
                  onChange={(event) => setSpeed(Number(event.target.value))}
                />
                <span className="stem-player-ticks" aria-hidden="true">
                  <span>50</span>
                  <span>100</span>
                  <span>125</span>
                </span>
              </label>
              <div className="stem-player-dial stem-player-key" role="group" aria-label="Key">
                <span className="stem-player-label">Key</span>
                <b>
                  <output>{keyLabel}</output>
                </b>
                <span className="stem-player-steps">
                  <button
                    type="button"
                    aria-label="Transpose down a semitone"
                    disabled={!ready || !practiceAllowed || semitones <= -SEMITONE_RANGE}
                    onClick={() => setSemitones((value) => value - 1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label="Transpose up a semitone"
                    disabled={!ready || !practiceAllowed || semitones >= SEMITONE_RANGE}
                    onClick={() => setSemitones((value) => value + 1)}
                  >
                    +
                  </button>
                </span>
              </div>
            </div>
            <p className="stem-player-note" role="status" aria-live="polite">
              {processing.status === 'working' || processing.status === 'error'
                ? processing.message
                : practiceActive && processing.status === 'ready'
                  ? 'Practice playback · pitch kept when slowing, tempo kept when transposing'
                  : 'Slow down without changing pitch, or change key without changing speed.'}
            </p>
          </div>

          <div className="stem-player-card" role="group" aria-label="Beat tools">
            <h3>
              Beat and click
              <span className="stem-player-grid-status">
                {grid.status === 'working'
                  ? 'Finding the beat…'
                  : gridReady
                    ? `Beat grid · ${grid.bpm} BPM (estimated)`
                    : grid.status === 'none'
                      ? 'No steady beat found: loops and clicks work without a grid'
                      : ''}
              </span>
            </h3>
            <label className="stem-player-switch">
              <span>Click</span>
              <input
                type="checkbox"
                role="switch"
                checked={click}
                disabled={!gridReady}
                onChange={(event) => setClick(event.target.checked)}
                aria-label="Click"
              />
            </label>
            <label className="stem-player-switch">
              <span>Count-in (1 bar)</span>
              <input
                type="checkbox"
                role="switch"
                checked={countIn}
                disabled={!gridReady}
                onChange={(event) => setCountIn(event.target.checked)}
                aria-label="Count-in (1 bar)"
              />
            </label>
            <label className="stem-player-switch">
              <span>Snap A–B to beats</span>
              <input
                type="checkbox"
                role="switch"
                checked={snap}
                disabled={!gridReady}
                onChange={(event) => setSnap(event.target.checked)}
                aria-label="Snap A–B to beats"
              />
            </label>
            <span className="stem-player-label">Loop from the playhead</span>
            <span
              className="stem-player-bars"
              role="group"
              aria-label="Loop bars from the playhead"
            >
              {[1, 2, 4, 8].map((bars) => (
                <button
                  key={bars}
                  type="button"
                  disabled={!gridReady}
                  onClick={() => {
                    const next = barLoop(grid.beats, now(), bars, barOffset, duration);
                    if (next) changeLoop(next);
                  }}
                >
                  {bars} {bars === 1 ? 'bar' : 'bars'}
                </button>
              ))}
            </span>
            <span className="stem-player-barstart" role="group" aria-label="Bar start">
              <span>Bar 1 starts on beat {barOffset + 1}</span>
              <button
                type="button"
                disabled={!gridReady}
                aria-label="Move bar start one beat earlier"
                onClick={() => setBarOffset((value) => (value + BEATS_PER_BAR - 1) % BEATS_PER_BAR)}
              >
                ◀
              </button>
              <button
                type="button"
                disabled={!gridReady}
                aria-label="Move bar start one beat later"
                onClick={() => setBarOffset((value) => (value + 1) % BEATS_PER_BAR)}
              >
                ▶
              </button>
            </span>
          </div>

          <div
            className="stem-player-card"
            role="group"
            aria-label="Saved loops"
            hidden={previewOnly}
          >
            <h3>
              Saved loops
              <button
                type="button"
                className="stem-player-text"
                disabled={!loopActive || sections.length >= MAX_SECTIONS}
                onClick={saveSection}
              >
                Save this loop
              </button>
            </h3>
            {sections.length === 0 ? (
              <p className="stem-player-note">
                Set A and B, then save the loop to come back to it. Saved loops, your mix, speed and
                key are remembered for this song in this browser.
              </p>
            ) : (
              <ol className="stem-player-sections">
                {sections.map((section, index) => {
                  const current = loopActive && loop.a === section.a && loop.b === section.b;
                  return (
                    <li key={section.id} className={current ? 'is-current' : undefined}>
                      <button
                        type="button"
                        className="stem-player-section-go"
                        aria-pressed={current}
                        disabled={!ready}
                        aria-label={`Loop ${section.name}, ${formatClock(section.a)} to ${formatClock(section.b)}`}
                        title={index < 9 ? `Press ${index + 1}` : undefined}
                        onClick={() => goSection(section)}
                      >
                        {index < 9 ? index + 1 : '·'}
                      </button>
                      <input
                        value={section.name}
                        maxLength={SECTION_NAME_MAX}
                        aria-label={`Name of saved loop ${index + 1}`}
                        onChange={(event) =>
                          setSections((all) =>
                            all.map((item) =>
                              item.id === section.id ? { ...item, name: event.target.value } : item
                            )
                          )
                        }
                        onBlur={(event) =>
                          setSections((all) =>
                            all.map((item) =>
                              item.id === section.id
                                ? {
                                    ...item,
                                    name: cleanSectionName(event.target.value, `Loop ${index + 1}`),
                                  }
                                : item
                            )
                          )
                        }
                      />
                      <span className="stem-player-section-time">
                        {formatClock(section.a)}–{formatClock(section.b)}
                      </span>
                      <button
                        type="button"
                        className="stem-player-section-remove"
                        aria-label={`Remove saved loop ${section.name}`}
                        onClick={() =>
                          setSections((all) => all.filter((item) => item.id !== section.id))
                        }
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            <details className="stem-player-shortcuts">
              <summary>Keyboard shortcuts</summary>
              <dl>
                <div>
                  <dt>Space</dt>
                  <dd>Play or pause</dd>
                </div>
                <div>
                  <dt>← →</dt>
                  <dd>Back or forward 5 seconds</dd>
                </div>
                <div>
                  <dt>[ ]</dt>
                  <dd>Set loop start and end</dd>
                </div>
                <div>
                  <dt>{'\\'}</dt>
                  <dd>Clear the loop</dd>
                </div>
                <div>
                  <dt>1–9</dt>
                  <dd>Jump to a saved loop</dd>
                </div>
                <div>
                  <dt>0</dt>
                  <dd>Back to the start (or loop start)</dd>
                </div>
                <div>
                  <dt>C</dt>
                  <dd>Click on or off</dd>
                </div>
              </dl>
            </details>
          </div>

          <div className="stem-player-card stem-player-export" hidden={previewOnly}>
            <h3>Download my mix</h3>
            <p>
              {noneAudible
                ? 'Unmute at least one part to render a mix.'
                : `Renders ${description.audible.map(labelFor).join(' + ')} exactly as set, ${
                    range === 'loop' && loopActive
                      ? `${formatClock(loop.a)}–${formatClock(loop.b)} only`
                      : 'full length'
                  }.`}
            </p>
            <label className="stem-player-format">
              <span className="stem-player-label">Length</span>
              <select
                aria-label="Length of the mix"
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
              <span className="stem-player-label">Format</span>
              <select
                aria-label="Mix file format"
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
            {practiceActive && (
              <label className="stem-player-check">
                <input
                  type="checkbox"
                  checked={applyPractice}
                  disabled={processing.status !== 'ready' || Boolean(exporting)}
                  onChange={(event) => setApplyPractice(event.target.checked)}
                />
                <span>
                  Use my speed ({Math.round(speed * 100)}%) and key ({keyLabel}) in the download
                </span>
              </label>
            )}
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
                disabled={!ready || noneAudible}
                onClick={() => void exportMix()}
              >
                <Download size={16} aria-hidden="true" /> Download my mix
              </button>
            )}
            {format !== 'float32' && over && headroom === 'none' && (
              <p className="stem-player-note">
                This format cannot store peaks above 0 dBFS; they will be clipped. Use 32-bit float
                WAV or turn on Prevent clipping.
              </p>
            )}
            {format === 'aac' && (
              <p className="stem-player-note">
                M4A is much smaller but lossy, and adds a few milliseconds of encoder delay. Use WAV
                when you will line the mix up with other tracks.
              </p>
            )}
            {exporting && (
              <div className="stem-player-progress" role="status">
                <span>
                  {format === 'aac' && exporting.progress >= 0.4
                    ? 'Encoding M4A…'
                    : 'Rendering mix…'}{' '}
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
                  {exported.practice &&
                    ` · ${Math.round(exported.practice.speed * 100)}% speed${
                      exported.practice.semitones
                        ? `, ${exported.practice.semitones > 0 ? '+' : '−'}${Math.abs(exported.practice.semitones)} semitones`
                        : ''
                    }`}
                  {exported.outputGainDb < 0 &&
                    ` · lowered ${formatDb(exported.outputGainDb)} to prevent clipping`}
                  {exported.clippedInFile && ' · some peaks were clipped at 0 dBFS'}
                </p>
                {afterExport?.(exported)}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
