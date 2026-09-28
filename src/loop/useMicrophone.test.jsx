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
