// Thin wrapper around lyricWhisper.worker.js: spawns the worker on demand,
// turns its postMessage protocol into a Promise, and reports model-download +
// transcription progress. Mirrors the shape of StemSeparatorClient
// (src/utils/stemSeparatorClient.js) used by Split, but is its own small
// implementation since Lyric's worker protocol is simpler (one request,
// one streamed progress, one result).
export class LyricWhisperClient {
  constructor(
    createWorker = () =>
      new Worker(new URL('./lyricWhisper.worker.js', import.meta.url), { type: 'module' })
  ) {
    this.createWorker = createWorker;
    this.worker = null;
  }

  /**
   * @param {Float32Array} samples mono PCM
   * @param {number} rate sample rate of `samples`
   * @param {AbortSignal} signal
   * @param {(progress: unknown) => void} onProgress
   * @returns {Promise<{ text: string, start: number|null, end: number|null }[]>}
   */
  transcribe(samples, rate, signal, onProgress = () => {}) {
    signal?.throwIfAborted();
    try {
      this.worker ||= this.createWorker();
    } catch {
      return Promise.reject(
        new Error(
          'The transcription worker could not start. Reload and try a current desktop browser.'
        )
      );
    }
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random());
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        if (error) reject(error);
        else resolve(result);
      };
      const onAbort = () => {
        finish(new DOMException('Alignment cancelled.', 'AbortError'));
        this.dispose();
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.worker.onmessage = ({ data }) => {
        if (data.id !== id || settled) return;
        if (data.type === 'progress') onProgress(data.progress);
        else if (data.type === 'done') finish(null, data.chunks);
        else if (data.type === 'error') finish(new Error(data.message || 'Transcription failed.'));
      };
      this.worker.onerror = (event) =>
        finish(new Error(event.message || 'Transcription worker crashed.'));
      this.worker.postMessage({ type: 'transcribe', id, samples, rate });
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}
