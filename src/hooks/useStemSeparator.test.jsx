import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useStemSeparator from './useStemSeparator';
import { decodeTrack } from '../utils/stemSeparator';

const { separate, dispose } = vi.hoisted(() => ({ separate: vi.fn(), dispose: vi.fn() }));
vi.mock('../utils/stemSeparatorClient', () => ({
  StemSeparatorClient: class {
    separate(...args) {
      return separate(...args);
    }
    dispose() {
      dispose();
    }
  },
}));
vi.mock('../utils/stemSeparator', async () => ({
  ...(await vi.importActual('../utils/stemSeparator')),
  decodeTrack: vi.fn(),
}));

const file = (name) => new File(['test'], name, { type: 'audio/wav' });
const outputs = (stems) =>
  stems.map((id) => ({ id, blob: new Blob(['wav']), peaks: new Float32Array([0.5]) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => `blob:${Math.random()}`);
      static revokeObjectURL = vi.fn();
    }
  );
  decodeTrack.mockResolvedValue({
    left: new Float32Array(4),
    right: new Float32Array(4),
    duration: 1,
    peaks: [],
  });
  separate.mockImplementation(async (_audio, stems) => outputs(stems));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('processes every file with a snapshot of the selected stems', async () => {
  const { result } = renderHook(useStemSeparator);
  act(() => {
    result.current.addFiles([file('one.wav'), file('two.wav')]);
    result.current.setSelected(['bass', 'other']);
  });
  await act(async () => {
    await result.current.run();
  });
  expect(separate).toHaveBeenCalledTimes(2);
  expect(result.current.jobs.map((job) => job.status)).toEqual(['done', 'done']);
  expect(result.current.jobs[0].outputs.map((output) => output.id)).toEqual(['bass', 'other']);
  expect(result.current.jobs[0].outputs[1].name).toBe('one-instruments.wav');
  expect(result.current.running).toBe(false);
});

it('continues after a bad file and retries only that file', async () => {
  decodeTrack.mockRejectedValueOnce(new Error('Bad file'));
  const { result } = renderHook(useStemSeparator);
  act(() => result.current.addFiles([file('bad.wav'), file('good.wav')]));
  await act(async () => {
    await result.current.run();
  });
  expect(result.current.jobs.map((job) => job.status)).toEqual(['error', 'done']);
  await act(async () => {
    await result.current.run(result.current.jobs[0].id);
  });
  expect(result.current.jobs.map((job) => job.status)).toEqual(['done', 'done']);
  expect(separate).toHaveBeenCalledTimes(2);
});

it('cancels the active file, preserves pending files, and can resume', async () => {
  separate.mockImplementationOnce(
    (_audio, _stems, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
      })
  );
  const { result } = renderHook(useStemSeparator);
  act(() => result.current.addFiles([file('one.wav'), file('two.wav')]));
  let run;
  act(() => {
    run = result.current.run();
  });
  await waitFor(() => expect(separate).toHaveBeenCalledTimes(1));
  await act(async () => {
    result.current.cancel();
    await run;
  });
  expect(result.current.jobs.map((job) => job.status)).toEqual(['cancelled', 'queued']);
  await act(async () => {
    await result.current.run();
  });
  expect(result.current.jobs.map((job) => job.status)).toEqual(['done', 'done']);
});

it('prevents parallel runs and selection-free inference', async () => {
  const { result } = renderHook(useStemSeparator);
  act(() => {
    result.current.addFiles([file('one.wav')]);
    result.current.setSelected([]);
  });
  await act(async () => {
    await result.current.run();
  });
  expect(separate).not.toHaveBeenCalled();
  act(() => result.current.setSelected(['vocals']));
  await act(async () => {
    await Promise.all([result.current.run(), result.current.run()]);
  });
  expect(separate).toHaveBeenCalledTimes(1);
});

it('releases output URLs on remove, clear, and unmount', async () => {
  const { result, unmount } = renderHook(useStemSeparator);
  act(() => result.current.addFiles([file('one.wav'), file('two.wav'), file('three.wav')]));
  await act(async () => {
    await result.current.run();
  });
  act(() => result.current.remove(result.current.jobs[0].id));
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4);
  act(() => result.current.clearFinished());
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(12);
  act(() => result.current.addFiles([file('four.wav')]));
  await act(async () => {
    await result.current.run();
  });
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(16);
});
