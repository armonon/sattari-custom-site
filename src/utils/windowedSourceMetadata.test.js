import { Blob } from 'node:buffer';
import { it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({
  metadata: null,
  duration: 180,
  dispose: vi.fn(),
  compute: vi.fn(),
}));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    async getPrimaryAudioTrack() {
      return {
        canDecode: async () => true,
        getSampleRate: async () => 48000,
        getNumberOfChannels: async () => 2,
      };
    }
    async getDurationFromMetadata() {
      return state.metadata;
    }
    async computeDuration() {
      state.compute();
      return state.duration;
    }
    dispose() {
      state.dispose();
    }
  },
}));
import { describeAudioSource } from './windowedSource';
it('scans packet timing when container duration is missing, without whole-Blob decoding', async () => {
  const file = new Blob(['synthetic metadata fixture']);
  file.arrayBuffer = () => {
    throw Error('Whole read');
  };
  state.metadata = null;
  state.duration = 180;
  state.compute.mockClear();
  const source = await describeAudioSource(file);
  expect(source).toMatchObject({
    kind: 'windowed-audio',
    duration: 180,
    sampleRate: 48000,
    channels: 2,
  });
  expect(state.compute).toHaveBeenCalledOnce();
  expect(state.dispose).toHaveBeenCalled();
});
it('avoids scanning when duration metadata is valid and rejects invalid scanned timing', async () => {
  state.metadata = 12;
  state.compute.mockClear();
  expect((await describeAudioSource(new Blob(['data']))).duration).toBe(12);
  expect(state.compute).not.toHaveBeenCalled();
  state.metadata = null;
  state.duration = Infinity;
  await expect(describeAudioSource(new Blob(['data']))).rejects.toThrow('incomplete timing');
});
