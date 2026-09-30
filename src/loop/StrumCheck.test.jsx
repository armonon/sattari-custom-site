import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import StrumCheck from './StrumCheck';
import { analyzeStrum } from './strumClient';
vi.mock('./strumClient', () => ({ analyzeStrum: vi.fn() }));
const notes = [
  { midi: 48, string: 1 },
  { midi: 52, string: 2 },
];
const take = { samples: new Float32Array(55000), rate: 22050, noiseFloor: 0.002 };
const mic = { status: 'listening', stop: vi.fn(), record: vi.fn(), prepareRecording: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mic.record.mockResolvedValue(take);
  mic.prepareRecording.mockResolvedValue();
});
afterEach(() => vi.useRealTimers());
const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Try a whole chord check' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
};
it('loads the recorder before starting the count so a first strum cannot be lost', async () => {
  let ready;
  mic.prepareRecording.mockImplementation(
    () =>
      new Promise((resolve) => {
        ready = resolve;
      })
  );
  analyzeStrum.mockResolvedValue({ status: 'quiet', heard: [], extra: [] });
  render(<StrumCheck mic={mic} notes={notes} onMatch={vi.fn()} />);
  await start();
  expect(screen.getByText('Getting the recorder ready…')).toBeInTheDocument();
  expect(mic.record).not.toHaveBeenCalled();
  await act(async () => ready());
  expect(screen.getByText('Get ready · 3')).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(mic.record).toHaveBeenCalledOnce();
});
it('records only after the count, releases the microphone and awards actual matched output', async () => {
  analyzeStrum.mockResolvedValue({ status: 'matched', heard: [48, 52], extra: [] });
  const onMatch = vi.fn();
  render(<StrumCheck mic={mic} notes={notes} onMatch={onMatch} />);
  expect(mic.record).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Try a whole chord check' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2900);
  });
  expect(mic.record).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(mic.record).toHaveBeenCalledOnce();
  expect(mic.stop).toHaveBeenCalled();
  expect(analyzeStrum).toHaveBeenCalledWith(
    take,
    [48, 52],
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
  expect(onMatch).toHaveBeenCalledOnce();
  expect(screen.getByText('All shape notes heard together. Nice work!')).toBeInTheDocument();
});
it.each(['not-confirmed', 'quiet', 'clipped'])('never awards %s output', async (status) => {
  analyzeStrum.mockResolvedValue({ status, heard: [48], extra: [] });
  const onMatch = vi.fn();
  render(<StrumCheck mic={mic} notes={notes} onMatch={onMatch} />);
  await start();
  expect(onMatch).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Check another strum' })).toBeEnabled();
});
it('ignores a cancelled worker result and aborts its signal', async () => {
  let finish;
  analyzeStrum.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const onMatch = vi.fn();
  render(<StrumCheck mic={mic} notes={notes} onMatch={onMatch} />);
  await start();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel strum check' }));
  expect(analyzeStrum.mock.calls[0][2].signal.aborted).toBe(true);
  await act(async () => finish({ status: 'matched', heard: [48, 52], extra: [] }));
  expect(onMatch).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Try a whole chord check' })).toBeEnabled();
});
it('unmounting during countdown stops input without recording', async () => {
  const page = render(<StrumCheck mic={mic} notes={notes} onMatch={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Try a whole chord check' }));
  page.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(mic.record).not.toHaveBeenCalled();
  expect(mic.stop).toHaveBeenCalled();
});
it('shows capture failures with a retry and no credit', async () => {
  mic.record.mockRejectedValue(new Error('Microphone disconnected.'));
  const onMatch = vi.fn();
  render(<StrumCheck mic={mic} notes={notes} onMatch={onMatch} />);
  await start();
  expect(screen.getByRole('alert')).toHaveTextContent('Microphone disconnected.');
  expect(onMatch).not.toHaveBeenCalled();
});
