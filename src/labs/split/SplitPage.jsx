import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  AudioLines,
  Download,
  FileMusic,
  LoaderCircle,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Wand2,
} from 'lucide-react';
import AudioLabShell from '../audio/AudioLabShell';
import { formatTime, LabDrop, LabWaveform } from '../audio/AudioLabParts';
import StemMixer from './StemMixer';
import SplitOffline from './SplitOffline';
import useStemSeparator from '../../hooks/useStemSeparator';
import { safeTrackName, STEMS } from '../../utils/stemSeparator';
import { createStemArchive } from '../../utils/stemSeparatorDownload';
import { downloadBlob } from '../audio/audioLabFiles';
import { offerStemHandoff } from '../../studio/stemHandoff';
import { entryFile, useLockerOpen } from '../../suite/suiteKit';

const LIMITS = [
  'Quality is HTDemucs-class, not studio grade: expect some bleed between stems and artifacts on dense mixes.',
  '"Instruments" is everything that is not vocals, drums or bass (guitars, keys, synths together).',
  'First run downloads a 172 MB model from Hugging Face (cached afterwards). Desktop Chrome/Edge with WebGPU is fastest; CPU mode can take several minutes per song.',
  'One song at a time, up to 10 minutes and 100 MB. Phones and tablets are untested.',
  'Use it on your own tracks or for practice; you are responsible for having the rights to what you separate.',
  'Results are not saved: download the WAVs or send them to StemDeck before leaving the page.',
];

export default function SplitPage() {
  const separator = useStemSeparator();
  const { jobs, running, errors, cpuOnly, setCpuOnly, loadingDemo, addFiles, remove, run, cancel } =
    separator;
  const navigate = useNavigate();
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState('');
  const zipAbort = useRef(null);
  const job = jobs[jobs.length - 1] || null;
  const locked = running || loadingDemo || zipping;

  const choose = (files) => {
    if (locked || !files.length) return;
    jobs.forEach((item) => remove(item.id));
    addFiles([files[0]]);
  };

  // A song sent from the Locker or another suite app (?tcc-open=) is queued like a dropped file.
  useLockerOpen('split', (entry) => choose([entryFile(entry)]));

  const lanes = useMemo(() => {
    if (job?.status !== 'done') return null;
    return STEMS.map((stem) => {
      const output = job.outputs.find((item) => item.id === stem.id);
      return (
        output && {
          ...stem,
          blob: output.blob,
          url: output.url,
          name: output.name,
          peaks: output.peaks,
        }
      );
    })
      .filter(Boolean)
      .concat({
        id: 'original',
        label: 'Original',
        color: '#8b939b',
        blob: job.file,
        peaks: job.peaks,
        muted: true,
      });
  }, [job]);

  const openInStemDeck = () => {
    const title = safeTrackName(job.file.name);
    offerStemHandoff({
      title,
      fullMix: job.file,
      stems: job.outputs.map((output) => ({
        id: output.id,
        file: new File([output.blob], output.name, { type: 'audio/wav' }),
      })),
    });
    navigate('/studio');
  };

  const downloadZip = async () => {
    const controller = new AbortController();
    zipAbort.current = controller;
    setZipping(true);
    setZipError('');
    try {
      const blob = await createStemArchive([job], controller.signal);
      downloadBlob(blob, `${safeTrackName(job.file.name)}-stems.zip`);
    } catch (error) {
      if (!controller.signal.aborted) setZipError(error.message);
    } finally {
      setZipping(false);
      zipAbort.current = null;
    }
  };

  const analysis = job?.analysis?.status === 'ready' ? job.analysis : null;

  const [abletonBusy, setAbletonBusy] = useState(false);
  const exportAbleton = async () => {
    setAbletonBusy(true);
    setZipError('');
    try {
      const { exportForAbleton, warpModeFor } = await import('../../utils/abletonExport');
      const byId = new Map(job.outputs.map((output) => [output.id, output]));
      const pack = await exportForAbleton({
        title: safeTrackName(job.file.name),
        bpm: analysis?.bpm ?? null,
        source: { app: 'Split', tempoIsEstimate: true },
        stems: [
          ...STEMS.filter((stem) => byId.has(stem.id)).map((stem) => ({
            name: stem.label,
            color: stem.color,
            warpMode: warpModeFor(stem.id),
            blob: byId.get(stem.id).blob,
          })),
          // The original, muted, for A/B against the stems.
          { name: 'Original mix', blob: job.file, muted: true, warpMode: warpModeFor('mix') },
        ],
      });
      downloadBlob(pack.blob, pack.fileName);
    } catch (error) {
      setZipError(`Ableton export failed: ${error.message}`);
    } finally {
      setAbletonBusy(false);
    }
  };

  return (
    <AudioLabShell
      tool="split"
      title="Split"
      eyebrow="Sattari Studio lab"
      summary="Drop a song and split it into vocals, drums, bass and instruments with the HTDemucs model running in your browser. Mute the vocals, solo the bass, download WAV stems or open them straight in StemDeck."
      description="Split a song into vocals, drums, bass and instrument stems in your browser with HTDemucs, then open them in StemDeck."
      limits={LIMITS}
    >
      <div className="alab-workspace">
        <LabDrop
          title={job ? 'Choose another song' : 'Add a song'}
          hint="WAV, MP3, FLAC, M4A, OGG · one song · up to 10 min"
          disabled={locked}
          onFiles={choose}
        >
          <button
            type="button"
            className="alab-text-button"
            disabled={locked}
            onClick={() => {
              jobs.forEach((item) => remove(item.id));
              void separator.loadDemo();
            }}
          >
            <AudioLines size={15} aria-hidden="true" /> Try the 8-second demo
          </button>
        </LabDrop>
        {errors.length > 0 && (
          <div className="alab-error" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}

        {job && (
          <section className="alab-card" aria-label="Song">
            <div className="alab-card-head">
              <div>
                <h2 title={job.file.name}>{job.file.name}</h2>
                <p className="alab-note">
                  {job.duration ? formatTime(job.duration) : 'Not decoded yet'}
                  {analysis?.key && ` · ${analysis.key}`}
                  {analysis?.bpm && ` · ${analysis.bpm} BPM`}
                  {analysis && ' (estimates)'}
                </p>
              </div>
              <div className="alab-toolbar-actions">
                <label className="alab-inline-select">
                  Device
                  <select
                    value={cpuOnly ? 'cpu' : 'auto'}
                    disabled={locked}
                    onChange={(event) => setCpuOnly(event.target.value === 'cpu')}
                  >
                    <option value="auto">Automatic (WebGPU if available)</option>
                    <option value="cpu">CPU compatibility mode</option>
                  </select>
                </label>
                {running ? (
                  <button type="button" className="alab-text-button" onClick={cancel}>
                    <Square size={14} aria-hidden="true" /> Stop
                  </button>
                ) : job.status !== 'done' ? (
                  <button
                    type="button"
                    className="alab-button alab-primary"
                    disabled={locked}
                    onClick={() => void run(job.id)}
                  >
                    {job.status === 'queued' ? (
                      <>
                        <Wand2 size={16} aria-hidden="true" /> Split into stems
                      </>
                    ) : (
                      <>
                        <RotateCcw size={16} aria-hidden="true" /> Retry
                      </>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
            {job.peaks && job.status !== 'done' && (
              <LabWaveform peaks={job.peaks} color="#8b939b" />
            )}
            {job.status === 'processing' && (
              <div className="alab-progress" role="status">
                <div>
                  <span>
                    <LoaderCircle className="alab-spin" size={14} aria-hidden="true" />{' '}
                    {job.message}
                  </span>
                  {job.progress !== null && <span>{Math.round(job.progress * 100)}%</span>}
                </div>
                <progress
                  max="1"
                  value={job.progress === null ? undefined : job.progress}
                  aria-label="Separation progress"
                />
              </div>
            )}
            {(job.status === 'error' || job.status === 'cancelled') && (
              <p className="alab-bad" role="alert">
                {job.message}
              </p>
            )}
            {job.status === 'queued' && (
              <p className="alab-note">
                Nothing is uploaded. The first split downloads the 172 MB model once and keeps it in
                your browser cache.
              </p>
            )}
            {lanes && (
              <>
                <StemMixer lanes={lanes} />
                <div className="alab-actions">
                  <button
                    type="button"
                    className="alab-button alab-primary"
                    onClick={openInStemDeck}
                  >
                    <SlidersHorizontal size={16} aria-hidden="true" /> Open in StemDeck
                  </button>
                  <button
                    type="button"
                    className="alab-button"
                    disabled={zipping}
                    onClick={() => void downloadZip()}
                  >
                    {zipping ? (
                      <LoaderCircle className="alab-spin" size={16} aria-hidden="true" />
                    ) : (
                      <Download size={16} aria-hidden="true" />
                    )}{' '}
                    All stems (ZIP)
                  </button>
                  <button
                    type="button"
                    className="alab-button"
                    disabled={abletonBusy}
                    onClick={() => void exportAbleton()}
                    title="A ZIP with the stems as WAV files and an Ableton Live Set (.als) with one track per stem at the detected tempo"
                  >
                    {abletonBusy ? (
                      <LoaderCircle className="alab-spin" size={16} aria-hidden="true" />
                    ) : (
                      <FileMusic size={16} aria-hidden="true" />
                    )}{' '}
                    Export for Ableton
                  </button>
                  <a
                    className="alab-text-button"
                    href="/stem-separator-credits.txt"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Model credits <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                </div>
                {zipError && (
                  <p className="alab-bad" role="alert">
                    {zipError}
                  </p>
                )}
                <p className="alab-note">
                  Open in StemDeck loads the original and the four stems into the first empty deck,
                  with the full mix turned down. WAVs are 32-bit float, 44.1 kHz. Export for Ableton
                  adds a Live Set (Live 12) with each stem on its own track at bar 1, warped at the
                  detected tempo{analysis?.bpm ? ` (${analysis.bpm} BPM)` : ''}.
                </p>
              </>
            )}
          </section>
        )}
        <p className="alab-note">
          Model: HTDemucs by Meta (MIT License), ONNX conversion by demucs-web (MIT), fetched from
          Hugging Face at a pinned revision and SHA-256 checked before use.{' '}
          <a href="/stem-separator-credits.txt" target="_blank" rel="noreferrer">
            Credits and licenses
          </a>
        </p>
        <SplitOffline disabled={locked} />
      </div>
    </AudioLabShell>
  );
}
