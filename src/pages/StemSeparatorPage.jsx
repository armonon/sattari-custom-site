import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  Check,
  Download,
  Drum,
  FileAudio,
  Guitar,
  Layers,
  LoaderCircle,
  Mic2,
  Music2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SEO, StructuredData } from '../utils/seo';
import { PAGE_SEO, musicToolSchema } from '../data/siteSeo';
import useStemSeparator from '../hooks/useStemSeparator';
import ToolReferenceLink from '../components/ToolReferenceLink';
import StemAnalysisSummary from '../components/StemAnalysisSummary';
import { trackSiteEvent } from '../utils/siteMeasurement';
import { AUDIO_ACCEPT, formatDuration, safeTrackName, STEMS } from '../utils/stemSeparator';
import { createStemArchive } from '../utils/stemSeparatorDownload';
import { stemAnalysisReport } from '../utils/stemAnalysisReport';
import './StemSeparatorPage.css';

const icons = { vocals: Mic2, drums: Drum, bass: Guitar, other: Music2 };

function Waveform({ peaks, color = '#8b939b' }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * scale);
      canvas.height = 40 * scale;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(scale, scale);
      context.fillStyle = color;
      const max = Math.max(0.01, ...peaks);
      const step = rect.width / peaks.length;
      peaks.forEach((peak, index) => {
        const height = Math.max(1, (peak / max) * 34);
        context.fillRect(index * step, (40 - height) / 2, Math.max(1, step - 1), height);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [peaks, color]);
  return <canvas ref={ref} className="separator-waveform" aria-hidden="true" />;
}

function StemOutput({ output }) {
  const stem = STEMS.find(({ id }) => id === output.id);
  const Icon = icons[stem.id];
  const audioRef = useRef(null);
  useEffect(() => {
    const pauseOther = (event) => {
      if (event.detail !== audioRef.current) audioRef.current?.pause();
    };
    window.addEventListener('sattari-stem-preview', pauseOther);
    return () => window.removeEventListener('sattari-stem-preview', pauseOther);
  }, []);
  return (
    <div className="separator-output" style={{ '--stem-color': stem.color }}>
      <span className="separator-output-name">
        <Icon size={16} />
        <strong>{stem.label}</strong>
      </span>
      <Waveform peaks={output.peaks} color={stem.color} />
      <audio
        ref={audioRef}
        controls
        preload="none"
        src={output.url}
        aria-label={`${stem.label} preview`}
        onPlay={(event) =>
          window.dispatchEvent(
            new CustomEvent('sattari-stem-preview', { detail: event.currentTarget })
          )
        }
      />
      <a
        className="separator-icon"
        href={output.url}
        download={output.name}
        onClick={() => trackSiteEvent('stem_download')}
        title={`Download ${stem.label} WAV`}
        aria-label={`Download ${stem.label} WAV`}
      >
        <Download size={17} />
      </a>
      <StemAnalysisSummary analysis={output.analysis} compact label={`${stem.label} analysis`} />
    </div>
  );
}

export default function StemSeparatorPage() {
  const {
    jobs,
    selected,
    setSelected,
    running,
    errors,
    addFiles,
    remove,
    clearFinished,
    run,
    cancel,
  } = useStemSeparator();
  const [dragging, setDragging] = useState(false);
  const [packing, setPacking] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const picker = useRef(null);
  const all = useRef(null);
  const archive = useRef(null);
  const links = useRef(new Set());
  const ready = jobs.filter((job) => job.status === 'done');
  const pending = jobs.filter((job) => job.status !== 'done');
  const locked = running || packing;

  useEffect(() => {
    all.current.indeterminate = selected.length > 0 && selected.length < STEMS.length;
  }, [selected]);
  useEffect(
    () => () => {
      archive.current?.abort();
      links.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  const downloadReport = (job) => {
    const blob = new Blob([JSON.stringify(stemAnalysisReport(job), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    links.current.add(url);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTrackName(job.file.name)}-analysis.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      links.current.delete(url);
    }, 60000);
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
      const url = URL.createObjectURL(blob);
      links.current.add(url);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        rows.length === 1 ? `${safeTrackName(rows[0].file.name)}-stems.zip` : 'sattari-stems.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      trackSiteEvent('stem_download');
      setTimeout(() => {
        URL.revokeObjectURL(url);
        links.current.delete(url);
      }, 60000);
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

  return (
    <>
      <SEO {...PAGE_SEO.separator} />
      <StructuredData
        data={musicToolSchema('separator', [
          'Batch stem separation',
          'Vocal isolation',
          'Drum, bass and instrument stems',
          'On-device audio processing',
          'Estimated song and stem key, tempo and prominent notes',
          'Audio levels and downloadable analysis reports',
          'WAV and ZIP downloads',
        ])}
      />
      <section className="separator-page">
        <div className="separator-shell">
          <nav className="separator-breadcrumb" aria-label="Music tools">
            <Link to="/hub">
              <ArrowLeft size={15} /> Sattari Hub
            </Link>
            <Link to="/studio">
              Open Studio <ArrowUpRight size={15} />
            </Link>
          </nav>
          <header className="separator-heading">
            <div>
              <p className="separator-eyebrow">Sattari music tools</p>
              <h1>
                Stem Separator <span className="separator-beta">Beta</span>
              </h1>
            </div>
            <span className="separator-private">
              <ShieldCheck size={16} /> On-device processing
            </span>
          </header>
          <ToolReferenceLink tool="stem-separator" />
          <div className="separator-workspace">
            <aside className="separator-settings" aria-label="Separation settings">
              <fieldset disabled={locked}>
                <legend>Output stems</legend>
                <label className="separator-all">
                  <Layers size={17} />
                  <span>All stems</span>
                  <input
                    ref={all}
                    type="checkbox"
                    checked={selected.length === STEMS.length}
                    onChange={(event) =>
                      setSelected(event.target.checked ? STEMS.map((stem) => stem.id) : [])
                    }
                  />
                </label>
                <div className="separator-choices">
                  {STEMS.map(({ id, label, color }) => {
                    const Icon = icons[id];
                    return (
                      <label
                        key={id}
                        className={`separator-choice${selected.includes(id) ? ' is-selected' : ''}`}
                        style={{ '--stem-color': color }}
                      >
                        <Icon size={20} />
                        <span>
                          {label}
                          {id === 'other' && <small>Guitar, keys & other sounds</small>}
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
              </fieldset>
              <dl className="separator-specs">
                <div>
                  <dt>Engine</dt>
                  <dd>HTDemucs</dd>
                </div>
                <div>
                  <dt>Export</dt>
                  <dd>44.1 kHz WAV</dd>
                </div>
                <div>
                  <dt>Audio uploads</dt>
                  <dd>None</dd>
                </div>
              </dl>
              <p className="separator-note">
                172 MB model download on first use. Desktop recommended; separation can take several
                minutes per track.
              </p>
              <p className="separator-note">
                AI estimates may contain bleed or artifacts. Instruments excludes drums, bass, and
                vocals.
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
                  <h2>{dragging ? 'Drop tracks' : 'Add your tracks'}</h2>
                  <p>WAV, MP3, FLAC, M4A, AAC, OGG</p>
                  <small>Up to 20 tracks · 100 MB / 10 min each</small>
                </div>
                <button
                  type="button"
                  className="separator-button"
                  disabled={locked}
                  onClick={() => picker.current.click()}
                >
                  <Plus size={17} /> Choose audio
                </button>
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
              <div className="separator-queue-heading">
                <h2>
                  Tracks <span>{jobs.length.toString().padStart(2, '0')}</span>
                </h2>
                {ready.length > 0 && (
                  <button
                    className="separator-text-button"
                    onClick={clearFinished}
                    disabled={locked}
                  >
                    <Trash2 size={14} /> Clear finished
                  </button>
                )}
              </div>
              {jobs.length === 0 ? (
                <div className="separator-empty">
                  <FileAudio size={32} strokeWidth={1.2} />
                  <strong>No tracks queued</strong>
                  <span>Your audio stays on this device.</span>
                </div>
              ) : (
                <div className="separator-queue">
                  {jobs.map((job, index) => (
                    <article
                      className={`separator-track is-${job.status}`}
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
                            'Cancelled'
                          ) : (
                            'Queued'
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
                      {job.status === 'processing' && (
                        <div className="separator-track-progress" role="status">
                          <div>
                            <span>{job.message}</span>
                            {job.progress !== null && (
                              <span>{Math.round(job.progress * 100)}%</span>
                            )}
                          </div>
                          <progress
                            max="1"
                            value={job.progress === null ? undefined : job.progress}
                            aria-label={`${job.file.name} progress`}
                          />
                        </div>
                      )}
                      {job.status === 'error' && (
                        <p className="separator-track-error" role="alert">
                          {job.message}
                        </p>
                      )}
                      {job.analysis && (
                        <div className="separator-song-analysis">
                          <StemAnalysisSummary analysis={job.analysis} />
                          <button
                            className="separator-text-button separator-report-download"
                            onClick={() => downloadReport(job)}
                            aria-label={`Download analysis for ${job.file.name}`}
                          >
                            <Download size={14} /> Analysis JSON
                          </button>
                        </div>
                      )}
                      {job.status === 'done' && (
                        <details className="separator-results" open>
                          <summary>
                            <span>
                              {job.outputs.length} stems{' '}
                              <span className="separator-result-format">/ WAV</span>
                            </span>
                          </summary>
                          <div className="separator-output-list">
                            {job.outputs.map((output) => (
                              <StemOutput key={output.id} output={output} />
                            ))}
                          </div>
                          <div className="separator-track-download">
                            <button
                              className="separator-text-button"
                              disabled={locked}
                              onClick={() => downloadZip([job])}
                            >
                              <Download size={14} /> Download track ZIP
                            </button>
                          </div>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <div className="separator-actions">
                <div className="separator-batch-summary" role="status">
                  {running
                    ? 'Batch in progress'
                    : `${selected.length} ${selected.length === 1 ? 'stem' : 'stems'} selected`}
                  {jobs.length > 0 && (
                    <small>
                      {ready.length} of {jobs.length} tracks ready
                    </small>
                  )}
                </div>
                <div className="separator-action-buttons">
                  {ready.length > 0 && (
                    <button
                      className="separator-button"
                      disabled={locked}
                      onClick={() => downloadZip(ready)}
                    >
                      <Download size={16} /> Download all ZIP
                    </button>
                  )}
                  {packing ? (
                    <button className="separator-button" onClick={() => archive.current?.abort()}>
                      <Square size={14} /> Cancel ZIP
                    </button>
                  ) : running ? (
                    <button className="separator-button" onClick={cancel}>
                      <Square size={14} /> Stop batch
                    </button>
                  ) : (
                    <button
                      className="separator-button separator-primary"
                      disabled={!pending.length || !selected.length}
                      onClick={() => run()}
                    >
                      <AudioLines size={17} /> Separate
                      {pending.length > 0
                        ? ` ${pending.length} ${pending.length === 1 ? 'track' : 'tracks'}`
                        : ' tracks'}
                    </button>
                  )}
                </div>
              </div>
              {packing && (
                <p className="separator-note" role="status">
                  Preparing ZIP...
                </p>
              )}
              {downloadError && (
                <p className="separator-error" role="alert">
                  {downloadError}
                </p>
              )}
              <p className="separator-session-note">
                Results last for this page session. Download before leaving. Process only audio you
                have the right to use.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
