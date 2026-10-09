import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useStemSeparator from './useStemSeparator';
import { decodeTrack } from '../utils/stemSeparator';

const { separate, dispose, loadSessions, saveSession, deleteSession } = vi.hoisted(() => ({
  separate: vi.fn(),
  dispose: vi.fn(),
  loadSessions: vi.fn(),
  saveSession: vi.fn(),
  deleteSession: vi.fn(),
}));
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
vi.mock('../utils/splitSessionStore', () => ({
  loadSplitSessions: loadSessions,
  saveSplitSession: saveSession,
  deleteSplitSession: deleteSession,
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
  loadSessions.mockResolvedValue({ sessions: [], warnings: [] });
  saveSession.mockResolvedValue(undefined);
  deleteSession.mockResolvedValue(undefined);
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

it('restores saved results and keeps interrupted sources available for retry', async () => {
  const source = file('recover.wav');
  loadSessions.mockResolvedValueOnce({
    sessions: [
      {
        id: 'done',
        file: source,
        status: 'done',
        outputs: [{ id: 'bass', blob: new Blob(['wav']), url: 'blob:restored' }],
        updatedAt: 1,
      },
      {
        id: 'interrupted',
        file: source,
        status: 'cancelled',
        message: 'Interrupted. Retry when ready.',
        outputs: [],
        updatedAt: 2,
      },
    ],
    warnings: [],
  });
  const { result } = renderHook(useStemSeparator);
  await waitFor(() => expect(result.current.jobs).toHaveLength(2));
  expect(result.current.jobs[0].outputs[0].url).toBe('blob:restored');
  expect(result.current.jobs[1]).toMatchObject({
    status: 'cancelled',
    message: 'Interrupted. Retry when ready.',
  });
});

it('does not restore old sessions after the user creates and removes a new queue', async () => {
  let resolveLoad;
  loadSessions.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveLoad = resolve;
    })
  );
  const { result } = renderHook(useStemSeparator);
  act(() => result.current.addFiles([file('temporary.wav')]));
  const temporaryId = result.current.jobs[0].id;
  act(() => result.current.remove(temporaryId));
  await act(async () => {
    resolveLoad({
      sessions: [{ id: 'old', file: file('old.wav'), status: 'done', outputs: [], updatedAt: 1 }],
      warnings: [],
    });
    await Promise.resolve();
  });
  expect(result.current.jobs).toEqual([]);
});

it('deletes valid saved sessions replaced before restoration completes', async () => {
  let resolveLoad;
  loadSessions.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveLoad = resolve;
    })
  );
  const { result } = renderHook(useStemSeparator);
  act(() => result.current.clearAll());
  await act(async () => {
    resolveLoad({
      sessions: [{ id: 'replaced', file: file('old.wav'), outputs: [] }],
      warnings: [],
    });
    await Promise.resolve();
  });
  await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('replaced'));
  expect(result.current.jobs).toEqual([]);
});

it('persists successful audio outputs in the local session store', async () => {
  const { result } = renderHook(useStemSeparator);
  act(() => result.current.addFiles([file('saved.wav')]));
  await act(async () => result.current.run());
  expect(saveSession).toHaveBeenCalledWith(
    expect.objectContaining({
      file: expect.objectContaining({ name: 'saved.wav' }),
      status: 'done',
      outputs: expect.arrayContaining([
        expect.objectContaining({ blob: expect.any(Blob), name: 'saved-vocals.wav' }),
      ]),
    })
  );
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

it('keeps song analysis before separation completes and individual stem measurements afterward', async () => {
  const song = { status: 'ready', key: 'C major', bpm: 120 };
  const stem = { status: 'ready', key: 'A minor', bpm: 60 };
  let finish;
  separate.mockImplementationOnce((_audio, _stems, _signal, _progress, onAnalysis) => {
    onAnalysis(song);
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const { result } = renderHook(useStemSeparator);
  act(() => result.current.addFiles([file('one.wav')]));
  let run;
  act(() => {
    run = result.current.run();
  });
  await waitFor(() => expect(result.current.jobs[0].analysis).toEqual(song));
  expect(result.current.jobs[0].status).toBe('processing');
  await act(async () => {
    finish([{ ...outputs(['bass'])[0], analysis: stem }]);
    await run;
  });
  expect(result.current.jobs[0].outputs[0].analysis).toEqual(stem);
  expect(result.current.jobs[0].analysis).toEqual(song);
});

it('does not lose song analysis if the model fails to load', async () => {
  separate.mockImplementationOnce(async (_audio, _stems, _signal, _progress, onAnalysis) => {
    onAnalysis({ status: 'ready', bpm: 120 });
    throw new Error('Model download failed');
  });
  const { result } = renderHook(useStemSeparator);
  act(() => result.current.addFiles([file('one.wav')]));
  await act(async () => {
    await result.current.run();
  });
  expect(result.current.jobs[0]).toMatchObject({ status: 'error', analysis: { bpm: 120 } });
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

it('runs the real demo pipeline with the selected stems and CPU preference', async () => {
  const fetchDemo = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['audio']) }));
  vi.stubGlobal('fetch', fetchDemo);
  const { result } = renderHook(useStemSeparator);
  act(() => {
    result.current.setSelected(['drums', 'bass']);
    result.current.setCpuOnly(true);
    result.current.addFiles([file('waiting.wav')]);
  });
  await act(async () => result.current.loadDemo());
  expect(result.current.jobs.map((job) => job.status)).toEqual(['queued', 'done']);
  expect(result.current.jobs[1].file.name).toBe('sattari-practice-demo.wav');
  expect(result.current.jobs[1].outputs.map((output) => output.id)).toEqual(['drums', 'bass']);
  expect(separate.mock.lastCall[5]).toBe(true);
  expect(result.current.loadingDemo).toBe(false);
  expect(fetchDemo.mock.calls[0][0]).toBe('/audio/sattari-practice-demo.wav');
});

it('cancels a pending demo fetch without adding or processing audio', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError'))
          );
        })
    )
  );
  const { result } = renderHook(useStemSeparator);
  let demo;
  act(() => {
    demo = result.current.loadDemo();
  });
  expect(result.current.loadingDemo).toBe(true);
  await act(async () => {
    result.current.cancel();
    await demo;
  });
  expect(result.current.loadingDemo).toBe(false);
  expect(result.current.jobs).toEqual([]);
  expect(separate).not.toHaveBeenCalled();
});

it('shows a failed demo request without leaving the page locked', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false }))
  );
  const { result } = renderHook(useStemSeparator);
  await act(async () => result.current.loadDemo());
  expect(result.current.errors[0]).toContain('demo could not load');
  expect(result.current.loadingDemo).toBe(false);
  expect(result.current.running).toBe(false);
});
