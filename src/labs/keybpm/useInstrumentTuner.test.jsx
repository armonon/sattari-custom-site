import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useInstrumentTuner from './useInstrumentTuner';
afterEach(() => vi.unstubAllGlobals());
function audioFixture({ sampleRate = 48000, read = (data) => data.fill(0) } = {}) {
  const stop = vi.fn(),
    close = vi.fn(async () => {}),
    disconnect = vi.fn();
  const track = Object.assign(new EventTarget(), { stop, readyState: 'live' });
  const stream = { getTracks: () => [track] };
  const resume = vi.fn(async () => {});
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    'AudioContext',
    class {
      sampleRate = sampleRate;
      resume = resume;
      close = close;
      createAnalyser = () => ({ getFloatTimeDomainData: read });
      createMediaStreamSource = () => ({ connect() {}, disconnect });
    }
  );
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 7)
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return { stop, close, disconnect, getUserMedia, stream, resume, track };
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
it('immediately releases granted capture on cancellation while the audio device is opening', async () => {
  const f = audioFixture();
  let finish;
  f.resume.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { result } = renderHook(() => useInstrumentTuner());
  await act(async () => {
    void result.current.start();
  });
  expect(f.resume).toHaveBeenCalledOnce();
  act(() => result.current.stop());
  expect(f.stop).toHaveBeenCalledOnce();
  expect(f.close).toHaveBeenCalledOnce();
  // A late resume from the old device must not stop or overwrite its replacement.
  await act(async () => result.current.start());
  await act(async () => finish());
  expect(result.current.status).toBe('listening');
  expect(f.close).toHaveBeenCalledOnce();
});
it('releases a granted microphone if audio startup never finishes', async () => {
  vi.useFakeTimers();
  try {
    const f = audioFixture();
    f.resume.mockImplementationOnce(() => new Promise(() => {}));
    const { result } = renderHook(() => useInstrumentTuner());
    await act(async () => {
      void result.current.start();
    });
    act(() => vi.advanceTimersByTime(6500));
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/could not start/i);
    expect(f.stop).toHaveBeenCalledOnce();
    expect(f.close).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});
it.each(['before resume', 'after resume'])('releases an unplugged microphone %s', async (phase) => {
  const f = audioFixture();
  let finish;
  if (phase === 'before resume') {
    f.resume.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
  }
  const { result } = renderHook(() => useInstrumentTuner());
  await act(async () => {
    void result.current.start();
  });
  act(() => f.track.dispatchEvent(new Event('ended')));
  expect(f.stop).toHaveBeenCalledOnce();
  expect(f.close).toHaveBeenCalledOnce();
  expect(result.current.error).toMatch(/disconnected/i);
  if (finish) await act(async () => finish());
  expect(result.current.status).toBe('error');
  expect(result.current.pitch).toBeNull();
  expect(f.close).toHaveBeenCalledOnce();
});
it('recognizes a capture track that already ended before permission returned', async () => {
  const f = audioFixture();
  f.track.readyState = 'ended';
  const { result } = renderHook(() => useInstrumentTuner());
  await act(async () => result.current.start());
  expect(result.current.status).toBe('error');
  expect(f.resume).not.toHaveBeenCalled();
  expect(f.stop).toHaveBeenCalledOnce();
});
it.each([
  [44100, 30.8677],
  [96000, 41.2034],
  [176400, 41.2034],
  [192000, 30.8677],
])('detects a low bass string at %i Hz input and %f Hz pitch', async (sampleRate, frequency) => {
  audioFixture({
    sampleRate,
    read(data) {
      for (let i = 0; i < data.length; i++) {
        data[i] = 0.2 * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
      }
    },
  });
  const { result } = renderHook(() => useInstrumentTuner());
  await act(async () => result.current.start());
  act(() => requestAnimationFrame.mock.calls[0][0](100));
  expect(result.current.pitch?.frequency).toBeCloseTo(frequency, 1);
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
