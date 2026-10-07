import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, LoaderCircle, Square, Trash2 } from 'lucide-react';
import AudioLabShell from '../audio/AudioLabShell';
import { formatTime, LabDrop } from '../audio/AudioLabParts';
import { downloadBlob, isAudioFile } from '../audio/audioLabFiles';
import { decodeTrack, SAMPLE_RATE } from '../../utils/stemSeparator';
import { KEYBPM_MAX_BYTES, KEYBPM_MAX_FILES, resultRow, resultsCsv } from './keyBpm';
import { entryFile, useLockerOpen } from '../../suite/suiteKit';

const LIMITS = [
  'Key is one global estimate per track (Sattari AutoKey). Key changes, modal or atonal music are not reported separately.',
  'BPM can land on half or double time. "Rough" means the strict estimator declined and a single 60-second pass was used, folded into 70–180 BPM.',
  'Up to 10 minutes and 200 MB per file, mono or stereo, in formats your browser can decode.',
  'Results live only in this tab. Export the CSV before leaving.',
  'Fixture-tested, not benchmarked on a labelled music corpus yet: treat values as starting points.',
];

const SORTS = {
  added: () => 0,
  bpm: (a, b) => (a.result?.bpm ?? 1e9) - (b.result?.bpm ?? 1e9),
  camelot: (a, b) => {
    const value = (row) => {
      const code = row.result?.camelot;
      return code ? parseInt(code, 10) * 2 + (code.endsWith('B') ? 1 : 0) : 1e9;
    };
    return value(a) - value(b);
  },
  name: (a, b) => a.file.name.localeCompare(b.file.name),
};

function createWorker() {
  return new Worker(new URL('./keyBpm.worker.js', import.meta.url), { type: 'module' });
}

function analyzeInWorker(worker, id, audio, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Stopped.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    const settle = (fn, value) => {
      signal.removeEventListener('abort', abort);
      fn(value);
    };
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.error) settle(reject, new Error(data.error));
      else settle(resolve, data);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      settle(reject, new Error('The analysis worker stopped. Try a shorter file.'));
    };
    worker.postMessage(
      { id, left: audio.left, right: audio.right, channels: audio.channels, rate: SAMPLE_RATE },
      [audio.left.buffer, audio.right.buffer]
    );
  });
}

export default function KeyBpmPage() {
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [running, setRunning] = useState(false);
  const [sort, setSort] = useState('added');
  const rowsRef = useRef([]);
  const worker = useRef(null);
  const controller = useRef(null);
  const mounted = useRef(true);

  const publish = (next) => {
    rowsRef.current = next;
    if (mounted.current) setRows(next);
  };
  const update = (id, patch) =>
    publish(rowsRef.current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      worker.current?.terminate();
    };
  }, []);

  const runQueue = async () => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    try {
      for (;;) {
        const row = rowsRef.current.find((item) => item.status === 'queued');
        if (!row || abort.signal.aborted) break;
        update(row.id, { status: 'analyzing' });
        try {
          const audio = await decodeTrack(row.file, abort.signal);
          worker.current ||= createWorker();
          const { analysis, rough } = await analyzeInWorker(
            worker.current,
            row.id,
            audio,
            abort.signal
          );
          update(row.id, { status: 'done', result: resultRow(row.file.name, analysis, rough) });
        } catch (error) {
          if (abort.signal.aborted) {
            update(row.id, { status: 'queued' });
            break;
          }
          worker.current?.terminate();
          worker.current = null;
          update(row.id, {
            status: 'error',
            result: { file: row.file.name, status: 'error', note: error.message },
          });
        }
      }
    } finally {
      controller.current = null;
      if (mounted.current) setRunning(false);
    }
  };

  const addFiles = (files) => {
    const issues = [];
    const seen = new Set(rowsRef.current.map((row) => `${row.file.name}:${row.file.size}`));
    const added = [];
    for (const file of files) {
      const key = `${file.name}:${file.size}`;
      if (!isAudioFile(file)) issues.push(`${file.name}: not an audio file.`);
      else if (file.size > KEYBPM_MAX_BYTES) issues.push(`${file.name}: larger than 200 MB.`);
      else if (seen.has(key)) issues.push(`${file.name}: already in the list.`);
      else if (rowsRef.current.length + added.length >= KEYBPM_MAX_FILES)
        issues.push(`${file.name}: the list holds up to ${KEYBPM_MAX_FILES} tracks.`);
      else {
        seen.add(key);
        added.push({ id: crypto.randomUUID(), file, status: 'queued', result: null });
      }
    }
    setErrors(issues);
    if (!added.length) return;
    publish([...rowsRef.current, ...added]);
    void runQueue();
  };
  // Audio sent from the Locker or another suite app (?tcc-open=).
  useLockerOpen('key-bpm', (entry) => addFiles([entryFile(entry)]));

  const stop = () => {
    controller.current?.abort();
    worker.current?.terminate();
    worker.current = null;
  };

  const done = rows.filter((row) => row.result);
  const sorted = useMemo(() => [...rows].sort(SORTS[sort]), [rows, sort]);
  const remaining = rows.filter((row) => row.status === 'queued' || row.status === 'analyzing');

  return (
    <AudioLabShell
      tool="keybpm"
      title="Key & BPM"
      eyebrow="Sattari Studio lab"
      summary="Drop a folder of tracks and get the key, Camelot code and tempo of each, measured in your browser with Sattari AutoKey. Export everything as CSV for your DJ crates."
      description="Detect the musical key, Camelot code and BPM of many tracks at once in your browser, then export a CSV."
      limits={LIMITS}
    >
      <div className="alab-workspace">
        <LabDrop
          title="Add tracks"
          hint="Drop many files at once · WAV, MP3, FLAC, M4A, OGG · up to 10 min each"
          multiple
          onFiles={addFiles}
        />
        {errors.length > 0 && (
          <div className="alab-error" role="alert">
            {errors.slice(0, 6).map((error) => (
              <p key={error}>{error}</p>
            ))}
            {errors.length > 6 && <p>…and {errors.length - 6} more.</p>}
          </div>
        )}
        <div className="alab-toolbar">
          <h2>
            Tracks <span>{rows.length}</span>
          </h2>
          <div className="alab-toolbar-actions">
            {running ? (
              <span className="alab-status" role="status">
                <LoaderCircle className="alab-spin" size={15} aria-hidden="true" /> Analyzing{' '}
                {done.length + 1} of {done.length + remaining.length}
              </span>
            ) : remaining.length > 0 ? (
              <button type="button" className="alab-text-button" onClick={() => void runQueue()}>
                Resume ({remaining.length})
              </button>
            ) : null}
            {running && (
              <button type="button" className="alab-text-button" onClick={stop}>
                <Square size={14} aria-hidden="true" /> Stop
              </button>
            )}
            <label className="alab-inline-select">
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="added">As added</option>
                <option value="name">Name</option>
                <option value="bpm">BPM</option>
                <option value="camelot">Camelot</option>
              </select>
            </label>
            <button
              type="button"
              className="alab-button"
              disabled={!done.length}
              onClick={() =>
                downloadBlob(
                  new Blob([resultsCsv(done.map((row) => row.result))], {
                    type: 'text/csv;charset=utf-8',
                  }),
                  'sattari-key-bpm.csv'
                )
              }
            >
              <Download size={16} aria-hidden="true" /> Export CSV
            </button>
            <button
              type="button"
              className="alab-text-button"
              disabled={running || !rows.length}
              onClick={() => publish([])}
            >
              <Trash2 size={14} aria-hidden="true" /> Clear
            </button>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="alab-empty">No tracks yet. Results appear here as each file is measured.</p>
        ) : (
          <div className="alab-table-wrap">
            <table className="alab-table">
              <thead>
                <tr>
                  <th scope="col">Track</th>
                  <th scope="col">Length</th>
                  <th scope="col">Key</th>
                  <th scope="col">Camelot</th>
                  <th scope="col">BPM</th>
                  <th scope="col">Level</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(({ id, file, status, result }) => (
                  <tr key={id} data-status={status}>
                    <th scope="row" title={file.name}>
                      {file.name}
                    </th>
                    {status === 'done' ? (
                      <>
                        <td>{formatTime(result.duration)}</td>
                        <td>
                          {result.key || '—'}
                          {result.key && result.keyEvidence === 'tentative' && (
                            <small
                              className="alab-flag"
                              title={`Alternative: ${result.alternative}`}
                            >
                              tentative
                            </small>
                          )}
                        </td>
                        <td>{result.camelot || '—'}</td>
                        <td>
                          {result.bpm ?? '—'}
                          {result.bpm !== null && result.tempoEvidence !== 'supported' && (
                            <small className="alab-flag">{result.tempoEvidence}</small>
                          )}
                        </td>
                        <td>{result.rmsDb === null ? '—' : `${result.rmsDb} dB RMS`}</td>
                        <td className="alab-note">
                          {result.alternative && `Alt. ${result.alternative}. `}
                          {result.note}
                        </td>
                      </>
                    ) : (
                      <td colSpan={6} className="alab-note">
                        {status === 'queued' && 'Waiting'}
                        {status === 'analyzing' && (
                          <span className="alab-status">
                            <LoaderCircle className="alab-spin" size={14} aria-hidden="true" />{' '}
                            Measuring…
                          </span>
                        )}
                        {status === 'error' && <span className="alab-bad">{result?.note}</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AudioLabShell>
  );
}
