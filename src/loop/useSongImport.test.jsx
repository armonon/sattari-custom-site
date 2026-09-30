import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useSongImport from './useSongImport';

const separator = vi.hoisted(() => ({ separate: vi.fn(), dispose: vi.fn() }));
vi.mock('../utils/stemSeparatorClient', () => ({
  StemSeparatorClient: class {
    separate = separator.separate;
    dispose = separator.dispose;
  },
}));
beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

function mockDecoding() {
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
  return workers;
}

it('waits for a preparation choice before doing work on a selected file', () => {
  const workers = mockDecoding();
  const { result } = renderHook(() => useSongImport(vi.fn()));
  act(() => result.current.selectFile(file));
  expect(result.current.selectedFile).toBe(file);
  expect(result.current.progress).toBeNull();
  expect(workers).toHaveLength(0);
  expect(separator.separate).not.toHaveBeenCalled();
});

it('passes the actual source sample rate to AutoKey for a polyphonic original recording', async () => {
  const workers = mockDecoding();
  const { result } = renderHook(() => useSongImport(vi.fn()));
  await act(async () => {
    await result.current.importSong(file, { detail: 'harmony' });
  });
  const message = workers[0].postMessage.mock.calls[0][0];
  expect(message.detail).toBe('harmony');
  expect(message.keyRate).toBe(message.rate);
});

it('analyzes the instrumental stem while keeping the original for key and playback', async () => {
  const workers = mockDecoding();
  const practiceFile = new Blob(['prepared'], { type: 'audio/wav' });
  practiceFile.arrayBuffer = async () => new ArrayBuffer(20);
  separator.separate.mockResolvedValue([{ id: 'other', blob: practiceFile }]);
  const ready = vi.fn();
  const { result } = renderHook(() => useSongImport(ready));
  await act(async () => {
    await result.current.importSong(file, { preparation: 'instruments' });
  });
  expect(separator.separate.mock.calls[0][1]).toEqual(['other']);
  const message = workers[0].postMessage.mock.calls[0][0];
  expect(message.preparation).toBe('instruments');
  expect(message.keySamples).toBeInstanceOf(Float32Array);
  expect(message.keySamples).not.toBe(message.samples);
  expect(separator.dispose).toHaveBeenCalledOnce();
  act(() => workers[0].onmessage({ data: { result: { notes: [], chords: [] } } }));
  expect(ready).toHaveBeenCalledWith(
    expect.objectContaining({
      file,
      practiceFile,
      lesson: expect.objectContaining({ title: 'guitar' }),
    })
  );
});

it('cancels an active separator and ignores a late result', async () => {
  const workers = mockDecoding();
  let resolve;
  separator.separate.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const ready = vi.fn();
  const { result } = renderHook(() => useSongImport(ready));
  let importing;
  await act(async () => {
    importing = result.current.importSong(file, { preparation: 'instruments' });
  });
  const signal = separator.separate.mock.calls[0][2];
  act(() => result.current.cancel());
  expect(signal.aborted).toBe(true);
  await act(async () => {
    resolve([]);
    await importing;
  });
  expect(ready).not.toHaveBeenCalled();
  expect(workers).toHaveLength(0);
  expect(result.current.progress).toBeNull();
});

it('reports a preparation failure without silently analyzing the full mix', async () => {
  const workers = mockDecoding();
  separator.separate.mockRejectedValue(new Error('Model download failed.'));
  const ready = vi.fn();
  const { result } = renderHook(() => useSongImport(ready));
  await act(async () => {
    await result.current.importSong(file, { preparation: 'instruments' });
  });
  expect(result.current.error).toMatch(/Model download failed/);
  expect(workers).toHaveLength(0);
  expect(ready).not.toHaveBeenCalled();
  expect(separator.dispose).toHaveBeenCalledOnce();
});

it('times out an unresponsive analysis worker and ignores its late result', async () => {
  vi.useFakeTimers();
  const workers = mockDecoding();
  const ready = vi.fn();
  const { result } = renderHook(() => useSongImport(ready));
  await act(async () => {
    await result.current.importSong(file);
  });
  act(() => vi.advanceTimersByTime(120000));
  act(() => workers[0].onmessage({ data: { result: { notes: [], chords: [] } } }));
  expect(ready).not.toHaveBeenCalled();
  expect(result.current.error).toMatch(/too long/);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});
