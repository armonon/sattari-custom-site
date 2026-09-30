import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { importScore } from './scoreImport';
let worker;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'Worker',
    class {
      terminate = vi.fn();
      postMessage = vi.fn();
      constructor() {
        Object.assign(
          this,
          (worker = { terminate: this.terminate, postMessage: this.postMessage })
        );
        return worker;
      }
    }
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const file = () => ({ size: 20, arrayBuffer: async () => new ArrayBuffer(20) });
it('returns score tracks and disposes of the parser worker', async () => {
  const pending = importScore(file());
  await Promise.resolve();
  expect(worker.postMessage).toHaveBeenCalledWith(
    { cmd: 'loop.import', bytes: expect.any(ArrayBuffer) },
    [expect.any(ArrayBuffer)]
  );
  worker.onmessage({ data: { tracks: [{ title: 'Test score' }] } });
  expect(await pending).toEqual([{ title: 'Test score' }]);
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it('cancels parsing and rejects stale results', async () => {
  const controller = new AbortController();
  const pending = importScore(file(), { signal: controller.signal });
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await Promise.resolve();
  controller.abort();
  worker.onmessage({ data: { tracks: [{ title: 'Stale' }] } });
  await rejected;
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it('bounds parser time and reports malformed scores', async () => {
  const pending = importScore(file());
  const rejected = expect(pending).rejects.toThrow('too long');
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(20000);
  await rejected;
  expect(worker.terminate).toHaveBeenCalledOnce();
  const malformed = importScore(file());
  const error = expect(malformed).rejects.toThrow('Bad score');
  await Promise.resolve();
  worker.onmessage({ data: { error: 'Bad score' } });
  await error;
});
