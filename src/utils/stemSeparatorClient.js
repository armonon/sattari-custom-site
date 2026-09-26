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

  separate(audio, stems, signal, onProgress = () => {}, onAnalysis = () => {}) {
    signal.throwIfAborted();
    if (this.pending) return Promise.reject(new Error('A track is already processing.'));
    if (!selectedStemIds(stems).length)
      return Promise.reject(new Error('Select at least one stem.'));
    this.worker ||= this.createWorker();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        this.pending = null;
        if (error) {
          this.worker?.terminate();
          this.worker = null;
          reject(error);
        } else resolve(result);
      };
      const abort = () => finish(new DOMException('Separation cancelled.', 'AbortError'));
      this.pending = { abort };
      signal.addEventListener('abort', abort, { once: true });
      this.worker.onmessage = ({ data }) => {
        if (settled) return;
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
      try {
        this.worker.postMessage(
          {
            left: audio.left,
            right: audio.right,
            channels: audio.channels,
            stems: selectedStemIds(stems),
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
