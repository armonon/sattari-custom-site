import { afterEach, expect, it, vi } from 'vitest';
import { createStemArchive } from './stemSeparatorDownload';

afterEach(() => vi.unstubAllGlobals());
const setup = () => {
  const worker = { postMessage: vi.fn(), terminate: vi.fn() };
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        return worker;
      }
    }
  );
  return worker;
};

it('packages only named blobs in a worker and releases it on completion', async () => {
  const worker = setup(),
    blob = new Blob(['wave']);
  const promise = createStemArchive(
    [
      {
        file: { name: 'song.wav' },
        outputs: [{ name: 'song-bass.wav', blob, url: 'blob:preview', peaks: [1] }],
      },
    ],
    new AbortController().signal
  );
  expect(worker.postMessage).toHaveBeenCalledWith([
    { name: 'song.wav', outputs: [{ name: 'song-bass.wav', blob }] },
  ]);
  worker.onmessage({ data: { blob } });
  expect(await promise).toBe(blob);
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('cancels a ZIP immediately without affecting the original stem blobs', async () => {
  const worker = setup(),
    controller = new AbortController();
  const promise = createStemArchive([], controller.signal);
  controller.abort();
  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  expect(worker.terminate).toHaveBeenCalledOnce();
});

it('includes song and stem analysis in a portable report without URLs or waveform buffers', async () => {
  const worker = setup(),
    blob = new Blob(['wave']);
  const promise = createStemArchive(
    [
      {
        file: { name: 'song.wav' },
        analysis: { status: 'ready', key: 'A minor' },
        outputs: [
          {
            id: 'bass',
            name: 'song-bass.wav',
            blob,
            url: 'blob:private',
            peaks: [1],
            analysis: { bpm: 120 },
          },
        ],
      },
    ],
    new AbortController().signal
  );
  const report = worker.postMessage.mock.calls[0][0][0].report;
  expect(report.song.key).toBe('A minor');
  expect(report.stems).toEqual([{ id: 'bass', file: 'song-bass.wav', analysis: { bpm: 120 } }]);
  expect(JSON.stringify(report)).not.toContain('blob:private');
  worker.onmessage({ data: { blob } });
  await promise;
});

it('surfaces worker failures and terminates the packaging worker', async () => {
  const worker = setup();
  const promise = createStemArchive([], new AbortController().signal);
  worker.onerror();
  await expect(promise).rejects.toThrow('Download individual tracks or stems');
  expect(worker.terminate).toHaveBeenCalledOnce();
});
