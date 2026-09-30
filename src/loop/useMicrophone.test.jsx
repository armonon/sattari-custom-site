import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import useMicrophone from './useMicrophone';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('releases a microphone that is granted after the user cancels', async () => {
  let grant;
  const stop = vi.fn();
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    },
  });
  const { result } = renderHook(() => useMicrophone());
  let starting;
  act(() => {
    starting = result.current.start();
  });
  expect(result.current.status).toBe('requesting');
  act(() => result.current.stop());
  await act(async () => {
    grant({ getTracks: () => [{ stop }] });
    await starting;
  });
  expect(stop).toHaveBeenCalledOnce();
  expect(result.current.status).toBe('off');
});

it('explains declined permission without claiming to be listening', async () => {
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
    },
  });
  const { result } = renderHook(() => useMicrophone());
  await act(async () => {
    await result.current.start();
  });
  expect(result.current.status).toBe('off');
  expect(result.current.pitch).toBeNull();
  expect(result.current.error).toMatch(/declined/);
});

it('resets an unavailable selected input so retry can request the default device', async () => {
  const getUserMedia = vi
    .fn()
    .mockRejectedValue(new DOMException('Device removed', 'OverconstrainedError'));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const { result } = renderHook(() => useMicrophone());
  await act(async () => {
    await result.current.start('removed-interface');
  });
  expect(result.current.deviceId).toBe('');
  expect(result.current.error).toMatch(/default microphone is selected/);
  await act(async () => {
    await result.current.start();
  });
  expect(getUserMedia.mock.calls[1][0].audio.deviceId).toBeUndefined();
});

it('calibrates the room, detects a quiet guitar note, enumerates inputs and releases audio resources', async () => {
  let frame;
  let amplitude = 0.0001;
  let now = 0;
  const ended = {};
  const stop = vi.fn();
  const disconnect = vi.fn();
  const close = vi.fn().mockResolvedValue();
  const device = { kind: 'audioinput', deviceId: 'guitar-interface', label: 'Guitar interface' };
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [
          {
            stop,
            addEventListener: (event, callback) => {
              ended[event] = callback;
            },
          },
        ],
      }),
      enumerateDevices: vi.fn().mockResolvedValue([device]),
    },
  });
  vi.stubGlobal(
    'AudioContext',
    class {
      sampleRate = 44100;
      resume = () => Promise.resolve();
      close = close;
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect });
      createAnalyser = () => ({
        fftSize: 2048,
        getFloatTimeDomainData: (data) => {
          for (let i = 0; i < data.length; i++)
            data[i] = amplitude * Math.sin((2 * Math.PI * 329.6276 * i) / 44100);
        },
      });
    }
  );
  const { result, unmount } = renderHook(() => useMicrophone());
  await act(async () => {
    await result.current.start('guitar-interface');
  });
  expect(result.current.devices).toEqual([device]);
  expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
    expect.objectContaining({
      audio: expect.objectContaining({ deviceId: { exact: 'guitar-interface' } }),
    })
  );
  act(() => result.current.calibrate());
  for (let time = 100; time <= 1900; time += 100)
    act(() => {
      now = time;
      frame(time);
    });
  expect(result.current.calibration.state).toBe('ready');
  expect(result.current.pitch).toBeNull();
  amplitude = 0.01;
  act(() => {
    now = 2000;
    frame(now);
  });
  expect(result.current.pitch).toMatchObject({ midi: 64, onsetId: 1 });
  expect(result.current.level.rms).toBeGreaterThan(0.006);
  act(() => ended.ended());
  expect(result.current.status).toBe('off');
  expect(result.current.error).toMatch(/disconnected/);
  expect(stop).toHaveBeenCalledOnce();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  unmount();
  vi.restoreAllMocks();
});
