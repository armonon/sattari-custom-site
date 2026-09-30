import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useMicrophone from './useMicrophone';
import { capturePcm, preparePcmCapture } from './pcmCapture';
vi.mock('./pcmCapture', () => ({ capturePcm: vi.fn(), preparePcmCapture: vi.fn() }));
const stop = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi
        .fn()
        .mockResolvedValue({ getTracks: () => [{ stop, addEventListener: vi.fn() }] }),
    },
  });
  vi.stubGlobal(
    'AudioContext',
    class {
      resume = () => Promise.resolve();
      close = () => Promise.resolve();
      createAnalyser = () => ({ fftSize: 2048 });
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() });
    }
  );
});
afterEach(() => vi.unstubAllGlobals());
it('aborts recorder preparation when an input disconnects', async () => {
  const { result } = renderHook(() => useMicrophone());
  await act(async () => result.current.start());
  let finish;
  preparePcmCapture.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const pending = result.current.prepareRecording();
  act(() => result.current.stop());
  expect(preparePcmCapture.mock.calls[0][1].signal.aborted).toBe(true);
  finish();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
it('requires an explicit active microphone and refuses overlapping takes', async () => {
  const { result } = renderHook(() => useMicrophone());
  await expect(result.current.record()).rejects.toThrow(/Connect your microphone/);
  await act(async () => result.current.start());
  let finish;
  capturePcm.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const pending = result.current.record();
  await expect(result.current.record()).rejects.toThrow(/already in progress/);
  const samples = new Float32Array(120000);
  finish({ samples, rate: 48000, inputFrames: samples.length });
  expect(await pending).toMatchObject({ samples, rate: 48000, noiseFloor: 0.002 });
});
it('aborts a take on microphone release and ignores a late audio callback', async () => {
  const { result } = renderHook(() => useMicrophone());
  await act(async () => result.current.start());
  let finish;
  capturePcm.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const pending = result.current.record();
  act(() => result.current.stop());
  expect(capturePcm.mock.calls[0][2].signal.aborted).toBe(true);
  finish({ samples: new Float32Array(120000), inputFrames: 120000, rate: 48000 });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(stop).toHaveBeenCalledOnce();
});
it('rejects a take with missing audio blocks instead of grading inserted silence', async () => {
  const { result } = renderHook(() => useMicrophone());
  await act(async () => result.current.start());
  capturePcm.mockResolvedValue({
    samples: new Float32Array(120000),
    inputFrames: 60000,
    rate: 48000,
  });
  await expect(result.current.record()).rejects.toThrow(/lost audio/);
});
