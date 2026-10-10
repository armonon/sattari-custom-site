import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Download,
  Eraser,
  FileArchive,
  FileMusic,
  Play,
  Save,
  Send,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import LabShell from '../LabShell';
import { downloadBlob, safeFileName } from '../files';
import { wavBytes, zipFiles } from '../../utils/arrangementExport';
import {
  ALL_TRACKS,
  BASS_ROWS,
  BASS_TRACK,
  bassRowLabels,
  deleteSaved,
  DRUM_TRACKS,
  emptyPattern,
  KEYS,
  LIMITS,
  listSaved,
  normalizePattern,
  readDraft,
  saveDraft,
  savePattern,
  SCALES,
  starterPattern,
  storageBackup,
  stepDuration,
  STEPS,
  stepTime,
} from './pocketPattern';
import { renderLoop, scheduleStep } from './pocketSynth';

const LOOKAHEAD_SECONDS = 0.12;

const LIMITATIONS = [
  'One 16-step bar per pattern, one bass voice and six drum sounds. No song mode or chaining yet.',
  'Sounds are simple Web Audio synthesis, not sampled kits; they are meant for sketching, not final mixes.',
  'Patterns are saved in this browser only (localStorage). Clearing site data deletes them.',
  'Send to StemDeck adds the WAVs to the StemDeck Library in this browser. Drag them onto decks or the arranger from there; it does not build a StemDeck project for you.',
  'Phones may need the silent switch off to hear Web Audio, and timing can drift if the tab goes to the background.',
];

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export default function PocketPage() {
  const [pattern, setPattern] = useState(starterPattern);
  const [saved, setSaved] = useState([]);
  const [libraryError, setLibraryError] = useState('');
  const [draftError, setDraftError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const [page, setPage] = useState(0);
  const [bars, setBars] = useState(2);
  const [busy, setBusy] = useState('');
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState({ text: 'Tap steps to build a beat, then press play.' });

  const patternRef = useRef(pattern);
  const engine = useRef(null);

  useEffect(() => {
    patternRef.current = pattern;
    const gains = engine.current?.gains;
    if (gains) {
      for (const { id } of ALL_TRACKS) {
        gains[id].gain.value = pattern.muted[id] ? 0 : pattern.volume[id];
      }
    }
  }, [pattern]);

  // Restore after mount (not during render) so the prerendered page hydrates.
  useEffect(() => {
    const store = storage();
    try {
      setSaved(listSaved(store));
    } catch (error) {
      setLibraryError(error.message);
    }
    try {
      const draft = readDraft(store);
      if (draft) setPattern(draft);
    } catch (error) {
      setDraftError(error.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        saveDraft(storage(), pattern);
        setDraftError('');
      } catch (error) {
        setDraftError(`Draft not saved: ${error.message} Keep this tab open or export your audio.`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pattern]);

  const update = (change) => {
    setSent(false);
    setPattern((current) => ({ ...current, ...change(current) }));
  };

  const toggleDrum = (id, step) =>
    update((current) => ({
      drums: {
        ...current.drums,
        [id]: current.drums[id].map((on, i) => (i === step ? !on : on)),
      },
    }));

  const toggleBass = (row, step) =>
    update((current) => ({
      bass: current.bass.map((value, i) => (i === step ? (value === row ? null : row) : value)),
    }));

  const setTrackValue = (field, id, value) =>
    update((current) => ({ [field]: { ...current[field], [id]: value } }));

  const stop = useCallback(() => {
    const current = engine.current;
    if (!current?.running) return;
    clearInterval(current.timer);
    cancelAnimationFrame(current.frame);
    current.master.gain.setTargetAtTime(0, current.context.currentTime, 0.01);
    const old = current.master;
    setTimeout(() => old.disconnect(), 200);
    current.context.suspend?.();
    engine.current = { ...current, master: null, timer: 0, frame: 0, running: false };
    setPlaying(false);
    setPlayhead(-1);
  }, []);

  const start = async () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) {
      setStatus({ text: 'This browser does not support Web Audio.', error: true });
      return;
    }
    const context = engine.current?.context || new Context({ latencyHint: 'interactive' });
    await context.resume();
    const master = context.createGain();
    master.gain.value = 0.85;
    master.connect(context.destination);
    const gains = Object.fromEntries(
      ALL_TRACKS.map(({ id }) => {
        const gain = context.createGain();
        const p = patternRef.current;
        gain.gain.value = p.muted[id] ? 0 : p.volume[id];
        gain.connect(master);
        return [id, gain];
      })
    );
    const state = {
      context,
      master,
      gains,
      running: true,
      step: 0,
      stepStart: context.currentTime + 0.06,
      queue: [],
      timer: 0,
      frame: 0,
    };
    const schedule = () => {
      const p = patternRef.current;
      while (state.stepStart < context.currentTime + LOOKAHEAD_SECONDS) {
        const swingOffset = stepTime(state.step, p.bpm, p.swing) - state.step * stepDuration(p.bpm);
        const time = state.stepStart + swingOffset;
        scheduleStep(context, gains, p, state.step, time);
        state.queue.push({ step: state.step, time });
        state.stepStart += stepDuration(p.bpm);
        state.step = (state.step + 1) % STEPS;
      }
    };
    const draw = () => {
      let current = -1;
      while (state.queue.length && state.queue[0].time <= context.currentTime) {
        current = state.queue.shift().step;
      }
      if (current >= 0) setPlayhead(current);
      state.frame = requestAnimationFrame(draw);
    };
    schedule();
    state.timer = setInterval(schedule, 25);
    state.frame = requestAnimationFrame(draw);
    engine.current = state;
    setPlaying(true);
  };

  useEffect(
    () => () => {
      stop();
      engine.current?.context?.close?.();
    },
    [stop]
  );

  const render = async (label) => {
    setBusy(label);
    setStatus({ text: 'Rendering…' });
    try {
      return await renderLoop(patternRef.current, { bars });
    } finally {
      setBusy('');
    }
  };

  const fileBase = safeFileName(pattern.name, 'pocket');
  const stemName = (stem) => `${fileBase}-${stem.id}-${pattern.bpm}bpm.wav`;

  const exportWav = async () => {
    try {
      const result = await render('wav');
      downloadBlob(
        new Blob([wavBytes(result.mix)], { type: 'audio/wav' }),
        `${fileBase}-${pattern.bpm}bpm-${bars}bar.wav`
      );
      setStatus({ text: `Saved a ${result.seconds.toFixed(2)} s loop (24-bit WAV).` });
    } catch (error) {
      setStatus({ text: error.message, error: true });
    }
  };

  const exportStems = async () => {
    try {
      const result = await render('stems');
      const files = result.stems.map((stem) => ({
        name: stemName(stem),
        data: wavBytes(stem.buffer),
      }));
      files.push({ name: `${fileBase}-mix-${pattern.bpm}bpm.wav`, data: wavBytes(result.mix) });
      downloadBlob(zipFiles(files), `${fileBase}-stems.zip`);
      setStatus({ text: `Saved ${result.stems.length} stems and the mix in one ZIP.` });
    } catch (error) {
      setStatus({ text: error.message, error: true });
    }
  };

  const exportAbleton = async () => {
    try {
      const result = await render('ableton');
      const { exportForAbleton, warpModeFor } = await import('../../utils/abletonExport');
      const colors = Object.fromEntries(ALL_TRACKS.map((track) => [track.id, track.color]));
      const pack = await exportForAbleton({
        title: pattern.name || 'Pocket',
        bpm: pattern.bpm,
        source: { app: 'Pocket' },
        stems: [
          ...result.stems.map((stem) => ({
            name: stem.label,
            color: colors[stem.id],
            warpMode: warpModeFor(stem.id === 'bass' ? 'bass' : 'drums'),
            buffer: stem.buffer,
          })),
          { name: 'Pocket mix', buffer: result.mix, muted: true, warpMode: warpModeFor('drums') },
        ],
        notes: [
          `${bars} bar${bars > 1 ? 's' : ''} at ${pattern.bpm} BPM${pattern.swing ? `, ${Math.round(pattern.swing * 100)}% swing (baked into the audio)` : ''}. Loop the clips in Live to repeat the pattern.`,
        ],
      });
      downloadBlob(pack.blob, pack.fileName);
      setStatus({ text: `Saved ${pack.fileName}: ${result.stems.length} stems and a Live Set.` });
    } catch (error) {
      setStatus({ text: `Ableton export failed: ${error.message}`, error: true });
    }
  };

  const sendToStemDeck = async () => {
    try {
      const result = await render('send');
      const { importLibraryTrack } = await import('../../utils/musicLibrary');
      const folder = `Pocket/${pattern.name || 'Untitled'}`;
      for (const stem of [...result.stems, { id: 'mix', buffer: result.mix }]) {
        const name = stemName(stem);
        const file = new File([wavBytes(stem.buffer)], name, {
          type: 'audio/wav',
          lastModified: Date.now(),
        });
        await importLibraryTrack(file, `${folder}/${name}`);
      }
      setSent(true);
      setStatus({
        text: `Added ${result.stems.length + 1} files to the StemDeck Library under “${folder}”.`,
      });
    } catch (error) {
      setStatus({ text: `Could not add to StemDeck: ${error.message}`, error: true });
    }
  };

  const save = () => {
    const store = storage();
    if (!store) {
      setStatus({
        text: 'This browser blocks local storage, so patterns cannot be saved.',
        error: true,
      });
      return;
    }
    try {
      setSaved(savePattern(store, pattern));
      setLibraryError('');
      setStatus({ text: `Saved “${pattern.name}” in this browser.` });
    } catch (error) {
      setLibraryError(error.message);
      setStatus({ text: `Could not save: ${error.message}`, error: true });
    }
  };

  const removeSaved = (name) => {
    try {
      setSaved(deleteSaved(storage(), name));
      setLibraryError('');
      setStatus({ text: `Deleted saved pattern “${name}”. The current pattern is unchanged.` });
    } catch (error) {
      setLibraryError(error.message);
      setStatus({ text: `Could not delete: ${error.message}`, error: true });
    }
  };

  const backupStorage = () => {
    try {
      const backup = storageBackup(storage());
      downloadBlob(
        new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
        'pocket-storage-backup.json'
      );
      setStatus({
        text: 'Recovery backup download requested. It keeps the original stored text; it is not an editable-pattern import file.',
      });
    } catch (error) {
      setStatus({ text: `Could not read recovery backup: ${error.message}`, error: true });
    }
  };

  const labels = bassRowLabels(pattern.key, pattern.scale);
  const stepClass = (step) =>
    [
      'pocket-step',
      step % 4 === 0 ? 'is-beat' : '',
      step === playhead ? 'is-playhead' : '',
      Math.floor(step / 8) !== page ? 'is-off-page' : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <LabShell
      lab="pocket"
      name="Pocket"
      tagline="A beat sketchpad for your phone. Tap a groove, add a bass line, export the loop or its stems."
      limitations={LIMITATIONS}
    >
      <div className="lab-panel">
        <div className="pocket-transport">
          <button
            type="button"
            className="pocket-play"
            aria-label={playing ? 'Stop' : 'Play'}
            onClick={() => (playing ? stop() : start())}
          >
            {playing ? (
              <Square size={20} aria-hidden="true" />
            ) : (
              <Play size={22} aria-hidden="true" />
            )}
          </button>
          <label className="lab-field">
            <span>
              Tempo <output>{pattern.bpm} BPM</output>
            </span>
            <input
              type="range"
              min={LIMITS.bpm[0]}
              max={LIMITS.bpm[1]}
              value={pattern.bpm}
              onChange={(event) => update(() => ({ bpm: Number(event.target.value) }))}
            />
          </label>
          <label className="lab-field">
            <span>
              Swing <output>{Math.round(pattern.swing * 100)}%</output>
            </span>
            <input
              type="range"
              min={LIMITS.swing[0]}
              max={LIMITS.swing[1]}
              step="0.01"
              value={pattern.swing}
              onChange={(event) => update(() => ({ swing: Number(event.target.value) }))}
            />
          </label>
          <label className="lab-field">
            <span>Key</span>
            <select
              value={pattern.key}
              onChange={(event) => update(() => ({ key: Number(event.target.value) }))}
            >
              {KEYS.map((key, index) => (
                <option key={key} value={index}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="lab-field">
            <span>Scale</span>
            <select
              value={pattern.scale}
              onChange={(event) => update(() => ({ scale: event.target.value }))}
            >
              {Object.entries(SCALES).map(([id, scale]) => (
                <option key={id} value={id}>
                  {scale.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="lab-segment pocket-pages" role="group" aria-label="Steps shown">
          {['1–8', '9–16'].map((label, index) => (
            <button
              key={label}
              type="button"
              aria-pressed={page === index}
              onClick={() => setPage(index)}
            >
              Steps {label}
            </button>
          ))}
        </div>

        <div className="pocket-grid" role="group" aria-label="Drums">
          {DRUM_TRACKS.map((track) => (
            <div key={track.id} className="pocket-track" style={{ '--track-color': track.color }}>
              <div className="pocket-track-head">
                <button
                  type="button"
                  className="pocket-mute"
                  aria-pressed={pattern.muted[track.id]}
                  aria-label={`Mute ${track.label}`}
                  onClick={() => setTrackValue('muted', track.id, !pattern.muted[track.id])}
                >
                  M
                </button>
                <span>{track.label}</span>
              </div>
              <div className="pocket-steps">
                {pattern.drums[track.id].map((on, step) => (
                  <button
                    key={step}
                    type="button"
                    className={stepClass(step)}
                    aria-pressed={on}
                    aria-label={`${track.label} step ${step + 1}`}
                    onClick={() => toggleDrum(track.id, step)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pocket-grid" role="group" aria-label="Bass line">
          <div className="pocket-track" style={{ '--track-color': BASS_TRACK.color }}>
            <div className="pocket-track-head">
              <button
                type="button"
                className="pocket-mute"
                aria-pressed={pattern.muted.bass}
                aria-label="Mute Bass"
                onClick={() => setTrackValue('muted', 'bass', !pattern.muted.bass)}
              >
                M
              </button>
              <span>Bass</span>
            </div>
            <label className="lab-field">
              <span>
                Tone <output>{Math.round(pattern.cutoff)} Hz</output>
              </span>
              <input
                type="range"
                min={LIMITS.cutoff[0]}
                max={LIMITS.cutoff[1]}
                step="10"
                value={pattern.cutoff}
                onChange={(event) => update(() => ({ cutoff: Number(event.target.value) }))}
              />
            </label>
          </div>
          {Array.from({ length: BASS_ROWS }, (_, index) => BASS_ROWS - 1 - index).map((row) => (
            <div
              key={row}
              className="pocket-track pocket-bass-row"
              style={{ '--track-color': BASS_TRACK.color }}
            >
              <div className="pocket-track-head">{labels[row]}</div>
              <div className="pocket-steps">
                {pattern.bass.map((value, step) => (
                  <button
                    key={step}
                    type="button"
                    className={stepClass(step)}
                    aria-pressed={value === row}
                    aria-label={`Bass ${labels[row]} step ${step + 1}`}
                    onClick={() => toggleBass(row, step)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lab-workspace">
        <div className="lab-panel">
          <h2>Pattern</h2>
          {libraryError && (
            <p className="lab-status is-error" role="alert">
              {libraryError}
            </p>
          )}
          {draftError && (
            <p className="lab-status is-error" role="alert">
              {draftError}
            </p>
          )}
          {(libraryError || draftError) && (
            <button type="button" className="lab-button" onClick={backupStorage}>
              <Download size={16} aria-hidden="true" /> Download stored-data recovery backup
            </button>
          )}
          <p>
            Save updates the same name. New names use one of 40 slots; older patterns are never
            removed automatically.
          </p>
          <label className="lab-field">
            <span>Name</span>
            <input
              type="text"
              value={pattern.name}
              maxLength={60}
              onChange={(event) => update(() => ({ name: event.target.value }))}
            />
          </label>
          <div className="lab-row">
            <button type="button" className="lab-button" onClick={save}>
              <Save size={16} aria-hidden="true" /> Save
            </button>
            <button
              type="button"
              className="lab-button"
              onClick={() => update(() => ({ ...emptyPattern(pattern.name), bpm: pattern.bpm }))}
            >
              <Eraser size={16} aria-hidden="true" /> Clear
            </button>
            <button
              type="button"
              className="lab-button"
              onClick={() => update(() => starterPattern())}
            >
              <Sparkles size={16} aria-hidden="true" /> Starter
            </button>
          </div>
          {saved.length > 0 && (
            <ul className="pocket-saved" aria-label="Saved patterns">
              {saved.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    className="lab-button"
                    onClick={() => {
                      setSent(false);
                      setPattern(normalizePattern(item));
                    }}
                  >
                    {item.name} · {item.bpm}
                  </button>
                  <button
                    type="button"
                    className="press-remove"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => removeSaved(item.name)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2>Export</h2>
          <div className="lab-field">
            <span>Loop length</span>
            <div className="lab-segment" role="group" aria-label="Loop length">
              {[1, 2, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={bars === value}
                  onClick={() => setBars(value)}
                >
                  {value} bar{value > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="lab-row">
            <button
              type="button"
              className="lab-button is-primary"
              disabled={Boolean(busy)}
              onClick={exportWav}
            >
              <Download size={16} aria-hidden="true" /> WAV loop
            </button>
            <button
              type="button"
              className="lab-button"
              disabled={Boolean(busy)}
              onClick={exportStems}
            >
              <FileArchive size={16} aria-hidden="true" /> Stems (ZIP)
            </button>
            <button
              type="button"
              className="lab-button"
              disabled={Boolean(busy)}
              onClick={exportAbleton}
              title="Stems as WAV plus an Ableton Live Set with one track per sound, at this tempo"
            >
              <FileMusic size={16} aria-hidden="true" /> Export for Ableton
            </button>
            <button
              type="button"
              className="lab-button"
              disabled={Boolean(busy)}
              onClick={sendToStemDeck}
            >
              <Send size={16} aria-hidden="true" /> Send to StemDeck
            </button>
          </div>
          {sent && (
            <Link to="/studio" className="lab-button">
              Open StemDeck Library <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
          <p className={`lab-status${status.error ? ' is-error' : ''}`} role="status">
            {status.text}
          </p>
        </div>
        <div className="lab-panel">
          <h2>Mixer</h2>
          {ALL_TRACKS.map((track) => (
            <label key={track.id} className="lab-field">
              <span>
                {track.label} <output>{Math.round(pattern.volume[track.id] * 100)}%</output>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={pattern.volume[track.id]}
                onChange={(event) => setTrackValue('volume', track.id, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
      </div>
    </LabShell>
  );
}
