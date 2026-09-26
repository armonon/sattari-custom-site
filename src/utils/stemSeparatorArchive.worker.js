import { zipSync } from 'fflate';
import { safeTrackName } from './stemSeparator';

self.onmessage = async ({ data: jobs }) => {
  try {
    const files = {};
    for (const [index, job] of jobs.entries()) {
      const folder = `${String(index + 1).padStart(2, '0')}-${safeTrackName(job.name)}`;
      if (job.report)
        files[`${folder}/analysis.json`] = new TextEncoder().encode(
          JSON.stringify(job.report, null, 2)
        );
      for (const output of job.outputs) {
        // Keep duplicate titles distinct; preserve the individual WAV filenames.
        files[`${folder}/${output.name}`] = new Uint8Array(await output.blob.arrayBuffer());
      }
    }
    const bytes = zipSync(files, { level: 0 });
    self.postMessage({ blob: new Blob([bytes], { type: 'application/zip' }) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
