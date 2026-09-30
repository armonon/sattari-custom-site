import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { analyzeStrum } from './strumClient';
let worker;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        const events = {};
        worker = {
          postMessage: vi.fn(),
          terminate: vi.fn(),
          get onmessage() {
            return events.message;
          },
          set onmessage(value) {
            events.message = value;
          },
          get onerror() {
            return events.error;
          },
          set onerror(value) {
            events.error = value;
          },
        };
        return worker;
      }
    }
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const take = () => ({ samples: new Float32Array(50000), rate: 22050, noiseFloor: 0.002 });
it('transfers PCM and frees the worker when a result arrives', async () => {
  const audio = take();
  const pending = analyzeStrum(audio, [40, 47, 52]);
  expect(worker.postMessage).toHaveBeenCalledWith({ ...audio, expected: [40, 47, 52] }, [
    audio.samples.buffer,
  ]);
  worker.onmessage({ data: { result: { status: 'not-confirmed' } } });
  expect(await pending).toEqual({ status: 'not-confirmed' });
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it('rejects and terminates a cancelled check before accepting late output', async () => {
  const controller = new AbortController();
  const pending = analyzeStrum(take(), [40], { signal: controller.signal });
  controller.abort();
  worker.onmessage({ data: { result: { status: 'matched' } } });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it('has a bounded timeout for an unresponsive model worker', async () => {
  const pending = analyzeStrum(take(), [40]);
  const assertion = expect(pending).rejects.toThrow(/too long/);
  await vi.advanceTimersByTimeAsync(90000);
  await assertion;
  expect(worker.terminate).toHaveBeenCalledOnce();
});
it('exposes model loading failure as recoverable feedback', async () => {
  const pending = analyzeStrum(take(), [40]);
  worker.onerror();
  await expect(pending).rejects.toThrow(/could not load/);
  expect(worker.terminate).toHaveBeenCalledOnce();
});
