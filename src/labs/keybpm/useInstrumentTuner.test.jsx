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
  const clock = { time: 0, state: 'suspended' };
  const resume = vi.fn(async () => {
    clock.state = 'running';
    clock.time += 0.09;
  });
  const suspend = vi.fn(async () => {
    clock.state = 'suspended';
  });
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    'AudioContext',
    class {
      sampleRate = sampleRate;
      get currentTime() {
        return clock.time;
      }
      get state() {
        return clock.state;
      }
      suspend = suspend;
      resume = resume;
      close = close;
      createAnalyser = () => ({ getFloatTimeDomainData: read });
      createMediaStreamSource = () => ({ connect() {}, disconnect });
    }
  );
  return { stop, close, disconnect, getUserMedia, stream, resume, suspend, clock, track };
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
    f.resume.mockImplementation(() => new Promise(() => {}));
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
it('keeps Cancel available for a running but frozen input, retries once, and releases it', async () => {
  vi.useFakeTimers();
  try {
    const f = audioFixture();
    f.resume.mockImplementation(async () => {
      f.clock.state = 'running';
      f.clock.time = 0.01;
    });
    const { result } = renderHook(() => useInstrumentTuner());
    await act(async () => result.current.start());
    expect(result.current.status).toBe('requesting');
    await act(async () => vi.advanceTimersByTimeAsync(1800));
    expect(f.suspend).toHaveBeenCalledOnce();
    expect(f.resume).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('requesting');
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/input device/i);
    expect(f.stop).toHaveBeenCalledOnce();
    expect(f.close).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

it('reports a stall after listening and clears a previously detected note', async () => {
  vi.useFakeTimers();
  try {
    const f = audioFixture({
      read(data) {
        for (let i = 0; i < data.length; i++)
          data[i] = 0.2 * Math.sin((i * 2 * Math.PI * 82.4069) / 48000);
      },
    });
    const { result } = renderHook(() => useInstrumentTuner());
    await act(async () => result.current.start());
    expect(result.current.status).toBe('listening');
    expect(result.current.pitch?.midi).toBe(40);
    f.resume.mockImplementation(async () => {
      f.clock.state = 'running';
    });
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(result.current.pitch).toBeNull();
    expect(result.current.status).toBe('requesting');
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    expect(result.current.error).toMatch(/stopped responding/i);
    expect(f.stop).toHaveBeenCalledOnce();
    expect(f.close).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

it('recovers a frozen device and keeps silent audio with an advancing clock active', async () => {
  vi.useFakeTimers();
  try {
    const f = audioFixture();
    f.resume.mockImplementationOnce(async () => {
      f.clock.state = 'running';
    });
    const { result } = renderHook(() => useInstrumentTuner());
    await act(async () => result.current.start());
    await act(async () => vi.advanceTimersByTimeAsync(1800));
    expect(f.suspend).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('listening');
    const timer = setInterval(() => {
      f.clock.time += 0.09;
    }, 90);
    await act(async () => vi.advanceTimersByTimeAsync(7000));
    clearInterval(timer);
    expect(result.current.pitch).toBeNull();
    expect(result.current.status).toBe('listening');
    expect(f.stop).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it('releases a frozen input when the page hides before the recovery timer', async () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  try {
    const f = audioFixture();
    f.resume.mockImplementation(async () => {
      f.clock.state = 'running';
    });
    const { result } = renderHook(() => useInstrumentTuner());
    await act(async () => result.current.start());
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => vi.advanceTimersByTimeAsync(5500));
    expect(result.current.status).toBe('off');
    expect(result.current.error).toBe('');
    expect(f.suspend).not.toHaveBeenCalled();
    expect(f.close).toHaveBeenCalledOnce();
  } finally {
    hidden.mockRestore();
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
