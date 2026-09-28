import { useCallback, useEffect, useRef, useState } from 'react';

export default function useSongImport(onReady) {
  const job = useRef(null);
  const sequence = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const cancel = useCallback(() => {
    sequence.current++;
    if (job.current) {
      job.current.worker.terminate();
      clearTimeout(job.current.timeout);
      job.current = null;
    }
    setProgress(null);
  }, []);

  const importSong = useCallback(
    async (file) => {
      cancel();
      setError('');
      if (!file) return;
      if (
        !(file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac|aac|webm)$/i.test(file.name))
      ) {
        setError('Choose an audio file: MP3, WAV, M4A, OGG or FLAC.');
        return;
      }
      if (file.size > 40 * 1024 * 1024) {
        setError('Choose a file smaller than 40 MB for this first version.');
        return;
      }
      const token = sequence.current;
      setProgress({ value: 2, label: 'Reading your song' });
      try {
        const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OfflineContext)
          throw new Error(
            'Your browser does not support audio decoding. Try a current version of Chrome or Safari.'
          );
        const context = new OfflineContext(1, 1, 16000);
        const bytes = await file.arrayBuffer();
        if (token !== sequence.current) return;
        const buffer = await context.decodeAudioData(bytes);
        if (token !== sequence.current) return;
        if (buffer.duration > 480)
          throw new Error('Choose a song under eight minutes for this first version.');
        if (buffer.duration < 0.5)
          throw new Error('This clip is too short. Choose at least half a second of audio.');
        const samples = new Float32Array(buffer.length);
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const data = buffer.getChannelData(ch);
          for (let i = 0; i < data.length; i++) samples[i] += data[i] / buffer.numberOfChannels;
        }
        const worker = new Worker(new URL('./analysis.worker.js', import.meta.url), {
          type: 'module',
        });
        const finish = () => {
          worker.terminate();
          clearTimeout(job.current?.timeout);
          job.current = null;
        };
        const timeout = setTimeout(() => {
          if (token !== sequence.current) return;
          finish();
          setProgress(null);
          setError('Analysis took too long. Try a shorter clip.');
        }, 120000);
        job.current = { worker, timeout };
        worker.onmessage = ({ data }) => {
          if (token !== sequence.current) return;
          if (data.progress) {
            setProgress(data.progress);
            return;
          }
          finish();
          setProgress(null);
          if (data.error) {
            setError(data.error);
            return;
          }
          const lesson = {
            ...data.result,
            id: crypto.randomUUID(),
            title: file.name.replace(/\.[^.]+$/, ''),
            artist: 'Your local recording',
          };
          onReadyRef.current({ file, lesson });
        };
        worker.onerror = () => {
          if (token !== sequence.current) return;
          finish();
          setProgress(null);
          setError('The analysis could not finish. Try another audio file.');
        };
        worker.postMessage({ samples, rate: buffer.sampleRate }, [samples.buffer]);
      } catch (cause) {
        if (token !== sequence.current) return;
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
      job.current?.worker.terminate();
      clearTimeout(job.current?.timeout);
    },
    []
  );
  return { importSong, cancel, progress, error, clearError: () => setError('') };
}
