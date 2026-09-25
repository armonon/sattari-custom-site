import { zipSync } from 'fflate';
import { safeTrackName } from './stemSeparator';

self.onmessage = async ({ data: jobs }) => {
  try {
    const files = {};
    for (const [index, job] of jobs.entries()) {
      for (const output of job.outputs) {
        // Keep duplicate titles distinct; preserve the individual WAV filenames.
        files[`${String(index + 1).padStart(2, '0')}-${safeTrackName(job.name)}/${output.name}`] =
          new Uint8Array(await output.blob.arrayBuffer());
      }
    }
    const bytes = zipSync(files, { level: 0 });
    self.postMessage({ blob: new Blob([bytes], { type: 'application/zip' }) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
