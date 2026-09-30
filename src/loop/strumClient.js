export function analyzeStrum(take, expected, { signal, onProgress = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Check cancelled', 'AbortError'));
    const worker = new Worker(new URL('./strum.worker.js', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const abort = () => finish(new DOMException('Check cancelled', 'AbortError'));
    const timeout = setTimeout(
      () => finish(new Error('The note detector took too long. Try again, or check each string.')),
      90000
    );
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      if (data.error) finish(new Error(data.error));
      else if (data.result) finish(null, data.result);
      else if (data.progress) onProgress(data.progress);
    };
    worker.onerror = () =>
      finish(new Error('The note detector could not load. Try again, or check each string.'));
    worker.onmessageerror = worker.onerror;
    try {
      worker.postMessage({ ...take, expected }, [take.samples.buffer]);
    } catch (error) {
      finish(error);
    }
  });
}
