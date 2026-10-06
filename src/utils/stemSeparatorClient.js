import { selectedStemIds } from './stemSeparator';

export class StemSeparatorClient {
  constructor(
    createWorker = () =>
      new Worker(new URL('./stemSeparator.worker.js', import.meta.url), { type: 'module' })
  ) {
    this.createWorker = createWorker;
    this.worker = null;
    this.pending = null;
  }

  separate(audio, stems, signal, onProgress = () => {}, onAnalysis = () => {}, cpuOnly = false) {
    signal.throwIfAborted();
    if (this.pending) return Promise.reject(new Error('A track is already processing.'));
    if (!selectedStemIds(stems).length)
      return Promise.reject(new Error('Select at least one stem.'));
    try {
      this.worker ||= this.createWorker();
    } catch {
      return Promise.reject(
        new Error('The audio worker could not start. Reload and try a current desktop browser.')
      );
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      let started = false;
      let timer;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        this.pending = null;
        if (error) {
          this.worker?.terminate();
          this.worker = null;
          reject(error);
        } else resolve(result);
      };
      const abort = () => finish(new DOMException('Separation cancelled.', 'AbortError'));
      const touch = () => {
        clearTimeout(timer);
        timer = setTimeout(
          () =>
            finish(
              new Error(
                started
                  ? 'The separation engine stopped responding. Try CPU mode or a shorter track.'
                  : 'The separation worker could not start. Reload and check your connection.'
              )
            ),
          started ? 5 * 60 * 1000 : 45000
        );
      };
      this.pending = { abort };
      signal.addEventListener('abort', abort, { once: true });
      this.worker.onmessage = ({ data }) => {
        if (settled) return;
        started = true;
        touch();
        if (data.type === 'progress') onProgress(data);
        else if (data.type === 'analysis') onAnalysis(data.analysis);
        else if (data.type === 'result') finish(null, data.outputs);
        else if (data.type === 'error') finish(new Error(data.message));
      };
      this.worker.onerror = (event) => {
        event.preventDefault?.();
        finish(
          new Error(
            'The audio worker stopped. Try a shorter track or close other memory-heavy tabs.'
          )
        );
      };
      this.worker.onmessageerror = () =>
        finish(
          new Error('The audio worker could not return its result. Retry with a shorter track.')
        );
      touch();
      onProgress({ message: 'Starting audio worker', progress: null });
      try {
        this.worker.postMessage(
          {
            left: audio.left,
            right: audio.right,
            channels: audio.channels,
            stems: selectedStemIds(stems),
            cpuOnly,
          },
          [audio.left.buffer, audio.right.buffer]
        );
      } catch (error) {
        finish(error);
      }
    });
  }

  dispose() {
    this.pending?.abort();
    this.worker?.terminate();
    this.worker = null;
  }
}
