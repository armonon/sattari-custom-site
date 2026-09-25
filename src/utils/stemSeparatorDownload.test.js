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

it('surfaces worker failures and terminates the packaging worker', async () => {
  const worker = setup();
  const promise = createStemArchive([], new AbortController().signal);
  worker.onerror();
  await expect(promise).rejects.toThrow('Download individual tracks or stems');
  expect(worker.terminate).toHaveBeenCalledOnce();
});
