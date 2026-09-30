import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { preparePcmCapture } from './pcmCapture';
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('AudioWorkletNode', class {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('shares one worklet load per AudioContext before the countdown', async () => {
  const context = { audioWorklet: { addModule: vi.fn().mockResolvedValue() } };
  await Promise.all([preparePcmCapture(context), preparePcmCapture(context)]);
  await preparePcmCapture(context);
  expect(context.audioWorklet.addModule).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it('cancels module preparation immediately even when a download never resolves', async () => {
  const context = { audioWorklet: { addModule: () => new Promise(() => {}) } };
  const controller = new AbortController();
  const pending = preparePcmCapture(context, { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(vi.getTimerCount()).toBe(0);
});
it('times out an unresponsive module loader and allows a failed module to retry', async () => {
  const hanging = { audioWorklet: { addModule: () => new Promise(() => {}) } };
  const pending = preparePcmCapture(hanging);
  const assertion = expect(pending).rejects.toThrow(/recorder could not load/);
  await vi.advanceTimersByTimeAsync(10000);
  await assertion;
  const retrying = {
    audioWorklet: {
      addModule: vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(),
    },
  };
  await expect(preparePcmCapture(retrying)).rejects.toThrow('Offline');
  await preparePcmCapture(retrying);
  expect(retrying.audioWorklet.addModule).toHaveBeenCalledTimes(2);
});
