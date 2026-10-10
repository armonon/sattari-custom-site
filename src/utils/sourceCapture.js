import { putAudioAsset } from './audioProjectStore';
import { audioClip, audioTrack, arrangementId, validateArrangement } from './arrangementModel';
import { packageAudio } from './arrangementPackaging';
import { createWaveformPeaks } from './audioAnalysis';
import { journalStore } from './performanceJournal';

const prefix = 'sattari-source-capture:';
const loaded = new WeakMap();
export async function recoverSourceCaptures(storage = globalThis.localStorage) {
  const takes = await journalStore.recoverSources();
  for (let i = 0; i < (storage?.length || 0); i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    try {
      const take = JSON.parse(storage.getItem(key));
      validateArrangement({ version: 1, tracks: take.tracks, captures: [] });
      if (take.tracks.some((track) => track.clips.length)) takes.push(take);
    } catch {
      /* A damaged recovery manifest must not replace the current set. */
    }
  }
  return takes;
}

// Every source uses one AudioWorklet and a shared sample counter. Five-second
// float-WAV chunks are committed to IndexedDB instead of accumulating whole takes.
export class SourceCapture {
  async start(context, sources, connect, disconnect, options = {}) {
    if (this.node) throw new Error('Source capture is already running.');
    // Tone's rawContext may itself be standardized-audio-context, not a native
    // BaseAudioContext. Its factory creates a compatible worklet and routing node.
    const createWorklet = context.createAudioWorkletNode?.bind(context);
    context = context.rawContext || context;
    this.finished = false;
    if (!context.audioWorklet || (!createWorklet && typeof AudioWorkletNode === 'undefined'))
      throw new Error('Separate-source capture needs AudioWorklet support.');
    if (!sources.length || sources.length > 32) throw new Error('Choose 1–32 capture sources.');
    if (!loaded.has(context))
      loaded.set(
        context,
        context.audioWorklet
          .addModule(new URL('./sourceCapture.worklet.js', import.meta.url).href)
          .catch((error) => {
            loaded.delete(context);
            throw error;
          })
      );
    await loaded.get(context);
    this.context = context;
    this.timelineStart = options.timelineStart || 0;
    this.referenceClock = options.referenceClock;
    this.sources = sources;
    this.disconnect = disconnect;
    this.id = arrangementId();
    this.name = `Source take ${new Date().toLocaleString()}`;
    this.tracks = sources.map((source) => ({
      ...audioTrack(source.name),
      captureId: this.id,
      ...(source.role ? { role: source.role } : {}),
      ...(source.replayInput ? { replayInput: source.replayInput } : {}),
      ...(source.keepEmpty ? { keepEmpty: true } : {}),
    }));
    this.committedFrames = 0;
    this.pending = Promise.resolve();
    this.encoder = { current: null };
    this.pendingChunks = 0;
    this.pendingBytes = 0;
    this.error = null;
    this.totalFrames = 0;
    this.startTime =
      (Math.ceil(((context.currentTime + 0.08) * context.sampleRate) / 128) * 128) /
      context.sampleRate;
    const nodeOptions = {
      numberOfInputs: sources.length,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 2,
      channelCountMode: 'explicit',
      processorOptions: {
        count: sources.length,
        startFrame: Math.round(this.startTime * context.sampleRate),
      },
    };
    this.node = createWorklet
      ? createWorklet('stemdeck-source-capture', nodeOptions)
      : new AudioWorkletNode(context, 'stemdeck-source-capture', nodeOptions);
    this.node.port.onmessage = ({ data }) => {
      if (data.error) {
        this.error = data.error;
        return;
      }
      if (data.startedAt != null) {
        this.startTime = data.startedAt;
        return;
      }
      if (data.progress) {
        this.totalFrames = data.frames;
        return;
      }
      if (data.done) {
        this.finished = true;
        this.totalFrames = data.frames;
        this.done?.();
        return;
      }
      if (this.error) return;
      const bytes = data.length * sources.length * 8;
      this.pendingBytes += bytes;
      if (++this.pendingChunks > 6 || this.pendingBytes > 64 * 1024 * 1024) {
        this.error =
          'Source capture storage could not keep up. Completed chunks are recoverable; use the master recording for continuity.';
        this.node?.port.postMessage('stop');
        return;
      }
      this.pending = this.pending
        .then(() => this.storeChunk(data))
        .catch((error) => {
          this.error =
            error?.message ||
            'Source capture storage is full or unavailable. Completed chunks are recoverable; stop and save a portable backup.';
          this.node?.port.postMessage('stop');
        })
        .finally(() => {
          this.pendingChunks--;
          this.pendingBytes -= bytes;
          const transfers = data.channels
            .flat()
            .map((values) => values.buffer)
            .filter((buffer) => buffer.byteLength);
          this.node?.port.postMessage(
            transfers.length === sources.length * 2
              ? { ack: true, channels: data.channels }
              : { ack: true },
            transfers
          );
        });
    };
    try {
      sources.forEach((source, index) =>
        source.nodes.forEach((node) => connect(node, this.node, index))
      );
      // Silent output keeps the capture processor alive without double monitoring.
      this.node.connect(context.destination);
    } catch (error) {
      this.dispose();
      throw error;
    }
    return this.startTime;
  }
  async storeChunk({ channels, start, length }) {
    // A final partial block under a millisecond is inaudible, and a clip that
    // short is not valid arrangement data.
    if (length / this.context.sampleRate < 0.001) {
      this.committedFrames = start + length;
      return;
    }
    for (let index = 0; index < channels.length; index++) {
      const pair = channels[index],
        name = `${this.sources[index].name} ${(start / this.context.sampleRate).toFixed(1)}s`;
      // Reserved live-input lanes must not consume gigabytes writing silence
      // before a device connects. Later chunks retain their absolute timestamps.
      if (
        this.sources[index].omitSilence &&
        pair.every((channel) => {
          for (let sample = 0; sample < length; sample++) if (channel[sample] !== 0) return false;
          return true;
        })
      )
        continue;
      const waveform = createWaveformPeaks(pair[0].subarray(0, length), 64);
      const bytes = await packageAudio(
        {
          type: 'float-wav',
          channels: pair,
          length,
          sampleRate: this.context.sampleRate,
          recycle: true,
        },
        undefined,
        this.encoder
      );
      if (this.encoder.recycled) {
        channels[index] = this.encoder.recycled;
        this.encoder.recycled = null;
      }
      const asset = await putAudioAsset(new Blob([bytes], { type: 'audio/wav' }), {
        name: `${name}.wav`,
      });
      const clip = audioClip(
        asset.id,
        name,
        length / this.context.sampleRate,
        start / this.context.sampleRate
      );
      clip.fadeIn = 0;
      clip.start +=
        this.timelineStart +
        (this.referenceClock == null ? 0 : Math.max(0, this.startTime - this.referenceClock));
      clip.fadeOut = 0;
      clip.waveform = waveform;
      // Commit after each source; a quota error must not hide already saved audio.
      await journalStore.sourceClip(this, this.tracks[index], clip);
      this.tracks[index].clips.push(clip);
    }
    this.committedFrames = start + length;
  }
  async stop() {
    if (!this.node) return { tracks: this.tracks || [], error: this.error };
    if (!this.finished)
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.error ||=
            'Capture stopped before its final audio block was acknowledged; recover completed chunks.';
          resolve();
        }, 2500);
        this.done = () => {
          clearTimeout(timeout);
          resolve();
        };
        this.node.port.postMessage('stop');
      });
    await this.pending;
    this.dispose();
    return {
      tracks: this.tracks.filter((track) => track.clips.length || track.keepEmpty),
      error: this.error,
      id: this.id,
      startTime: this.startTime,
    };
  }
  dispose() {
    this.encoder?.cancel?.();
    this.encoder?.current?.terminate();
    if (this.encoder) this.encoder.current = null;
    if (!this.node) return;
    this.node.port.postMessage('stop');
    this.sources.forEach((source) =>
      source.nodes.forEach((node) => {
        try {
          this.disconnect(node, this.node);
        } catch {
          /* Source may already be disconnected. */
        }
      })
    );
    this.node.disconnect();
    this.node.port.close();
    this.node = null;
  }
}
