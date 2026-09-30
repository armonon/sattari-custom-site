export { alignScore } from './scoreImportModel';

export async function importScore(file, { signal } = {}) {
  if (file.size > 8 * 1024 ** 2) throw new Error('Choose a score smaller than 8 MB.');
  const bytes = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const worker = new Worker(new URL('./scoreImport.worker.js', import.meta.url), {
    type: 'module',
  });
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(result);
    };
    const abort = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(
      () => finish(new Error('The score took too long to read. Try a smaller excerpt.')),
      20000
    );
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.tracks);
    worker.onerror = (event) =>
      finish(
        new Error(
          `The score reader could not start${event.message ? `: ${event.message}` : '. Try reloading Sattari Learn, then choose the score again.'}`
        )
      );
    // alphaTab also installs its own worker message listeners. A namespaced
    // command lets those listeners ignore our import request safely.
    worker.postMessage({ cmd: 'loop.import', bytes }, [bytes]);
    if (signal?.aborted) abort();
  });
}
