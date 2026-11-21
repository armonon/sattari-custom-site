// Render the same practice preset for every finished song, one song at a time
// so only one song's PCM is decoded at once. Uses the shared mix rule, so each
// file matches what the player would render with that preset.
import { applyPreset, createMix, mixFileName, mixWavBlob, parseWav, renderMix } from './stemMix';

export async function renderBatchMixes(
  jobs,
  presetId,
  { signal, onProgress = () => {}, headroom = 'none', fileBase = (job) => job.file.name } = {}
) {
  const mixes = [];
  const skipped = [];
  for (const [index, job] of jobs.entries()) {
    signal?.throwIfAborted();
    const ids = job.outputs.map((output) => output.id);
    if (ids.length < 4 && presetId !== 'all') {
      skipped.push(job.file.name);
      continue;
    }
    const sources = {};
    for (const output of job.outputs) {
      const parsed = parseWav(await output.blob.arrayBuffer());
      sources[output.id] = { sampleRate: parsed.sampleRate, channels: parsed.channels };
    }
    const mix = applyPreset(createMix(ids), presetId);
    const render = await renderMix(sources, mix, {
      signal,
      headroom,
      onProgress: (progress) => onProgress((index + progress) / jobs.length),
    });
    mixes.push({ job, name: mixFileName(fileBase(job), mix), blob: mixWavBlob(render, 'float32') });
  }
  return { mixes, skipped };
}
