import { useEffect, useRef, useState } from 'react';
import {
  decodeTrack,
  fileKey,
  LIMITS,
  SAMPLE_RATE,
  safeTrackName,
  selectedStemIds,
  STEMS,
  validateFiles,
} from '../utils/stemSeparator';
import { StemSeparatorClient } from '../utils/stemSeparatorClient';
import { trackSiteEventOnce } from '../utils/siteMeasurement';
import {
  clearSplitSessions,
  deleteSplitSession,
  loadSplitSessions,
  saveSplitSession,
} from '../utils/splitSessionStore';

const release = (job) => {
  job.outputs?.forEach(({ url }) => URL.revokeObjectURL(url));
  job.preview?.outputs.forEach(({ url }) => URL.revokeObjectURL(url));
};

// "Hear something sooner": separate a short section first so the musician can
// listen while the whole song is processed. Only worth it for longer songs.
export const PREVIEW_SECONDS = 20;
export const PREVIEW_MIN_SONG_SECONDS = 45;
export function previewWindow(duration) {
  if (!(duration >= PREVIEW_MIN_SONG_SECONDS)) return null;
  const start = Math.min(Math.max(0, duration * 0.3), duration - PREVIEW_SECONDS);
  return { start: Math.round(start * 10) / 10, duration: PREVIEW_SECONDS };
}

export default function useStemSeparator() {
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(STEMS.map((stem) => stem.id));
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState([]);
  const [cpuOnly, setCpuOnly] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [storageWarning, setStorageWarning] = useState('');
  const [goal, setGoal] = useState('all');
  const [restoring, setRestoring] = useState(true);
  const [quickPreview, setQuickPreview] = useState(true);
  const demo = useRef(null);
  const queue = useRef([]);
  const userChangedQueue = useRef(false);
  const replaceStoredOnRestore = useRef(false);
  const active = useRef(null);
  const client = useRef(null);
  const mounted = useRef(true);
  const persistenceTimer = useRef(null);

  const flushSave = (snapshot) => {
    snapshot.forEach((job) => {
      saveSplitSession(job).catch(() => {
        if (mounted.current)
          setStorageWarning(
            'Results are available in this tab, but browser storage could not save them. Download the WAVs before leaving.'
          );
      });
    });
  };
  const publish = (next, immediate = false) => {
    const nextIds = new Set(next.map((job) => job.id));
    queue.current
      .filter((job) => !nextIds.has(job.id))
      .forEach((job) => {
        deleteSplitSession(job.id).catch(() => {
          if (mounted.current)
            setStorageWarning('A previous result could not be removed from browser storage.');
        });
      });
    queue.current = next;
    if (mounted.current) setJobs(next);
    clearTimeout(persistenceTimer.current);
    if (immediate) flushSave(next);
    else persistenceTimer.current = setTimeout(() => flushSave(queue.current), 350);
  };
  const update = (id, patch) =>
    publish(
      queue.current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
      ['done', 'error', 'cancelled'].includes(patch.status)
    );

  useEffect(() => {
    mounted.current = true;
    let activeEffect = true;
    loadSplitSessions()
      .then(({ sessions, warnings }) => {
        if (warnings.length && activeEffect)
          setStorageWarning(
            `${warnings.length} saved Split session(s) could not be restored. The records remain untouched.`
          );
        if (!activeEffect || replaceStoredOnRestore.current) {
          sessions.forEach(release);
          if (activeEffect)
            sessions.forEach(({ id }) =>
              deleteSplitSession(id).catch(() => {
                if (mounted.current)
                  setStorageWarning(
                    'A cleared song could not be removed from browser storage. Use Clear saved work again.'
                  );
              })
            );
          return;
        }
        // Files added while storage was still opening are kept after the
        // restored songs instead of either silently replacing the other.
        const present = new Set(queue.current.map((job) => job.id));
        const restored = sessions.filter((job) => !present.has(job.id));
        const restoredFiles = new Set(restored.map((job) => fileKey(job.file)));
        const duplicate = (job) => job.status === 'queued' && restoredFiles.has(fileKey(job.file));
        queue.current
          .filter(duplicate)
          .forEach((job) => deleteSplitSession(job.id).catch(() => {}));
        queue.current = queue.current.filter((job) => !duplicate(job));
        const room = Math.max(0, LIMITS.tracks - queue.current.length);
        restored.slice(room).forEach(release);
        queue.current = [...restored.slice(0, room), ...queue.current];
        setJobs(queue.current);
      })
      .catch(() => {
        if (activeEffect)
          setStorageWarning(
            'Saved work could not be opened in this browser. New results stay available in this tab; download what you need.'
          );
      })
      .finally(() => {
        if (activeEffect) setRestoring(false);
      });
    const warn = (event) => {
      if (active.current || queue.current.some((job) => job.status === 'done')) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      activeEffect = false;
      clearTimeout(persistenceTimer.current);
      mounted.current = false;
      active.current?.abort();
      demo.current?.abort();
      client.current?.dispose();
      queue.current.forEach(release);
      window.removeEventListener('beforeunload', warn);
    };
  }, []);

  // origin: optional same-tab handoff metadata ({ from, kind, label, user }).
  const addFiles = (files, origin = null) => {
    if (active.current) return [];
    const { accepted, errors: issues } = validateFiles(Array.from(files), queue.current);
    setErrors(issues);
    const added = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
      message: 'Queued',
      outputs: [],
      progress: null,
      ...(origin ? { origin } : {}),
    }));
    if (added.length) userChangedQueue.current = true;
    publish([...queue.current, ...added], true);
    return added;
  };

  const remove = (id) => {
    if (active.current) return;
    userChangedQueue.current = true;
    queue.current.filter((job) => job.id === id).forEach(release);
    publish(queue.current.filter((job) => job.id !== id));
  };

  const clearAll = () => {
    if (active.current) return;
    userChangedQueue.current = true;
    replaceStoredOnRestore.current = true;
    queue.current.forEach(release);
    publish([]);
  };

  // Removes this tool's saved songs from the browser, including records that
  // could not be restored. Resolves to true when storage confirmed the clear.
  const clearSaved = async () => {
    if (active.current) return false;
    clearAll();
    try {
      await clearSplitSessions();
      if (mounted.current) setStorageWarning('');
      return true;
    } catch {
      if (mounted.current)
        setStorageWarning(
          'Browser storage did not confirm the removal. Clear this site’s data in browser settings to be sure.'
        );
      return false;
    }
  };

  const clearFinished = () => {
    if (active.current) return;
    userChangedQueue.current = true;
    queue.current.filter((job) => job.status === 'done').forEach(release);
    publish(queue.current.filter((job) => job.status !== 'done'));
  };

  const run = async (onlyId, stemOverride = null) => {
    if (active.current) return;
    const stems = selectedStemIds(stemOverride || selected);
    const runGoal = goal;
    const batch = queue.current.filter(
      (job) => job.status !== 'done' && (!onlyId || job.id === onlyId)
    );
    if (!batch.length || !stems.length) return;
    const controller = new AbortController();
    active.current = controller;
    setRunning(true);
    setErrors([]);
    client.current = new StemSeparatorClient();
    try {
      for (const job of batch) {
        if (controller.signal.aborted) break;
        // Events are per track attempt; the attempt id prevents rerenders or
        // restored sessions from counting the same outcome twice.
        const attempt = crypto.randomUUID();
        trackSiteEventOnce(`${attempt}:start`, 'separator_started');
        update(job.id, {
          status: 'processing',
          message: 'Reading audio',
          progress: null,
          startedAt: Date.now(),
          stems,
          goal: runGoal,
        });
        try {
          const audio = await decodeTrack(job.file, controller.signal);
          const retainedBytes = queue.current.reduce(
            (sum, row) => sum + row.outputs.reduce((n, out) => n + out.blob.size, 0),
            0
          );
          if (retainedBytes + audio.left.length * 8 * stems.length > LIMITS.outputBytes) {
            throw new Error(
              'Result storage is full. Download and clear finished tracks, then retry.'
            );
          }
          update(job.id, { duration: audio.duration, peaks: audio.peaks });
          const section = quickPreview ? previewWindow(audio.duration) : null;
          if (section) {
            const from = Math.floor(section.start * SAMPLE_RATE);
            const to = from + Math.floor(section.duration * SAMPLE_RATE);
            try {
              const excerpt = await client.current.separate(
                {
                  left: audio.left.slice(from, to),
                  right: audio.right.slice(from, to),
                  channels: audio.channels,
                },
                stems,
                controller.signal,
                ({ message, progress }) =>
                  update(job.id, { message: `Preview section: ${message}`, progress }),
                () => {},
                cpuOnly
              );
              controller.signal.throwIfAborted();
              update(job.id, {
                preview: {
                  ...section,
                  outputs: excerpt.map((output) => ({
                    ...output,
                    url: URL.createObjectURL(output.blob),
                    name: `${safeTrackName(job.file.name)}-preview-${output.id}.wav`,
                  })),
                },
                message: 'Preview ready. Separating the whole song',
                progress: null,
              });
            } catch (error) {
              controller.signal.throwIfAborted();
              // A failed preview never blocks the full separation.
              void error;
            }
          }
          const result = await client.current.separate(
            audio,
            stems,
            controller.signal,
            ({ message, progress }) => update(job.id, { message, progress }),
            (analysis) => update(job.id, { analysis }),
            cpuOnly
          );
          controller.signal.throwIfAborted();
          const outputs = result.map((output) => ({
            ...output,
            url: URL.createObjectURL(output.blob),
            name: `${safeTrackName(job.file.name)}-${output.id === 'other' ? 'instruments' : output.id}.wav`,
          }));
          const finished = queue.current.find((row) => row.id === job.id);
          finished?.preview?.outputs.forEach(({ url }) => URL.revokeObjectURL(url));
          update(job.id, { status: 'done', message: 'Ready', progress: 1, outputs, preview: null });
          trackSiteEventOnce(`${attempt}:end`, 'separator_completed');
        } catch (error) {
          trackSiteEventOnce(
            `${attempt}:end`,
            controller.signal.aborted ? 'separator_cancelled' : 'separator_failed'
          );
          queue.current
            .find((row) => row.id === job.id)
            ?.preview?.outputs.forEach(({ url }) => URL.revokeObjectURL(url));
          update(job.id, {
            status: controller.signal.aborted ? 'cancelled' : 'error',
            message: controller.signal.aborted ? 'Cancelled' : error.message,
            progress: null,
            preview: null,
          });
        }
      }
    } finally {
      client.current?.dispose();
      client.current = null;
      active.current = null;
      if (mounted.current) setRunning(false);
    }
  };

  const loadDemo = async () => {
    if (active.current || demo.current || !selected.length) return;
    const controller = new AbortController();
    demo.current = controller;
    setLoadingDemo(true);
    setErrors([]);
    try {
      const response = await fetch('/audio/sattari-practice-demo.wav', {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('The demo could not load. Choose an audio file instead.');
      const blob = await response.blob();
      controller.signal.throwIfAborted();
      const [job] = addFiles([
        new File([blob], 'sattari-practice-demo.wav', { type: 'audio/wav', lastModified: 0 }),
      ]);
      if (job)
        await run(
          job.id,
          STEMS.map((stem) => stem.id)
        );
    } catch (error) {
      if (!controller.signal.aborted && mounted.current)
        setErrors([
          error instanceof TypeError
            ? 'The demo song needs an internet connection. Offline, add a song from this device.'
            : error.message,
        ]);
    } finally {
      demo.current = null;
      if (mounted.current) setLoadingDemo(false);
    }
  };

  return {
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
    clearAll,
    clearSaved,
    run,
    cancel: () => {
      demo.current?.abort();
      active.current?.abort();
    },
    storageWarning,
    goal,
    setGoal,
    restoring,
    quickPreview,
    setQuickPreview,
  };
}
