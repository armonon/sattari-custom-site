import { stemAnalysisReport } from './stemAnalysisReport';

export function createStemArchive(jobs, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./stemSeparatorArchive.worker.js', import.meta.url), {
      type: 'module',
    });
    const finish = (error, blob) => {
      signal.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(blob);
    };
    const abort = () => finish(new DOMException('Download cancelled.', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.blob);
    worker.onerror = () =>
      finish(new Error('ZIP could not be created. Download individual tracks or stems instead.'));
    try {
      worker.postMessage(
        jobs.map((job) => ({
          name: job.file.name,
          outputs: job.outputs.map(({ name, blob }) => ({ name, blob })),
          ...(job.analysis ? { report: stemAnalysisReport(job) } : {}),
        }))
      );
    } catch (error) {
      finish(error);
    }
  });
}
