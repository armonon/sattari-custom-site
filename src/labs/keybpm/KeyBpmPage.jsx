import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AudioLines,
  Download,
  FolderOpen,
  Layers,
  LoaderCircle,
  Pause,
  Play,
  Save,
  SlidersHorizontal,
  Square,
  Trash2,
} from 'lucide-react';
import KeyReadout from './KeyReadout';
import AudioLabShell from '../audio/AudioLabShell';
import { formatTime, LabDrop } from '../audio/AudioLabParts';
import { downloadBlob, isAudioFile } from '../audio/audioLabFiles';
import { decodeTrack, SAMPLE_RATE } from '../../utils/stemSeparator';
import {
  ALL_KEYS,
  camelot,
  cleanCorrection,
  correctedResultsCsv,
  createTapTempo,
  effectiveValues,
  formatBpm,
  KEYBPM_MAX_BYTES,
  KEYBPM_MAX_FILES,
  isDuplicateTrack,
  normalizeBpm,
  resultRow,
  tempoInterpretation,
} from './keyBpm';
import { createKeyBpmReport, parseKeyBpmReport, KEYBPM_REPORT_MAX_BYTES } from './keyBpmReport';
import { entryFile, useLockerOpen } from '../../suite/suiteKit';
import { offerToolHandoff, takeToolHandoff } from '../../utils/toolHandoff';
import { trackSiteEvent, trackSiteEventOnce } from '../../utils/siteMeasurement';
import HandoffNotice from '../../components/stems/HandoffNotice';
import ToolFeedback from '../../components/stems/ToolFeedback';
import {
  audioAllowance,
  clearKeyBpmRows,
  deleteKeyBpmRows,
  loadKeyBpmRows,
  rowRecord,
  saveKeyBpmRows,
} from './keyBpmStore';
import './keyBpm.css';

const LIMITS = [
  'Key is one global estimate per track (Sattari AutoKey). Key changes, modal or atonal music are not reported separately.',
  'BPM can land on half or double time. "Rough" means the strict estimator declined and a single 60-second pass was used, folded into 70–180 BPM.',
  '"Tentative" means the best key only narrowly beat the runner-up, which is shown as the alternative. In Sattari\'s own 17-recording test set, tentative keys were exact only 1 time in 7, while supported keys were exact 5 times in 6: check a tentative key and its alternative by ear. A small set, not a genre benchmark.',
  'Your corrections are labels on the result. They do not stretch, speed up or transpose the audio.',
  'Up to 10 minutes and 200 MB per file, mono or stereo, in formats your browser can decode.',
  'Results are saved in this browser (not a backup; browsers can clear it). Reports and CSV contain no audio; choose the source files again to listen or re-measure rows without audio.',
  "Benchmarked on generated songs and Sattari's own lesson recordings (docs/qualification), not yet on a licensed set of commercial songs across genres: treat values as starting points.",
];

const SOURCE_LABEL = {
  detected: 'Detected',
  half: 'Half time',
  double: 'Double time',
  tap: 'Tapped',
  manual: 'Typed',
  user: 'Your key',
};

const camelotValue = (code) => (code ? parseInt(code, 10) * 2 + (code.endsWith('B') ? 1 : 0) : 1e9);
const SORTS = {
  added: () => 0,
  bpm: (a, b) =>
    (effectiveValues(a.result, a.user).bpm ?? 1e9) - (effectiveValues(b.result, b.user).bpm ?? 1e9),
  camelot: (a, b) =>
    camelotValue(effectiveValues(a.result, a.user).camelot) -
    camelotValue(effectiveValues(b.result, b.user).camelot),
  name: (a, b) => a.file.name.localeCompare(b.file.name),
};

const hasAudio = (row) => row.file instanceof Blob && !row.fromReport;

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
      // A late reply for another (stopped or replaced) track is ignored.
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

function CorrectionEditor({ row, onChange, onClose }) {
  const detected = row.result.bpm;
  const values = effectiveValues(row.result, row.user);
  const tapper = useRef(createTapTempo());
  const [tapped, setTapped] = useState({ count: 0, bpm: null });
  const [typed, setTyped] = useState(
    row.user?.bpmChoice === 'manual' ? formatBpm(row.user.bpm) : ''
  );
  const typedBpm = normalizeBpm(typed);
  const set = (patch) =>
    onChange(
      cleanCorrection({ ...(row.user || {}), ...patch, editedAt: new Date().toISOString() })
    );
  const choice = row.user?.bpm != null ? row.user.bpmChoice : 'detected';
  return (
    <div className="kb-editor" role="group" aria-label={`Adjust ${row.file.name}`}>
      <fieldset>
        <legend>Tempo</legend>
        {detected !== null ? (
          <div className="kb-segment" role="group" aria-label="Tempo interpretation">
            {['detected', 'half', 'double'].map((option) => {
              const bpm = tempoInterpretation(detected, option);
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={choice === option}
                  disabled={bpm === null}
                  onClick={() =>
                    set(
                      option === 'detected'
                        ? { bpm: null, bpmChoice: null }
                        : { bpm, bpmChoice: option }
                    )
                  }
                >
                  {SOURCE_LABEL[option]} <strong>{bpm === null ? '—' : formatBpm(bpm)}</strong>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="alab-note">No tempo was detected. Tap or type one.</p>
        )}
        <div className="kb-tap">
          <button
            type="button"
            className="alab-button"
            onClick={() => {
              const bpm = tapper.current.tap();
              setTapped({ count: tapper.current.count(), bpm });
            }}
            aria-describedby={`${row.id}-tap-help`}
          >
            Tap
          </button>
          <span id={`${row.id}-tap-help`} className="alab-note" aria-live="polite">
            {tapped.bpm
              ? `${formatBpm(tapped.bpm)} BPM from ${tapped.count} taps`
              : tapped.count
                ? `${tapped.count} tap${tapped.count === 1 ? '' : 's'} · keep going`
                : 'Tap along with the beat (Enter or Space works too).'}
          </span>
          <button
            type="button"
            className="alab-text-button"
            disabled={!tapped.bpm}
            onClick={() => {
              set({ bpm: tapped.bpm, bpmChoice: 'tap' });
              tapper.current.reset();
              setTapped({ count: 0, bpm: null });
            }}
          >
            Use tapped tempo
          </button>
        </div>
        <form
          className="kb-manual"
          onSubmit={(event) => {
            event.preventDefault();
            if (typedBpm !== null) set({ bpm: typedBpm, bpmChoice: 'manual' });
          }}
        >
          <label>
            Type BPM
            <input
              inputMode="decimal"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              aria-invalid={typed !== '' && typedBpm === null}
              aria-describedby={`${row.id}-bpm-help`}
            />
          </label>
          <button type="submit" className="alab-text-button" disabled={typedBpm === null}>
            Apply
          </button>
          <small id={`${row.id}-bpm-help`} className="alab-note">
            {typed !== '' && typedBpm === null
              ? 'Enter a number from 20 to 400, for example 92 or 87.5.'
              : '20–400, up to two decimals.'}
          </small>
        </form>
      </fieldset>
      <fieldset>
        <legend>Key</legend>
        <label className="kb-key">
          <span className="alab-visually-hidden">Key</span>
          <select
            value={row.user?.key || ''}
            onChange={(event) => set({ key: event.target.value || null })}
          >
            <option value="">
              {row.result.key
                ? `Detected: ${row.result.key} (${row.result.camelot})`
                : 'No key detected'}
            </option>
            {ALL_KEYS.map((key) => (
              <option key={key} value={key}>
                {key} ({camelot(key)})
              </option>
            ))}
          </select>
        </label>
        {row.result.alternative && (
          <button
            type="button"
            className="alab-text-button"
            onClick={() => set({ key: row.result.alternative })}
          >
            Use the alternative: {row.result.alternative} ({camelot(row.result.alternative)})
          </button>
        )}
      </fieldset>
      <div className="kb-editor-foot">
        <span className="alab-note">
          Showing {values.key || 'no key'}
          {values.bpm !== null ? ` · ${formatBpm(values.bpm)} BPM` : ''}. Detected values are kept
          and exported alongside.
        </span>
        <button
          type="button"
          className="alab-text-button"
          disabled={!row.user?.key && row.user?.bpm == null}
          onClick={() => {
            // Your notes stay; only the key and tempo go back to the detection.
            onChange(cleanCorrection(row.user?.notes ? { notes: row.user.notes } : null));
            setTyped('');
          }}
        >
          Reset to detected
        </button>
        <button type="button" className="alab-button" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

export default function KeyBpmPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [running, setRunning] = useState(false);
  const [sort, setSort] = useState('added');
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(null);
  const [received, setReceived] = useState(null);
  const [loadingExample, setLoadingExample] = useState(false);
  const [audition, setAudition] = useState({ id: null, playing: false, time: 0, duration: 0 });
  const [focusId, setFocusId] = useState(null);
  const imports = useRef(Promise.resolve());
  const pendingImports = useRef(0);
  const reportPicker = useRef(null);
  const readingReport = useRef(false);
  const rowsRef = useRef([]);
  const worker = useRef(null);
  const controller = useRef(null);
  const mounted = useRef(true);
  const audio = useRef(null);
  const auditionUrl = useRef(null);
  const handoff = useRef(undefined);
  const [storageNote, setStorageNote] = useState('');
  const saved = useRef(new Map());
  const saveTimer = useRef(null);
  const clearedBeforeRestore = useRef(false);

  // Mirror the list into browser storage: write changed rows, delete removed
  // ones. Failures never block measuring; they are reported once in the page.
  const flush = () => {
    const current = rowsRef.current;
    const keep = audioAllowance(current);
    const changed = [];
    current.forEach((row, order) => {
      const previous = saved.current.get(row.id);
      const keepAudio = keep.has(row.id);
      if (previous?.row === row && previous.keepAudio === keepAudio && previous.order === order)
        return;
      changed.push(rowRecord(row, order, keepAudio));
      saved.current.set(row.id, { row, keepAudio, order });
    });
    const ids = new Set(current.map((row) => row.id));
    const removed = [...saved.current.keys()].filter((id) => !ids.has(id));
    removed.forEach((id) => saved.current.delete(id));
    const fail = () =>
      mounted.current &&
      setStorageNote(
        'Results could not be saved in this browser. They stay in this tab; save a report to keep them.'
      );
    if (changed.length) saveKeyBpmRows(changed).catch(fail);
    if (removed.length) deleteKeyBpmRows(removed).catch(fail);
  };
  const publish = (next) => {
    rowsRef.current = next;
    if (mounted.current) setRows(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 300);
  };
  const update = (id, patch) =>
    publish(rowsRef.current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const stopAudition = () => {
    audio.current?.pause();
    audio.current?.removeAttribute('src');
    if (auditionUrl.current) URL.revokeObjectURL(auditionUrl.current);
    auditionUrl.current = null;
    setAudition({ id: null, playing: false, time: 0, duration: 0 });
  };

  useEffect(() => {
    mounted.current = true;
    const element = audio.current;
    let live = true;
    loadKeyBpmRows()
      .then(({ rows: restored, skipped }) => {
        if (!live) return;
        if (clearedBeforeRestore.current) {
          clearKeyBpmRows().catch(() => {});
          return;
        }
        // Rows added before storage answered stay after the restored ones.
        const present = new Set(rowsRef.current.map((row) => row.id));
        const room = Math.max(0, KEYBPM_MAX_FILES - rowsRef.current.length);
        const kept = restored.filter((row) => !present.has(row.id)).slice(0, room);
        kept.forEach((row, order) =>
          saved.current.set(row.id, {
            row,
            keepAudio: !row.audioNotSaved && !row.fromReport,
            order,
          })
        );
        if (kept.length) publish([...kept, ...rowsRef.current]);
        if (skipped)
          setStorageNote(`${skipped} saved result(s) could not be restored and were left out.`);
      })
      .catch(() => {
        if (live)
          setStorageNote(
            'Saved results could not be opened in this browser. New results stay in this tab; save a report to keep them.'
          );
      });
    return () => {
      live = false;
      clearTimeout(saveTimer.current);
      if (mounted.current) flush();
      mounted.current = false;
      controller.current?.abort();
      worker.current?.terminate();
      element?.pause();
      if (auditionUrl.current) URL.revokeObjectURL(auditionUrl.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only restore

  // Stop listening to a row that no longer exists (cleared or replaced).
  useEffect(() => {
    if (audition.id && !rows.some((row) => row.id === audition.id)) stopAudition();
  }, [rows, audition.id]);

  const runQueue = async () => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    const batch = crypto.randomUUID();
    let measured = 0;
    let failed = 0;
    trackSiteEventOnce(`${batch}:start`, 'keybpm_started');
    try {
      for (;;) {
        const row = rowsRef.current.find((item) => item.status === 'queued');
        if (!row || abort.signal.aborted) break;
        update(row.id, { status: 'analyzing' });
        try {
          const decoded = await decodeTrack(row.file, abort.signal);
          worker.current ||= createWorker();
          const { analysis, rough } = await analyzeInWorker(
            worker.current,
            row.id,
            decoded,
            abort.signal
          );
          // The row may have been cleared while the worker was busy.
          if (!rowsRef.current.some((item) => item.id === row.id)) continue;
          const result = resultRow(row.file.name, analysis, rough);
          if (result.status === 'done') measured++;
          else failed++;
          update(row.id, { status: result.status, result, measuredAt: new Date().toISOString() });
        } catch (error) {
          if (abort.signal.aborted) {
            update(row.id, { status: 'queued' });
            break;
          }
          failed++;
          worker.current?.terminate();
          worker.current = null;
          update(row.id, {
            status: 'error',
            measuredAt: new Date().toISOString(),
            result: { file: row.file.name, status: 'error', note: error.message },
          });
        }
      }
    } finally {
      // Batch-level outcome: up to 200 tracks per list would otherwise exceed
      // the collector's rate limit and say nothing more useful.
      trackSiteEventOnce(
        `${batch}:end`,
        abort.signal.aborted
          ? 'keybpm_cancelled'
          : measured
            ? 'keybpm_completed'
            : failed
              ? 'keybpm_failed'
              : 'keybpm_cancelled'
      );
      controller.current = null;
      if (mounted.current) setRunning(false);
    }
  };

  const addFiles = (files, origin = null, user = null) => {
    pendingImports.current++;
    setChecking(true);
    imports.current = imports.current
      .then(async () => {
        const issues = [],
          added = [];
        for (const file of files) {
          if (!mounted.current) return;
          if (!isAudioFile(file)) issues.push(`${file.name}: not an audio file.`);
          else if (file.size > KEYBPM_MAX_BYTES) issues.push(`${file.name}: larger than 200 MB.`);
          else if (rowsRef.current.length + added.length >= KEYBPM_MAX_FILES)
            issues.push(`${file.name}: the list holds up to ${KEYBPM_MAX_FILES} tracks.`);
          else {
            try {
              if (
                await isDuplicateTrack(
                  file,
                  [...rowsRef.current, ...added].map((row) => row.file)
                )
              )
                issues.push(`${file.name}: identical audio is already in the list.`);
              else
                added.push({
                  id: crypto.randomUUID(),
                  file,
                  status: 'queued',
                  result: null,
                  ...(origin ? { origin } : {}),
                  ...(user ? { user, userFrom: origin?.from } : {}),
                });
            } catch {
              issues.push(`${file.name}: could not read this file. Choose it again.`);
            }
          }
        }
        if (!mounted.current) return;
        // Another intake path may have opened a report while a fingerprint was
        // being read. Recheck against the current list before this atomic publish.
        const available = Math.max(0, KEYBPM_MAX_FILES - rowsRef.current.length);
        for (const row of added.splice(available))
          issues.push(`${row.file.name}: the list holds up to ${KEYBPM_MAX_FILES} tracks.`);
        setErrors(issues);
        if (added.length) {
          publish([...rowsRef.current, ...added]);
          void runQueue();
        }
        return added.length;
      })
      .finally(() => {
        pendingImports.current--;
        if (mounted.current) setChecking(pendingImports.current > 0 || readingReport.current);
      });
    return imports.current;
  };
  // Audio sent from the Locker or another suite app (?tcc-open=).
  useLockerOpen('key-bpm', (entry) => addFiles([entryFile(entry)]));

  // A same-tab transfer from Stem Separator, consumed once.
  useEffect(() => {
    if (handoff.current === undefined) handoff.current = takeToolHandoff('keybpm');
    const offer = handoff.current;
    if (!offer || offer.consumed) return;
    offer.consumed = true;
    const user = cleanCorrection(offer.user ? { ...offer.user, bpmChoice: 'manual' } : null);
    void addFiles(
      [offer.file],
      { from: offer.from, kind: offer.kind, label: offer.label },
      user
    ).then((count) => mounted.current && setReceived({ ...offer, added: count > 0 }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadExample = async () => {
    if (loadingExample) return;
    setLoadingExample(true);
    try {
      const response = await fetch('/audio/sattari-practice-demo.wav');
      if (!response.ok)
        throw new Error('The example could not load. Choose an audio file instead.');
      const blob = await response.blob();
      await addFiles([
        new File([blob], 'sattari-practice-demo.wav', { type: 'audio/wav', lastModified: 0 }),
      ]);
    } catch (error) {
      if (mounted.current)
        setErrors([
          error instanceof TypeError
            ? 'The example needs an internet connection. Add a song from this device instead.'
            : error.message,
        ]);
    } finally {
      if (mounted.current) setLoadingExample(false);
    }
  };

  const stop = () => {
    controller.current?.abort();
    worker.current?.terminate();
    worker.current = null;
  };

  const openReport = async (file) => {
    if (!file || running || checking) return;
    readingReport.current = true;
    setChecking(true);
    try {
      if (file.size > KEYBPM_REPORT_MAX_BYTES)
        throw new Error('Report exceeds the 2 MB limit. Existing tracks were not changed.');
      const report = parseKeyBpmReport(await file.text());
      if (rowsRef.current.length + report.tracks.length > KEYBPM_MAX_FILES)
        throw new Error(
          'Opening this report would exceed 200 tracks. Export current work and clear the list first.'
        );
      if (!mounted.current) return;
      const restored = report.tracks.map((track) => ({
        id: crypto.randomUUID(),
        file: track.source,
        result: track.result,
        status: track.result.status,
        measuredAt: track.measuredAt,
        fromReport: true,
        ...(track.user ? { user: track.user } : {}),
        ...(track.origin ? { origin: track.origin } : {}),
      }));
      publish([...rowsRef.current, ...restored]);
      setErrors([]);
    } catch (error) {
      if (mounted.current)
        setErrors([error.message || 'Report could not be read. Existing tracks were not changed.']);
    } finally {
      readingReport.current = false;
      if (mounted.current) setChecking(pendingImports.current > 0);
    }
  };
  const saveReport = () => {
    try {
      downloadBlob(
        new Blob([createKeyBpmReport(rowsRef.current.filter((row) => row.result))], {
          type: 'application/json',
        }),
        'sattari-key-bpm.keybpm.json'
      );
      trackSiteEvent('keybpm_report_exported');
      setErrors([]);
    } catch (error) {
      setErrors([error.message]);
    }
  };

  const toggleAudition = async (row) => {
    const element = audio.current;
    if (!element || !hasAudio(row)) return;
    if (audition.id === row.id) {
      if (element.paused) await element.play().catch(() => {});
      else element.pause();
      return;
    }
    stopAudition();
    setFocusId(row.id);
    const url = URL.createObjectURL(row.file);
    auditionUrl.current = url;
    element.src = url;
    setAudition({ id: row.id, playing: false, time: 0, duration: row.result?.duration || 0 });
    trackSiteEventOnce(`${row.id}:preview`, 'keybpm_preview');
    try {
      await element.play();
    } catch {
      if (mounted.current)
        setErrors([
          `${row.file.name}: this browser could not play the file. The measurement is unaffected.`,
        ]);
    }
  };

  const toSeparator = (row) => {
    const values = effectiveValues(row.result, row.user);
    offerToolHandoff({
      target: 'separator',
      from: 'Key & BPM',
      file: row.file,
      kind: row.origin?.kind || 'original',
      label: row.origin?.label || row.file.name,
      detected: { key: row.result?.key || null, bpm: row.result?.bpm ?? null },
      user: row.user ? { key: row.user.key ? values.key : null, bpm: row.user.bpm ?? null } : null,
    });
    trackSiteEvent('continue_to_separator');
    navigate('/stem-separator');
  };

  const done = rows.filter((row) => row.result);
  const sorted = useMemo(() => [...rows].sort(SORTS[sort]), [rows, sort]);
  const remaining = rows.filter((row) => row.status === 'queued' || row.status === 'analyzing');
  // The large readout shows the chosen track, else the one playing, else the
  // most recently measured one.
  const focusRow =
    rows.find((row) => row.id === focusId && row.status === 'done') ||
    rows.find((row) => row.id === audition.id && row.status === 'done') ||
    [...rows].reverse().find((row) => row.status === 'done');

  return (
    <AudioLabShell
      tool="keybpm"
      title="Key & BPM"
      badge="Beta"
      eyebrow="Sattari Music"
      summary="Find the key, Camelot code and tempo of one song or a whole folder. Listen back, fix half- or double-time, tap the beat, and save the values you trust."
      description="Detect the musical key, Camelot code and BPM of one or many tracks in your browser. Audition each song, correct half/double tempo or the key, and export CSV or a report."
      limits={LIMITS}
      limitsTitle="What the estimates can and cannot tell you"
      related={{ path: '/stem-separator', label: 'Stem Separator' }}
    >
      <div className="alab-workspace">
        {received && <HandoffNotice handoff={received} destination="Key & BPM" />}
        <LabDrop
          title="Add tracks"
          hint="Drop one song or many · WAV, MP3, FLAC, M4A, OGG · up to 10 min each · measured on this device, nothing is uploaded"
          multiple
          disabled={checking}
          onFiles={addFiles}
        >
          <button
            type="button"
            className="alab-text-button"
            disabled={checking || loadingExample}
            onClick={() => void loadExample()}
            title="An 8-second original Sattari practice mix, measured by the real analyzer"
          >
            <AudioLines size={15} aria-hidden="true" /> Try the 8-second example
          </button>
        </LabDrop>
        {errors.length > 0 && (
          <div className="alab-error" role="alert">
            {errors.slice(0, 6).map((error) => (
              <p key={error}>{error}</p>
            ))}
            {errors.length > 6 && <p>…and {errors.length - 6} more.</p>}
          </div>
        )}
        <input
          ref={reportPicker}
          type="file"
          className="alab-file-input"
          accept=".json,application/json"
          aria-label="Open analysis report"
          disabled={running || checking}
          onChange={(event) => {
            void openReport(event.target.files[0]);
            event.target.value = '';
          }}
        />

        <audio
          ref={audio}
          preload="metadata"
          onPlay={() => setAudition((current) => ({ ...current, playing: true }))}
          onPause={() => setAudition((current) => ({ ...current, playing: false }))}
          onEnded={() => setAudition((current) => ({ ...current, playing: false }))}
          onTimeUpdate={(event) => {
            const time = event.currentTarget.currentTime;
            setAudition((current) => ({ ...current, time }));
          }}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value)) setAudition((current) => ({ ...current, duration: value }));
          }}
        />
        {focusRow && (
          <KeyReadout
            row={focusRow}
            audition={audition}
            playable={hasAudio(focusRow)}
            onToggleAudition={() => void toggleAudition(focusRow)}
            onSeek={(value) => {
              if (audio.current) audio.current.currentTime = value;
              setAudition((current) => ({ ...current, time: value }));
            }}
            onCorrect={(user) => {
              update(focusRow.id, { user, userFrom: undefined });
              if (user) trackSiteEventOnce(`${focusRow.id}:corrected`, 'keybpm_corrected');
            }}
            onSeparate={() => toSeparator(focusRow)}
          />
        )}

        <div className="alab-toolbar">
          <h2>
            Tracks <span>{rows.length}</span>
          </h2>
          <div className="alab-toolbar-actions">
            {checking && <span role="status">Checking files…</span>}
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
              className="alab-text-button"
              disabled={running || checking}
              onClick={() => reportPicker.current?.click()}
            >
              <FolderOpen size={16} aria-hidden="true" /> Open report
            </button>
            <button
              type="button"
              className="alab-button"
              disabled={!done.length}
              onClick={saveReport}
            >
              <Save size={16} aria-hidden="true" /> Save report
            </button>
            <button
              type="button"
              className="alab-button"
              disabled={!done.length}
              onClick={() => {
                downloadBlob(
                  new Blob([correctedResultsCsv(done)], { type: 'text/csv;charset=utf-8' }),
                  'sattari-key-bpm.csv'
                );
                trackSiteEvent('keybpm_csv_exported');
              }}
            >
              <Download size={16} aria-hidden="true" /> Export CSV
            </button>
            <button
              type="button"
              className="alab-text-button"
              disabled={running || checking || !rows.length}
              onClick={() => {
                setEditing(null);
                clearedBeforeRestore.current = true;
                publish([]);
                clearTimeout(saveTimer.current);
                saved.current.clear();
                clearKeyBpmRows()
                  .then(() => mounted.current && setStorageNote(''))
                  .catch(() => {});
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> Clear
            </button>
          </div>
        </div>
        <p className="alab-note">
          Results and your corrections are saved in this browser, so a reload keeps them. Clear
          removes them. Browsers can clear this storage, so save a report or CSV to keep a copy.
          Very large folders keep their results but not every audio file.
        </p>
        {storageNote && (
          <p className="kb-storage-note" role="status">
            {storageNote}
          </p>
        )}
        {rows.length === 0 ? (
          <p className="alab-empty">
            No tracks yet. Add a song or try the example; each result appears here as it is
            measured.
          </p>
        ) : (
          <div
            className="alab-table-wrap"
            role="region"
            aria-label="Track analysis results"
            tabIndex={0}
            onKeyDown={(event) => {
              if (
                event.target !== event.currentTarget ||
                !['ArrowLeft', 'ArrowRight'].includes(event.key)
              )
                return;
              const region = event.currentTarget;
              if (region.scrollWidth <= region.clientWidth) return;
              event.preventDefault();
              region.scrollBy({ left: event.key === 'ArrowRight' ? 80 : -80 });
            }}
          >
            <table className="alab-table kb-table">
              <thead>
                <tr>
                  <th scope="col">Track</th>
                  <th scope="col">Length</th>
                  <th scope="col">Key</th>
                  <th scope="col">Camelot</th>
                  <th scope="col">BPM</th>
                  <th scope="col">Level</th>
                  <th scope="col">Notes</th>
                  <th scope="col">
                    <span className="alab-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const { id, file, status, result, fromReport, origin } = row;
                  const values = status === 'done' ? effectiveValues(result, row.user) : null;
                  const playable = hasAudio(row);
                  return [
                    <tr
                      key={id}
                      data-status={status}
                      className={focusRow?.id === id ? 'is-focused' : undefined}
                    >
                      <th scope="row" title={file.name}>
                        {status === 'done' ? (
                          <button
                            type="button"
                            className="kb-row-name"
                            aria-current={focusRow?.id === id ? 'true' : undefined}
                            onClick={() => setFocusId(id)}
                          >
                            {file.name}
                          </button>
                        ) : (
                          file.name
                        )}
                        {origin && (
                          <small className="alab-flag">
                            {origin.label === file.name
                              ? `From ${origin.from || 'another tool'}`
                              : origin.label}
                          </small>
                        )}
                        {fromReport && (
                          <small className="alab-flag">Report · audio not included</small>
                        )}
                        {row.audioNotSaved && (
                          <small className="alab-flag">Saved result · audio not kept</small>
                        )}
                      </th>
                      {status === 'done' ? (
                        <>
                          <td>{formatTime(result.duration)}</td>
                          <td>
                            {values.key || '—'}
                            {values.keySource === 'user' ? (
                              <small className="kb-flag-user">
                                yours · detected {result.key || 'none'}
                              </small>
                            ) : (
                              result.key &&
                              result.keyEvidence === 'tentative' && (
                                <small
                                  className="alab-flag"
                                  title={`Close call. Check by ear: the alternative is ${result.alternative}.`}
                                >
                                  tentative · or {result.alternative}
                                </small>
                              )
                            )}
                          </td>
                          <td>{values.camelot || '—'}</td>
                          <td>
                            {values.bpm === null ? '—' : formatBpm(values.bpm)}
                            {values.bpmSource !== 'detected' ? (
                              <small className="kb-flag-user">
                                {SOURCE_LABEL[values.bpmSource].toLowerCase()} · detected{' '}
                                {result.bpm ?? 'none'}
                              </small>
                            ) : (
                              result.bpm !== null &&
                              result.tempoEvidence !== 'supported' && (
                                <small className="alab-flag">{result.tempoEvidence}</small>
                              )
                            )}
                          </td>
                          <td>{result.rmsDb === null ? '—' : `${result.rmsDb} dB RMS`}</td>
                          <td className="alab-note">
                            {row.user?.notes && (
                              <span className="kb-row-notes">{row.user.notes} </span>
                            )}
                            {result.alternative && `Alt. ${result.alternative}. `}
                            {result.note}
                            {row.userFrom && ` Your values from ${row.userFrom}.`}
                          </td>
                          <td className="kb-actions">
                            <button
                              type="button"
                              className="kb-icon"
                              disabled={!playable}
                              aria-pressed={audition.id === id && audition.playing}
                              aria-label={
                                playable
                                  ? `${audition.id === id && audition.playing ? 'Pause' : 'Play'} ${file.name}`
                                  : `${file.name}: choose the source file again to listen`
                              }
                              title={
                                playable
                                  ? 'Listen to the original audio'
                                  : 'No audio is available for this row. Add the source file to listen or re-measure.'
                              }
                              onClick={() => void toggleAudition(row)}
                            >
                              {audition.id === id && audition.playing ? (
                                <Pause size={15} aria-hidden="true" />
                              ) : (
                                <Play size={15} aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="kb-icon"
                              aria-expanded={editing === id}
                              aria-label={`Adjust key and tempo for ${file.name}`}
                              title="Adjust key and tempo"
                              onClick={() => setEditing(editing === id ? null : id)}
                            >
                              <SlidersHorizontal size={15} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="kb-icon"
                              disabled={!playable}
                              aria-label={`Separate stems of ${file.name}`}
                              title={
                                playable
                                  ? 'Continue in Stem Separator'
                                  : 'Add the source file to separate it'
                              }
                              onClick={() => toSeparator(row)}
                            >
                              <Layers size={15} aria-hidden="true" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <td colSpan={7} className="alab-note">
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
                    </tr>,
                    editing === id && status === 'done' && (
                      <tr key={`${id}-edit`} className="kb-edit-row">
                        <td colSpan={8}>
                          <CorrectionEditor
                            row={row}
                            onClose={() => setEditing(null)}
                            onChange={(user) => {
                              update(id, { user, userFrom: undefined });
                              if (user) trackSiteEventOnce(`${id}:corrected`, 'keybpm_corrected');
                            }}
                          />
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="alab-note">
          Need the parts? <Link to="/stem-separator">Stem Separator</Link> splits a song into
          vocals, drums, bass and other instruments and renders practice mixes. Read{' '}
          <Link to="/guides/find-song-key-and-bpm">
            how to read key estimates and half/double BPM
          </Link>
          . <Link to="/tools/key-bpm">Formats, privacy &amp; limits</Link>.
        </p>
        <ToolFeedback tool="Key & BPM" />
      </div>
    </AudioLabShell>
  );
}
