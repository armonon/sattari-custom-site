import { beforeEach, expect, it, vi } from 'vitest';
import { SourceCapture, recoverSourceCaptures } from './sourceCapture';
import { putAudioAsset } from './audioProjectStore';
import { wavBytes } from './arrangementExport';
vi.mock('./audioProjectStore', () => ({
  putAudioAsset: vi.fn(async (_, meta) => ({ id: meta.name })),
}));
vi.mock('./audioAnalysis', () => ({ createWaveformPeaks: () => [0, 1, 0] }));
vi.mock('./arrangementPackaging', () => ({ packageAudio: vi.fn(async () => new Uint8Array([1])) }));
let node;
const manifests = vi.hoisted(() => new Map());
vi.mock('./performanceJournal', () => ({
  journalStore: {
    recoverSources: async () => [...manifests.values()],
    sourceClip: async (take, track, clip) => {
      if (!manifests.has(take.id))
        manifests.set(take.id, { id: take.id, name: take.name, tracks: [] });
      const saved = manifests.get(take.id);
      let row = saved.tracks.find((t) => t.id === track.id);
      if (!row) {
        row = { ...track, clips: [] };
        saved.tracks.push(row);
      }
      row.clips.push(clip);
    },
  },
}));
beforeEach(() => {
  manifests.clear();
  vi.clearAllMocks();
  localStorage.clear();
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      constructor() {
        // Expose the fake browser-created worklet to drive messages in tests.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        node = this;
        this.port = {
          postMessage: vi.fn((message) => {
            if (message === 'stop')
              queueMicrotask(() => this.port.onmessage?.({ data: { done: true, frames: 256 } }));
          }),
          close: vi.fn(),
        };
      }
      connect() {}
      disconnect() {}
    }
  );
});
it('persists aligned chunks and discovers recovery manifests without reopening audio', async () => {
  const capture = new SourceCapture(),
    disconnect = vi.fn();
  await capture.start(
    {
      audioWorklet: { addModule: vi.fn(async () => {}) },
      currentTime: 10,
      sampleRate: 48000,
      destination: {},
    },
    [
      { name: 'A', nodes: [{}] },
      { name: 'B', nodes: [{}] },
    ],
    vi.fn(),
    disconnect
  );
  node.port.onmessage({ data: { startedAt: 10.1 } });
  const channels = () => [
    [new Float32Array(128), new Float32Array(128)],
    [new Float32Array(128), new Float32Array(128)],
  ];
  node.port.onmessage({ data: { channels: channels(), start: 0, length: 128 } });
  node.port.onmessage({ data: { channels: channels(), start: 128, length: 128 } });
  const result = await capture.stop();
  expect(result.error).toBeNull();
  expect(result.tracks).toHaveLength(2);
  expect(result.tracks[0].clips[1].start).toBe(128 / 48000);
  expect(result.tracks[0].clips[1].fadeIn).toBe(0);
  expect(result.startTime).toBe(10.1);
  expect(putAudioAsset).toHaveBeenCalledTimes(4);
  expect((await recoverSourceCaptures())[0].tracks).toHaveLength(2);
  expect(disconnect).toHaveBeenCalledTimes(2);
});
it('reserved input lanes omit silence while later audio keeps its absolute placement', async () => {
  const capture = new SourceCapture();
  await capture.start(
    {
      audioWorklet: { addModule: vi.fn(async () => {}) },
      currentTime: 0,
      sampleRate: 48000,
      destination: {},
    },
    [{ name: 'Input', nodes: [{}], omitSilence: true, keepEmpty: true }],
    vi.fn(),
    vi.fn()
  );
  node.port.onmessage({
    data: { channels: [[new Float32Array(128), new Float32Array(128)]], start: 0, length: 128 },
  });
  await capture.pending;
  expect(putAudioAsset).not.toHaveBeenCalled();
  node.port.onmessage({
    data: {
      channels: [[new Float32Array(128).fill(0.2), new Float32Array(128)]],
      start: 48000,
      length: 128,
    },
  });
  const result = await capture.stop();
  expect(result.tracks[0].clips[0].start).toBe(1);
  expect(putAudioAsset).toHaveBeenCalledTimes(1);
});
it('reports storage failure without claiming a completed source take', async () => {
  putAudioAsset.mockRejectedValueOnce(new Error('quota full'));
  const capture = new SourceCapture();
  await capture.start(
    {
      audioWorklet: { addModule: vi.fn(async () => {}) },
      currentTime: 0,
      sampleRate: 48000,
      destination: {},
    },
    [{ name: 'A', nodes: [{}] }],
    vi.fn(),
    vi.fn()
  );
  node.port.onmessage({
    data: { channels: [[new Float32Array(128), new Float32Array(128)]], start: 0, length: 128 },
  });
  const result = await capture.stop();
  expect(result.error).toBe('quota full');
  expect(result.tracks).toHaveLength(0);
});
it('uses the owning audio-context factory for wrapped worklet contexts', async () => {
  const rawContext = {
    audioWorklet: { addModule: vi.fn(async () => {}) },
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
  };
  const factory = vi.fn((name, options) => new AudioWorkletNode(rawContext, name, options));
  const capture = new SourceCapture();
  await capture.start(
    { rawContext, createAudioWorkletNode: factory },
    [{ name: 'Wrapped source', nodes: [{}] }],
    vi.fn(),
    vi.fn()
  );
  expect(factory).toHaveBeenCalledWith(
    'stemdeck-source-capture',
    expect.objectContaining({ numberOfInputs: 1 })
  );
  expect(capture.context).toBe(rawContext);
  await capture.stop();
});
it('keeps the timeline placement and audio-clock offset in recovery chunks', async () => {
  const capture = new SourceCapture();
  await capture.start(
    {
      audioWorklet: { addModule: vi.fn(async () => {}) },
      currentTime: 10,
      sampleRate: 48000,
      destination: {},
    },
    [{ name: 'Overdub', nodes: [{}] }],
    vi.fn(),
    vi.fn(),
    { timelineStart: 4, referenceClock: 10 }
  );
  node.port.onmessage({ data: { startedAt: 10.25 } });
  node.port.onmessage({
    data: { channels: [[new Float32Array(128), new Float32Array(128)]], start: 0, length: 128 },
  });
  const result = await capture.stop();
  expect(result.tracks[0].clips[0].start).toBe(4.25);
  expect((await recoverSourceCaptures())[0].tracks[0].clips[0].start).toBe(4.25);
});
it('float WAV preserves headroom rather than clipping source samples', () => {
  const bytes = wavBytes(
    {
      numberOfChannels: 1,
      length: 3,
      sampleRate: 48000,
      getChannelData: () => new Float32Array([2, -1.5, 0.25]),
    },
    true
  );
  const view = new DataView(bytes.buffer);
  expect(view.getUint16(20, true)).toBe(3);
  expect(view.getUint16(34, true)).toBe(32);
  expect(view.getFloat32(44, true)).toBe(2);
  expect(view.getFloat32(48, true)).toBe(-1.5);
});
