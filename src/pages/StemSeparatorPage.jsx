import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  Check,
  Download,
  Drum,
  FileAudio,
  Gauge,
  Guitar,
  HardDrive,
  Layers,
  LoaderCircle,
  Mic2,
  Music2,
  Plus,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SEO, StructuredData } from '../utils/seo';
import { PAGE_SEO, musicToolSchema } from '../data/siteSeo';
import { separatorGuides } from '../data/stemSeparatorContent';
import useStemSeparator from '../hooks/useStemSeparator';
import ToolReferenceLink from '../components/ToolReferenceLink';
import SeparatorNavigationGuard, {
  LEAVE_WHILE_PROCESSING,
} from '../components/SeparatorNavigationGuard';
import StemAnalysisSummary from '../components/StemAnalysisSummary';
import StemPlayer from '../components/stems/StemPlayer';
import HandoffNotice from '../components/stems/HandoffNotice';
import ToolFeedback from '../components/stems/ToolFeedback';
import { trackSiteEvent, trackSiteEventOnce } from '../utils/siteMeasurement';
import { AUDIO_ACCEPT, formatDuration, safeTrackName, STEMS } from '../utils/stemSeparator';
import { createStemArchive } from '../utils/stemSeparatorDownload';
import { stemAnalysisReport } from '../utils/stemAnalysisReport';
import { offerToolHandoff, takeToolHandoff } from '../utils/toolHandoff';
import { offerStemHandoff } from '../studio/stemHandoff';
import { SEPARATOR_GOALS, goalStems, stemLabel } from './stemSeparatorGoals';
import './StemSeparatorPage.css';

const icons = { vocals: Mic2, drums: Drum, bass: Guitar, other: Music2 };

function Waveform({ peaks, color = '#8b939b' }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !peaks?.length) return undefined;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * scale);
      canvas.height = 40 * scale;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(scale, scale);
      context.fillStyle = color;
      let max = 0.01;
      for (const peak of peaks) if (peak > max) max = peak;
      const step = rect.width / peaks.length;
      peaks.forEach((peak, index) => {
        const height = Math.max(1, (peak / max) * 34);
        context.fillRect(index * step, (40 - height) / 2, Math.max(1, step - 1), height);
      });
    };
    draw();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks, color]);
  return <canvas ref={ref} className="separator-waveform" aria-hidden="true" />;
}

function ProcessingProgress({ job }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - job.startedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [job.startedAt]);
  return (
    <div className="separator-track-progress" role="status">
      <div>
        <span>{job.message}</span>
        {job.progress !== null && <span>{Math.round(job.progress * 100)}%</span>}
      </div>
      <progress
        max="1"
        value={job.progress === null ? undefined : job.progress}
        aria-label={`${job.file.name} progress`}
      />
      <small aria-live="off">
        Elapsed {formatDuration(elapsed)}
        {job.progress === null ? ' · this step has no measurable progress' : ''}
      </small>
    </div>
  );
}

function download(blob, name, links) {
  const url = URL.createObjectURL(blob);
  links.add(url);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    links.delete(url);
  }, 60000);
}

export default function StemSeparatorPage() {
  const separator = useStemSeparator();
  const {
    jobs,
    selected,
    setSelected,
    running,
    errors,
    cpuOnly,
    setCpuOnly,
    loadingDemo,
    loadDemo,
    addFiles,
    remove,
    clearFinished,
    clearSaved,
    run,
    cancel,
    storageWarning,
    goal,
    setGoal,
  } = separator;
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [packing, setPacking] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [focusId, setFocusId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearNote, setClearNote] = useState('');
  const [received, setReceived] = useState(null);
  const picker = useRef(null);
  const archive = useRef(null);
  const links = useRef(new Set());
  const handoff = useRef(undefined);
  const ready = jobs.filter((job) => job.status === 'done');
  const pending = jobs.filter((job) => job.status !== 'done');
  const locked = running || loadingDemo || packing;
  const focused = ready.find((job) => job.id === focusId) || ready[ready.length - 1] || null;

  // Consume a same-tab transfer from Key & BPM once (refs survive StrictMode).
  useEffect(() => {
    if (handoff.current === undefined) handoff.current = takeToolHandoff('separator');
    const offer = handoff.current;
    if (!offer || offer.consumed) return;
    offer.consumed = true;
    const added = addFiles([offer.file], {
      from: offer.from,
      kind: offer.kind,
      label: offer.label,
      user: offer.user,
    });
    setReceived({ ...offer, added: added.length > 0 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      archive.current?.abort();
      links.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  const chooseGoal = (value) => {
    setGoal(value);
    const stems = goalStems(value);
    if (stems) setSelected(stems);
  };

  const downloadReport = (job) => {
    download(
      new Blob([JSON.stringify(stemAnalysisReport(job), null, 2)], { type: 'application/json' }),
      `${safeTrackName(job.file.name)}-analysis.json`,
      links.current
    );
    trackSiteEvent('separator_report_exported');
  };

  const downloadZip = async (rows) => {
    if (locked) return;
    const controller = new AbortController();
    archive.current = controller;
    setPacking(true);
    setDownloadError('');
    try {
      const blob = await createStemArchive(rows, controller.signal);
      controller.signal.throwIfAborted();
      download(
        blob,
        rows.length === 1 ? `${safeTrackName(rows[0].file.name)}-stems.zip` : 'sattari-stems.zip',
        links.current
      );
      trackSiteEvent('stem_download');
    } catch (error) {
      if (!controller.signal.aborted)
        setDownloadError(error.message || 'Download failed. Try downloading individual stems.');
    } finally {
      if (archive.current === controller) {
        archive.current = null;
        setPacking(false);
      }
    }
  };

  const toKeyBpm = (job, { file, kind, label }) => {
    const detected =
      kind === 'original' && job.analysis?.status === 'ready'
        ? { key: job.analysis.key || null, bpm: job.analysis.bpm ?? null }
        : null;
    offerToolHandoff({
      target: 'keybpm',
      from: 'Stem Separator',
      file,
      kind,
      label,
      detected,
      user: kind === 'original' ? job.origin?.user || null : null,
    });
    trackSiteEvent('continue_to_keybpm');
    navigate('/studio/keybpm');
  };

  const toSongboard = (job) => {
    offerStemHandoff({
      title: safeTrackName(job.file.name),
      fullMix: job.file,
      stems: job.outputs.map((output) => ({
        id: output.id,
        file: new File([output.blob], output.name, { type: 'audio/wav' }),
      })),
    });
    trackSiteEvent('continue_to_songboard');
    navigate('/studio');
  };

  const playerStems = useMemo(
    () =>
      focused
        ? STEMS.map((stem) => {
            const output = focused.outputs.find((item) => item.id === stem.id);
            return (
              output && {
                id: stem.id,
                label: stemLabel(stem.id),
                color: stem.color,
                blob: output.blob,
                url: output.url,
                name: output.name,
                peaks: output.peaks,
              }
            );
          }).filter(Boolean)
        : [],
    [focused]
  );

  const doClear = async () => {
    setConfirmClear(false);
    setFocusId(null);
    const ok = await clearSaved();
    setClearNote(ok ? 'Saved songs and stems were removed from this browser.' : '');
  };

  return (
    <>
      <SeparatorNavigationGuard
        when={locked || Boolean(storageWarning && ready.length)}
        message={locked ? LEAVE_WHILE_PROCESSING : undefined}
      />
      <SEO {...PAGE_SEO.separator} />
      <StructuredData
        data={musicToolSchema('separator', [
          'Vocal, drum, bass and other-instrument stems',
          'Synchronized stem playback with mute, solo and levels',
          'Vocal backing, drumless and bassless practice mixes as one WAV',
          'A–B practice loop',
          'Batch separation on your device',
          'Estimated song and stem key and tempo',
          'WAV and ZIP downloads',
        ])}
      />
      <section className="separator-page">
        <div className="separator-shell">
          <nav className="separator-breadcrumb" aria-label="Music tools">
            <Link to="/hub">
              <ArrowLeft size={15} /> Sattari Hub
            </Link>
            <span className="separator-breadcrumb-end">
              <Link to="/studio/keybpm">
                <Gauge size={15} /> Key & BPM
              </Link>
              <Link to="/studio">
                Songboard <ArrowUpRight size={15} />
              </Link>
            </span>
          </nav>
          <header className="separator-heading">
            <div>
              <p className="separator-eyebrow">Sattari Music</p>
              <h1>
                Stem Separator <span className="separator-beta">Beta</span>
              </h1>
              <p className="separator-lede">
                Split a song into vocals, drums, bass and other instruments, play along with the
                parts you need, and download your practice mix.
              </p>
            </div>
            <span className="separator-private">
              <ShieldCheck size={16} /> Audio is processed on this device
            </span>
          </header>

          {received && <HandoffNotice handoff={received} destination="Stem Separator" />}

          <div className="separator-workspace">
            <aside className="separator-settings" aria-label="Separation settings">
              <fieldset disabled={locked} className="separator-goals">
                <legend>What are you making?</legend>
                {SEPARATOR_GOALS.map((item) => (
                  <label
                    key={item.id}
                    className={`separator-goal${goal === item.id ? ' is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="separator-goal"
                      value={item.id}
                      checked={goal === item.id}
                      onChange={() => chooseGoal(item.id)}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
              {goal === 'custom' && (
                <fieldset disabled={locked}>
                  <legend>Parts to keep</legend>
                  <div className="separator-choices">
                    {STEMS.map(({ id, color }) => {
                      const Icon = icons[id];
                      return (
                        <label
                          key={id}
                          className={`separator-choice${selected.includes(id) ? ' is-selected' : ''}`}
                          style={{ '--stem-color': color }}
                        >
                          <Icon size={20} />
                          <span>
                            {stemLabel(id)}
                            {id === 'other' && <small>Guitar, keys, synths and the rest</small>}
                          </span>
                          <input
                            type="checkbox"
                            checked={selected.includes(id)}
                            onChange={(event) =>
                              setSelected((current) =>
                                event.target.checked
                                  ? [...current, id]
                                  : current.filter((stem) => stem !== id)
                              )
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                  <p className="separator-note">
                    Keeping fewer parts saves memory. The model still computes all four.
                  </p>
                </fieldset>
              )}
              <details className="separator-disclosure">
                <summary>Processing options</summary>
                <label className="separator-device">
                  Processing device
                  <select
                    value={cpuOnly ? 'cpu' : 'auto'}
                    disabled={locked}
                    onChange={(event) => setCpuOnly(event.target.value === 'cpu')}
                  >
                    <option value="auto">Automatic (GPU when available)</option>
                    <option value="cpu">CPU compatibility mode</option>
                  </select>
                </label>
                <p className="separator-note">
                  Use CPU mode if GPU processing fails or produces errors. It is slower.
                </p>
              </details>
              <dl className="separator-specs">
                <div>
                  <dt>Model</dt>
                  <dd>HTDemucs, 4 parts</dd>
                </div>
                <div>
                  <dt>Stems</dt>
                  <dd>32-bit float WAV, 44.1 kHz</dd>
                </div>
                <div>
                  <dt>Your mix</dt>
                  <dd>WAV, 32-bit float or 24-bit</dd>
                </div>
                <div>
                  <dt>Audio uploads</dt>
                  <dd>None</dd>
                </div>
              </dl>
              <details className="separator-disclosure">
                <summary>Where your audio goes</summary>
                <ul className="separator-facts">
                  <li>
                    Songs are decoded and separated in this browser. They are not uploaded to
                    Sattari or anyone else.
                  </li>
                  <li>
                    The first separation downloads the 172 MB model from Hugging Face at a pinned,
                    checksum-verified version. Your browser keeps it in its cache for next time.
                  </li>
                  <li>
                    Finished songs and stems are saved in this browser so they survive a reload.
                    That is not a backup: the browser can remove it. Download what matters.
                  </li>
                </ul>
              </details>
              <p className="separator-note">
                A laptop or desktop with a current browser works best. Each song can take several
                minutes on CPU. Phones may run out of memory on long songs.
              </p>
              <p className="separator-note">
                Results are AI estimates and can contain bleed or artifacts. “Other instruments” is
                everything that is not vocals, drums or bass, in one stem.
              </p>
              <a
                className="separator-credits"
                href="/stem-separator-credits.txt"
                target="_blank"
                rel="noreferrer"
              >
                Engine credits <ArrowUpRight size={12} />
              </a>
            </aside>
            <div className="separator-main">
              <div
                className={`separator-drop${dragging ? ' is-dragging' : ''}${locked ? ' is-locked' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!locked) setDragging(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (!locked) addFiles(event.dataTransfer.files);
                }}
              >
                <div className="separator-upload-mark">
                  <Upload size={25} strokeWidth={1.5} />
                </div>
                <div className="separator-drop-copy">
                  <h2>{dragging ? 'Drop your songs' : 'Add a song'}</h2>
                  <p>Drag audio here or choose files. WAV, MP3, FLAC, M4A, AAC, OGG.</p>
                  <small>Up to 20 songs · 100 MB and 10 minutes each</small>
                </div>
                <div className="separator-upload-actions">
                  <button
                    type="button"
                    className="separator-button separator-primary"
                    disabled={locked}
                    onClick={() => picker.current.click()}
                  >
                    <Plus size={17} /> Choose audio
                  </button>
                  <button
                    type="button"
                    className="separator-text-button"
                    disabled={locked}
                    onClick={loadDemo}
                    title="An 8-second original Sattari practice mix, separated by the real model"
                  >
                    <AudioLines size={15} /> Try the 8-second example
                  </button>
                </div>
                <input
                  ref={picker}
                  type="file"
                  className="separator-file-input"
                  aria-label="Add audio tracks"
                  multiple
                  accept={AUDIO_ACCEPT}
                  disabled={locked}
                  onChange={(event) => {
                    addFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
              </div>
              {errors.length > 0 && (
                <div className="separator-error" role="alert">
                  {errors.map((error, index) => (
                    <p key={index}>{error}</p>
                  ))}
                </div>
              )}
              {storageWarning && (
                <p className="separator-warning" role="status">
                  {storageWarning}
                </p>
              )}

              {focused && (
                <section className="separator-player" aria-labelledby="separator-player-heading">
                  <div className="separator-player-head">
                    <div>
                      <p className="separator-eyebrow">Now playing</p>
                      <h2 id="separator-player-heading" title={focused.file.name}>
                        {focused.file.name}
                      </h2>
                    </div>
                    <div className="separator-player-actions">
                      <button
                        type="button"
                        className="separator-text-button"
                        onClick={() =>
                          toKeyBpm(focused, {
                            file: focused.file,
                            kind: 'original',
                            label: focused.file.name,
                          })
                        }
                      >
                        <Gauge size={14} /> Check key & BPM
                      </button>
                      {focused.outputs.length === 4 && (
                        <button
                          type="button"
                          className="separator-text-button"
                          onClick={() => toSongboard(focused)}
                        >
                          <SlidersHorizontal size={14} /> Open in Songboard
                        </button>
                      )}
                    </div>
                  </div>
                  <StemPlayer
                    key={focused.id}
                    trackName={focused.file.name}
                    fileBase={safeTrackName(focused.file.name)}
                    stems={playerStems}
                    original={{ blob: focused.file, peaks: focused.peaks }}
                    initialPreset={focused.goal || 'all'}
                    onEvent={(type) => {
                      if (type === 'preview')
                        trackSiteEventOnce(`${focused.id}:preview`, 'stem_preview');
                      if (type === 'stem_download') trackSiteEvent('stem_download');
                      if (type === 'mix_exported') trackSiteEvent('mix_exported');
                    }}
                    stemActions={(stem) => (
                      <button
                        type="button"
                        className="stem-player-icon"
                        aria-label={`Check key and BPM of the ${stem.label} stem`}
                        title={`Check key & BPM of ${stem.label}`}
                        onClick={() =>
                          toKeyBpm(focused, {
                            file: new File([stem.blob], stem.name, { type: 'audio/wav' }),
                            kind: 'stem',
                            label: `${stem.label} stem of ${focused.file.name}`,
                          })
                        }
                      >
                        <Gauge size={15} aria-hidden="true" />
                      </button>
                    )}
                    afterExport={(mix) => (
                      <div>
                        <button
                          type="button"
                          className="separator-text-button"
                          onClick={() =>
                            toKeyBpm(focused, {
                              file: new File([mix.blob], mix.name, { type: 'audio/wav' }),
                              kind: 'mix',
                              label: `${mix.name} (your mix of ${focused.file.name})`,
                            })
                          }
                        >
                          <Gauge size={14} /> Check key & BPM of this mix
                        </button>
                      </div>
                    )}
                  />
                  {focused.origin?.user && (focused.origin.user.key || focused.origin.user.bpm) && (
                    <p className="separator-note">
                      Your settings from {focused.origin.from}:{' '}
                      {[
                        focused.origin.user.key,
                        focused.origin.user.bpm && `${focused.origin.user.bpm} BPM`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}{' '}
                      (chosen by you, not detected here).
                    </p>
                  )}
                </section>
              )}

              <div className="separator-queue-heading">
                <h2>
                  Songs <span>{jobs.length.toString().padStart(2, '0')}</span>
                </h2>
                {ready.length > 0 && (
                  <button
                    className="separator-text-button"
                    onClick={clearFinished}
                    disabled={locked}
                  >
                    <Trash2 size={14} /> Remove finished
                  </button>
                )}
              </div>
              {jobs.length === 0 ? (
                <div className="separator-empty">
                  <FileAudio size={32} strokeWidth={1.2} />
                  <strong>No songs yet</strong>
                  <span>Add a song or try the example to hear separated parts.</span>
                </div>
              ) : (
                <div className="separator-queue">
                  {jobs.map((job, index) => (
                    <article
                      className={`separator-track is-${job.status}${focused?.id === job.id ? ' is-focused' : ''}`}
                      key={job.id}
                      aria-label={job.file.name}
                    >
                      <div className="separator-track-top">
                        <span className="separator-track-number">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="separator-track-title">
                          <h3 title={job.file.name}>{job.file.name}</h3>
                          <span>
                            {(job.file.size / 1024 ** 2).toFixed(1)} MB
                            {job.duration ? ` · ${formatDuration(job.duration)}` : ''}
                            {job.origin ? ` · from ${job.origin.from}` : ''}
                          </span>
                        </div>
                        <span className={`separator-status status-${job.status}`}>
                          {job.status === 'done' ? (
                            <>
                              <Check size={13} /> Ready
                            </>
                          ) : job.status === 'processing' ? (
                            <>
                              <LoaderCircle className="separator-spin" size={13} /> Processing
                            </>
                          ) : job.status === 'error' ? (
                            'Failed'
                          ) : job.status === 'cancelled' ? (
                            'Stopped'
                          ) : (
                            'Waiting'
                          )}
                        </span>
                        {(job.status === 'error' || job.status === 'cancelled') && (
                          <button
                            className="separator-icon"
                            disabled={locked || !selected.length}
                            onClick={() => run(job.id)}
                            title={`Retry ${job.file.name}`}
                            aria-label={`Retry ${job.file.name}`}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        <button
                          className="separator-icon"
                          disabled={locked}
                          onClick={() => remove(job.id)}
                          title={`Remove ${job.file.name}`}
                          aria-label={`Remove ${job.file.name}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {job.peaks && job.status !== 'done' && <Waveform peaks={job.peaks} />}
                      {job.status === 'processing' && <ProcessingProgress job={job} />}
                      {(job.status === 'error' || job.status === 'cancelled') && (
                        <p
                          className="separator-track-error"
                          role={job.status === 'error' ? 'alert' : undefined}
                        >
                          {job.message}
                          {job.status === 'error' &&
                            !cpuOnly &&
                            ' You can also retry in CPU compatibility mode under Processing options.'}
                        </p>
                      )}
                      {job.analysis && (
                        <div className="separator-song-analysis">
                          <StemAnalysisSummary analysis={job.analysis} />
                        </div>
                      )}
                      {job.status === 'done' && (
                        <div className="separator-track-download">
                          <button
                            className="separator-text-button"
                            aria-pressed={focused?.id === job.id}
                            onClick={() => setFocusId(job.id)}
                          >
                            <AudioLines size={14} />{' '}
                            {focused?.id === job.id ? 'In the player' : 'Open in player'}
                          </button>
                          <span className="separator-stem-links">
                            {job.outputs.map((output) => (
                              <a
                                key={output.id}
                                href={output.url}
                                download={output.name}
                                onClick={() => trackSiteEvent('stem_download')}
                                aria-label={`Download ${stemLabel(output.id)} WAV for ${job.file.name}`}
                              >
                                <Download size={13} /> {stemLabel(output.id)}
                              </a>
                            ))}
                          </span>
                          <button
                            className="separator-text-button"
                            disabled={locked}
                            onClick={() => downloadZip([job])}
                          >
                            <Download size={14} /> Song ZIP
                          </button>
                          {job.analysis && (
                            <button
                              className="separator-text-button"
                              onClick={() => downloadReport(job)}
                              aria-label={`Download analysis for ${job.file.name}`}
                            >
                              <Download size={14} /> Analysis JSON
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <div className="separator-actions">
                <div className="separator-batch-summary" role="status">
                  {running
                    ? 'Separating…'
                    : selected.length === STEMS.length
                      ? 'All four parts'
                      : `${selected.length} of 4 parts`}
                  {jobs.length > 0 && (
                    <small>
                      {ready.length} of {jobs.length} songs ready
                    </small>
                  )}
                </div>
                <div className="separator-action-buttons">
                  {ready.length > 1 && (
                    <button
                      className="separator-button"
                      disabled={locked}
                      onClick={() => downloadZip(ready)}
                    >
                      <Download size={16} /> All songs ZIP
                    </button>
                  )}
                  {packing ? (
                    <button className="separator-button" onClick={() => archive.current?.abort()}>
                      <Square size={14} /> Cancel ZIP
                    </button>
                  ) : running || loadingDemo ? (
                    <button className="separator-button" onClick={cancel}>
                      <Square size={14} /> {running ? 'Stop' : 'Cancel example'}
                    </button>
                  ) : (
                    <button
                      className="separator-button separator-primary"
                      disabled={!pending.length || !selected.length}
                      onClick={() => run()}
                    >
                      <Layers size={17} /> Separate
                      {pending.length > 0
                        ? ` ${pending.length} ${pending.length === 1 ? 'song' : 'songs'}`
                        : ''}
                    </button>
                  )}
                </div>
              </div>
              {packing && (
                <p className="separator-note" role="status">
                  Preparing ZIP…
                </p>
              )}
              {downloadError && (
                <p className="separator-error" role="alert">
                  {downloadError}
                </p>
              )}

              <section className="separator-saved" aria-labelledby="separator-saved-heading">
                <h2 id="separator-saved-heading">
                  <HardDrive size={15} /> Saved in this browser
                </h2>
                <p>
                  Songs and their stems stay in this browser until you remove them, so a reload does
                  not lose your work. Browsers can still clear this storage when space runs low, so
                  download anything important. Use one Stem Separator tab at a time.
                </p>
                {confirmClear ? (
                  <div className="separator-confirm" role="group" aria-label="Confirm clearing">
                    <span>
                      Remove all {jobs.length || ''} saved songs and stems from this browser? The
                      cached model and other Sattari tools are not affected.
                    </span>
                    <button className="separator-button" onClick={() => void doClear()}>
                      Remove saved work
                    </button>
                    <button
                      className="separator-text-button"
                      onClick={() => setConfirmClear(false)}
                    >
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button
                    className="separator-text-button"
                    disabled={locked}
                    onClick={() => {
                      setClearNote('');
                      setConfirmClear(true);
                    }}
                  >
                    <Trash2 size={14} /> Clear saved work
                  </button>
                )}
                {clearNote && (
                  <p className="separator-note" role="status">
                    {clearNote}
                  </p>
                )}
                <p className="separator-session-note">
                  Process only audio you have the right to use.
                </p>
              </section>
            </div>
          </div>
          <ToolReferenceLink tool="stem-separator" />
          <nav className="separator-guides" aria-labelledby="separator-guides-heading">
            <h2 id="separator-guides-heading">Practice guides</h2>
            <div>
              {separatorGuides.map((guide) => (
                <a
                  key={guide.slug}
                  href={`/guides/${guide.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${guide.linkLabel} (opens in a new tab)`}
                >
                  {guide.linkLabel}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              ))}
              <a
                href="/tools/stem-separator#questions"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Stem Separator questions (opens in a new tab)"
              >
                Common questions <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </nav>
          <ToolFeedback tool="Stem Separator" className="separator-feedback" />
        </div>
      </section>
    </>
  );
}
