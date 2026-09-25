import { performanceAssetIds } from './performanceReplay';
import { describeAudioSource } from './windowedSource';

// Use the effective plan, never the archival/original event history. The latter
// intentionally retains disabled and superseded edits for Undo.
export function replaySourceDependencies(plan) {
  return performanceAssetIds([plan.initial, ...(plan.events || [])]);
}

export function replaySourceDurations(plan) {
  const durations = new Map();
  const visit = (value, inherited = 0) => {
    if (!value || typeof value !== 'object') return;
    const duration = value.sourceDuration || value.duration || inherited;
    if (value.assetId && duration > 0)
      durations.set(value.assetId, Math.max(durations.get(value.assetId) || 0, duration));
    for (const child of Object.values(value)) if (typeof child === 'object') visit(child, duration);
  };
  visit(plan.initial);
  for (const event of plan.events || []) visit(event.args);
  return durations;
}

// Effective-plan source catalog. Deck assets are range-readable descriptors;
// sampled pads retain an explicitly bounded whole-buffer path. The engine owns
// the separate shared paging pool (128 MiB), for a combined 256 MiB PCM budget.
export class ReplaySourceCache {
  constructor(
    raw,
    load,
    {
      budget = 128 * 1048576,
      durations = new Map(),
      windowedIds = new Set(),
      describe = describeAudioSource,
    } = {}
  ) {
    Object.assign(this, { raw, load, budget, durations, windowedIds, describe });
    this.buffers = new Map();
    this.bytes = 0;
    this.disposed = false;
  }
  prepare(ids) {
    const requested = [...ids];
    const work = (this.pending || Promise.resolve()).then(() => this.prepareSerial(requested));
    this.pending = work.catch(() => {});
    return work;
  }
  async prepareSerial(ids) {
    if (this.disposed) return;
    const needed = new Set(ids);
    for (const [id, buffer] of this.buffers)
      if (!needed.has(id)) {
        if (buffer.kind !== 'windowed-audio')
          this.bytes -= buffer.length * buffer.numberOfChannels * 4;
        this.buffers.delete(id);
      }
    for (const id of needed) {
      if (this.disposed) return;
      if (this.buffers.has(id)) continue;
      const asset = await this.load(id);
      if (this.disposed) return;
      if (!asset?.blob)
        throw new Error(`Replay source missing: ${id}. Relink the project audio first.`);
      if (this.windowedIds.has(id)) {
        const source = await this.describe(asset.blob);
        if (this.disposed) return;
        this.buffers.set(id, source);
        continue;
      }
      if (asset.blob.size > this.budget)
        throw new Error('Replay source exceeds the preparation budget. Use captured audio lanes.');
      // Preflight known durations before invoking the browser's allocating decoder.
      const estimate = (this.durations.get(id) || 0) * (this.raw.sampleRate || 48000) * 8;
      if (estimate > this.budget - this.bytes)
        throw new Error(
          'Active replay sources exceed the PCM budget. Use captured audio lanes or shorter sources.'
        );
      const encoded = await asset.blob.arrayBuffer();
      if (this.disposed) return;
      const buffer = await this.raw.decodeAudioData(encoded);
      if (this.disposed) return;
      const size = buffer.length * buffer.numberOfChannels * 4;
      if (size > this.budget - this.bytes)
        throw new Error('Active replay sources exceed the PCM budget. Use captured audio lanes.');
      this.buffers.set(id, buffer);
      this.bytes += size;
    }
  }
  dispose() {
    this.disposed = true;
    this.buffers.clear();
    this.bytes = 0;
  }
}
