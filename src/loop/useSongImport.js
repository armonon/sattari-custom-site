import { useCallback, useEffect, useRef, useState } from 'react';
import { StemSeparatorClient } from '../utils/stemSeparatorClient';
import { analysisMono, validateSongFile } from './importAudio';
import { keyResample } from './autoKey';
import { trackSiteEvent } from '../utils/siteMeasurement';

function dispose(job) {
  if (job) job.finished = true;
  job?.controller.abort();
  job?.separator?.dispose();
  job?.worker?.terminate();
  clearTimeout(job?.timeout);
}

export default function useSongImport(onReady) {
  const job = useRef(null);
  const sequence = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const cancel = useCallback(() => {
    sequence.current++;
    dispose(job.current);
    job.current = null;
    setProgress(null);
  }, []);

  const importSong = useCallback(
    async (file, { preparation = 'solo', detail = 'melody' } = {}) => {
      cancel();
      setError('');
      if (!file) return;
      const validation = validateSongFile(file);
      if (validation) {
        setError(validation);
        return;
      }
      const token = sequence.current;
      const task = { controller: new AbortController() };
      job.current = task;
      trackSiteEvent('learn_started');
      const separated = preparation === 'instruments';
      setProgress({ value: 2, label: 'Reading your song' });
      try {
        const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OfflineContext)
          throw new Error(
            'Your browser does not support audio decoding. Try a current version of Chrome or Safari.'
          );
        const analysisRate = detail === 'harmony' ? 22050 : 16000;
        const context = new OfflineContext(2, 1, separated ? 44100 : analysisRate);
        const bytes = await file.arrayBuffer();
        if (token !== sequence.current) return;
        let buffer = await context.decodeAudioData(bytes);
        if (token !== sequence.current) return;
        if (buffer.duration > 480)
          throw new Error('Choose a song under eight minutes for this first version.');
        if (buffer.duration < 0.5)
          throw new Error('This clip is too short. Choose at least half a second of audio.');
        if (buffer.numberOfChannels > 2) throw new Error('Choose a mono or stereo recording.');
        let samples = analysisMono(buffer),
          rate = buffer.sampleRate,
          practiceFile = null;
        let keySamples;
        if (separated) {
          keySamples = keyResample(samples, rate);
          samples = null;
          const audio = {
            left: buffer.getChannelData(0).slice(),
            right: buffer.getChannelData(buffer.numberOfChannels > 1 ? 1 : 0).slice(),
            channels: buffer.numberOfChannels,
          };
          buffer = null;
          task.separator = new StemSeparatorClient();
          setProgress({ value: 4, label: 'Preparing the instrumental part' });
          const outputs = await task.separator.separate(
            audio,
            ['other'],
            task.controller.signal,
            (status) => {
              if (token === sequence.current)
                setProgress({
                  value: status.progress == null ? null : 4 + status.progress * 65,
                  label: status.message,
                });
            }
          );
          task.separator.dispose();
          task.separator = null;
          if (token !== sequence.current) return;
          practiceFile = outputs.find((stem) => stem.id === 'other')?.blob;
          if (!(practiceFile instanceof Blob))
            throw new Error(
              'The instrumental part could not be prepared. Try again or analyze the original.'
            );
          setProgress({ value: 70, label: 'Listening to the instrumental part' });
          const decoder = new OfflineContext(2, 1, analysisRate);
          buffer = await decoder.decodeAudioData(await practiceFile.arrayBuffer());
          if (token !== sequence.current) return;
          samples = analysisMono(buffer);
          rate = buffer.sampleRate;
        }
        const worker = new Worker(new URL('./analysis.worker.js', import.meta.url), {
          type: 'module',
        });
        const finish = () => {
          dispose(task);
          if (job.current === task) job.current = null;
        };
        const expire = () => {
          if (token !== sequence.current || task.finished) return;
          finish();
          trackSiteEvent('learn_failed');
          setProgress(null);
          setError('Analysis took too long. Try a shorter clip.');
        };
        const touch = () => {
          clearTimeout(task.timeout);
          task.timeout = setTimeout(expire, 120000);
        };
        task.worker = worker;
        touch();
        worker.onmessage = ({ data }) => {
          if (token !== sequence.current || task.finished) return;
          if (data.progress) {
            touch();
            setProgress({
              ...data.progress,
              value: separated ? 70 + data.progress.value * 0.3 : data.progress.value,
            });
            return;
          }
          finish();
          setProgress(null);
          if (data.error) {
            trackSiteEvent('learn_failed');
            setError(data.error);
            return;
          }
          const lesson = {
            ...data.result,
            id: crypto.randomUUID(),
            title: file.name.replace(/\.[^.]+$/, ''),
            artist: 'Your local recording',
          };
          setSelectedFile(null);
          trackSiteEvent('learn_completed');
          onReadyRef.current({ file, practiceFile, lesson });
        };
        worker.onerror = () => {
          if (token !== sequence.current || task.finished) return;
          finish();
          trackSiteEvent('learn_failed');
          setProgress(null);
          setError('The analysis could not finish. Try another audio file.');
        };
        worker.onmessageerror = worker.onerror;
        worker.postMessage(
          {
            samples,
            rate,
            detail,
            keySamples,
            keyRate: keySamples ? 16000 : rate,
            preparation: separated ? 'instruments' : 'original',
          },
          [samples.buffer, ...(keySamples ? [keySamples.buffer] : [])]
        );
      } catch (cause) {
        if (token !== sequence.current || task.finished) return;
        dispose(task);
        trackSiteEvent('learn_failed');
        job.current = null;
        setProgress(null);
        setError(
          cause.name === 'EncodingError'
            ? 'This audio format could not be decoded. Try an MP3 or WAV file.'
            : cause.message || 'Could not read this audio file.'
        );
      }
    },
    [cancel]
  );

  useEffect(
    () => () => {
      sequence.current++;
      dispose(job.current);
    },
    []
  );
  const selectFile = (file) => {
    cancel();
    const validation = validateSongFile(file);
    setError(validation);
    setSelectedFile(validation ? null : file);
  };
  return {
    importSong,
    selectFile,
    selectedFile,
    cancel,
    progress,
    error,
    clearError: () => setError(''),
  };
}
