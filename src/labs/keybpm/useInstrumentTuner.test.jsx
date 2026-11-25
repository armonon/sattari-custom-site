import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useInstrumentTuner from './useInstrumentTuner';
afterEach(() => vi.unstubAllGlobals());
function audioFixture() {
  const stop = vi.fn(),
    close = vi.fn(async () => {}),
    disconnect = vi.fn();
  const stream = { getTracks: () => [{ stop, addEventListener: vi.fn() }] };
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    'AudioContext',
    class {
      sampleRate = 48000;
      resume = async () => {};
      close = close;
      createAnalyser = () => ({ getFloatTimeDomainData: (data) => data.fill(0) });
      createMediaStreamSource = () => ({ connect() {}, disconnect });
    }
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 7)
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return { stop, close, disconnect, getUserMedia, stream };
}
it('requires explicit start and releases microphone and context on stop and unmount', async () => {
  const f = audioFixture();
  const { result, unmount } = renderHook(() => useInstrumentTuner());
  expect(f.getUserMedia).not.toHaveBeenCalled();
  await act(async () => result.current.start());
  expect(result.current.status).toBe('listening');
  act(() => result.current.stop());
  expect(f.stop).toHaveBeenCalledTimes(1);
  expect(f.close).toHaveBeenCalledTimes(1);
  expect(result.current.pitch).toBeNull();
  expect(result.current.status).toBe('off');
  await act(async () => result.current.start());
  unmount();
  expect(f.stop).toHaveBeenCalledTimes(2);
});
it('stops a stream returned after the request was cancelled', async () => {
  const f = audioFixture();
  let resolve;
  f.getUserMedia.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const { result } = renderHook(() => useInstrumentTuner());
  act(() => {
    void result.current.start();
  });
  act(() => result.current.stop());
  await act(async () => resolve(f.stream));
  expect(f.stop).toHaveBeenCalledTimes(1);
  expect(result.current.status).toBe('off');
  expect(f.close).not.toHaveBeenCalled();
});
it('shows permission failure without pretending to listen', async () => {
  const f = audioFixture();
  f.getUserMedia.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  const { result } = renderHook(() => useInstrumentTuner());
  await act(async () => result.current.start());
  expect(result.current.status).toBe('error');
  expect(result.current.error).toMatch(/not allowed/);
});
it('stops listening when reference audio begins or the page is hidden', async () => {
  const f = audioFixture();
  const { result } = renderHook(() => useInstrumentTuner());
  await act(async () => result.current.start());
  act(() => window.dispatchEvent(new Event('sattari:reference-tone')));
  await waitFor(() => expect(result.current.status).toBe('off'));
  expect(f.stop).toHaveBeenCalledTimes(1);
  await act(async () => result.current.start());
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(result.current.status).toBe('off');
  expect(f.stop).toHaveBeenCalledTimes(2);
  hidden.mockRestore();
});
