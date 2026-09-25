import { useEffect, useRef, useState } from 'react';
import {
  decodeTrack,
  LIMITS,
  safeTrackName,
  selectedStemIds,
  STEMS,
  validateFiles,
} from '../utils/stemSeparator';
import { StemSeparatorClient } from '../utils/stemSeparatorClient';
import { trackSiteEvent } from '../utils/siteMeasurement';

const release = (job) => job.outputs?.forEach(({ url }) => URL.revokeObjectURL(url));

export default function useStemSeparator() {
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(STEMS.map((stem) => stem.id));
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState([]);
  const queue = useRef([]);
  const active = useRef(null);
  const client = useRef(null);
  const mounted = useRef(true);

  const publish = (next) => {
    queue.current = next;
    if (mounted.current) setJobs(next);
  };
  const update = (id, patch) =>
    publish(queue.current.map((job) => (job.id === id ? { ...job, ...patch } : job)));

  useEffect(() => {
    mounted.current = true;
    const warn = (event) => {
      if (active.current || queue.current.some((job) => job.status === 'done')) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      mounted.current = false;
      active.current?.abort();
      client.current?.dispose();
      queue.current.forEach(release);
      window.removeEventListener('beforeunload', warn);
    };
  }, []);

  const addFiles = (files) => {
    if (active.current) return;
    const { accepted, errors: issues } = validateFiles(Array.from(files), queue.current);
    setErrors(issues);
    publish([
      ...queue.current,
      ...accepted.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: 'queued',
        message: 'Queued',
        outputs: [],
        progress: null,
      })),
    ]);
  };

  const remove = (id) => {
    if (active.current) return;
    queue.current.filter((job) => job.id === id).forEach(release);
    publish(queue.current.filter((job) => job.id !== id));
  };

  const clearFinished = () => {
    if (active.current) return;
    queue.current.filter((job) => job.status === 'done').forEach(release);
    publish(queue.current.filter((job) => job.status !== 'done'));
  };

  const run = async (onlyId) => {
    if (active.current) return;
    const stems = selectedStemIds(selected);
    const batch = queue.current.filter(
      (job) => job.status !== 'done' && (!onlyId || job.id === onlyId)
    );
    if (!batch.length || !stems.length) return;
    trackSiteEvent('separator_started');
    const controller = new AbortController();
    active.current = controller;
    setRunning(true);
    setErrors([]);
    client.current = new StemSeparatorClient();
    try {
      for (const job of batch) {
        if (controller.signal.aborted) break;
        update(job.id, { status: 'processing', message: 'Reading audio', progress: null, stems });
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
          const result = await client.current.separate(
            audio,
            stems,
            controller.signal,
            ({ message, progress }) => update(job.id, { message, progress })
          );
          controller.signal.throwIfAborted();
          const outputs = result.map((output) => ({
            ...output,
            url: URL.createObjectURL(output.blob),
            name: `${safeTrackName(job.file.name)}-${output.id === 'other' ? 'instruments' : output.id}.wav`,
          }));
          update(job.id, { status: 'done', message: 'Ready', progress: 1, outputs });
          trackSiteEvent('separator_completed');
        } catch (error) {
          if (!controller.signal.aborted) trackSiteEvent('separator_failed');
          update(job.id, {
            status: controller.signal.aborted ? 'cancelled' : 'error',
            message: controller.signal.aborted ? 'Cancelled' : error.message,
            progress: null,
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

  return {
    jobs,
    selected,
    setSelected,
    running,
    errors,
    addFiles,
    remove,
    clearFinished,
    run,
    cancel: () => active.current?.abort(),
  };
}
