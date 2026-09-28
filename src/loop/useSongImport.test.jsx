import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useSongImport from './useSongImport';

afterEach(() => {
  vi.unstubAllGlobals();
});

const file = {
  name: 'guitar.wav',
  type: 'audio/wav',
  size: 200,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(20)),
};
const buffer = {
  duration: 1,
  length: 16000,
  sampleRate: 16000,
  numberOfChannels: 1,
  getChannelData: () => new Float32Array(16000),
};

it('does not start a worker if an in-flight decode is cancelled', async () => {
  let decode;
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      decodeAudioData() {
        return new Promise((resolve) => {
          decode = resolve;
        });
      }
    }
  );
  const Worker = vi.fn();
  vi.stubGlobal('Worker', Worker);
  const ready = vi.fn();
  const { result } = renderHook(() => useSongImport(ready));
  let importing;
  await act(async () => {
    importing = result.current.importSong(file);
  });
  act(() => result.current.cancel());
  await act(async () => {
    decode(buffer);
    await importing;
  });
  expect(Worker).not.toHaveBeenCalled();
  expect(ready).not.toHaveBeenCalled();
  expect(result.current.progress).toBeNull();
});

it('terminates work and ignores a late worker result after cancellation', async () => {
  const workers = [];
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      async decodeAudioData() {
        return buffer;
      }
    }
  );
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        workers.push(this);
      }
      postMessage = vi.fn();
      terminate = vi.fn();
    }
  );
  const ready = vi.fn();
  const { result } = renderHook(() => useSongImport(ready));
  await act(async () => {
    await result.current.importSong(file);
  });
  const worker = workers[0];
  expect(worker.postMessage).toHaveBeenCalled();
  act(() => result.current.cancel());
  act(() => worker.onmessage({ data: { result: { notes: [], chords: [] } } }));
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(ready).not.toHaveBeenCalled();
});

it('rejects oversized inputs before decoding', async () => {
  const decode = vi.fn();
  vi.stubGlobal('OfflineAudioContext', decode);
  const { result } = renderHook(() => useSongImport(vi.fn()));
  await act(async () => {
    await result.current.importSong({ ...file, size: 41 * 1024 * 1024 });
  });
  expect(decode).not.toHaveBeenCalled();
  expect(result.current.error).toMatch(/40 MB/);
});
