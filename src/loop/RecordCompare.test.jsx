import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RecordCompare from './RecordCompare';
import { DEMO, phrasesFor } from './music';
import { mediaStore } from './lessonMedia';

vi.mock('./lessonMedia', async (load) => ({ ...(await load()), mediaStore: vi.fn() }));
vi.setConfig({ testTimeout: 120000 });
const phrase = phrasesFor(DEMO)[0];
let mic;
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(mediaStore).mockReset().mockResolvedValue([]);
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:take'), revokeObjectURL: vi.fn() });
  mic = {
    start: vi.fn().mockResolvedValue(),
    stop: vi.fn(),
    prepareRecording: vi.fn().mockResolvedValue(),
    record: vi.fn().mockResolvedValue({ samples: new Float32Array(16000), rate: 16000 }),
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function mount() {
  let view;
  await act(async () => {
    view = render(
      <RecordCompare
        lesson={DEMO}
        phrase={phrase}
        mic={mic}
        speed={0.75}
        sourceUrl={DEMO.audioUrl}
      />
    );
  });
  // Opening is a real user action; a closed details panel cannot start a take.
  fireEvent.click(screen.getByText('Record & compare', { selector: 'summary' }));
  return view;
}
it('records after the count-in, saves the real PCM, and keeps it ungraded', async () => {
  await mount();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /Record \d+-second take/ }))
  );
  expect(mic.record).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(mic.record).toHaveBeenCalledWith(
    expect.objectContaining({
      seconds: (phrase.end - phrase.start) / 0.75 + 0.5,
      signal: expect.any(AbortSignal),
    })
  );
  const value = vi.mocked(mediaStore).mock.calls.find(([action]) => action === 'save')[1];
  expect(value).toMatchObject({ kind: 'take', speed: 0.75, seconds: 1 });
  expect(value.blob.size).toBe(32044);
  expect(screen.getByText(/does not award a score/)).toBeInTheDocument();
  expect(screen.getByText('Lesson example')).toBeInTheDocument();
  expect(mic.stop).toHaveBeenCalled();
});
it('cancels the count-in without capturing or saving a take', async () => {
  await mount();
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: /Record \d+-second take/ }))
  );
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel recording' })));
  await act(async () => vi.advanceTimersByTimeAsync(4000));
  expect(mic.record).not.toHaveBeenCalled();
  expect(mediaStore).not.toHaveBeenCalledWith('save', expect.anything());
  expect(mic.stop).toHaveBeenCalled();
});
it('releases a microphone granted after the user leaves the recorder', async () => {
  let grant;
  mic.start.mockImplementation(
    () =>
      new Promise((resolve) => {
        grant = resolve;
      })
  );
  const view = await mount();
  fireEvent.click(screen.getByRole('button', { name: /Record \d+-second take/ }));
  view.unmount();
  const stoppedBeforeGrant = mic.stop.mock.calls.length;
  await act(async () => grant());
  expect(mic.stop.mock.calls.length).toBeGreaterThan(stoppedBeforeGrant);
  expect(mic.prepareRecording).not.toHaveBeenCalled();
});
