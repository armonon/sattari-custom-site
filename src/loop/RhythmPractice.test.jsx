import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import RhythmPractice from './RhythmPractice';

vi.setConfig({ testTimeout: 120000 });
let now, frame, contexts;
const phrase = {
  start: 0,
  end: 1,
  notes: [
    { midi: 64, start: 0, end: 0.45, beatDuration: 1, index: 0 },
    { midi: 65, start: 0.5, end: 0.95, beatDuration: 1, index: 1 },
  ],
};
beforeEach(() => {
  now = 0;
  contexts = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'AudioContext',
    class {
      currentTime = 0;
      outputLatency = 0;
      resume = vi.fn().mockResolvedValue();
      close = vi.fn().mockResolvedValue();
      createOscillator = vi.fn(() => ({
        frequency: {},
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }));
      createGain = () => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      });
      constructor() {
        contexts.push(this);
      }
    }
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('counts in, scores a real onset once, and saves pitch and timing separately', async () => {
  const mic = { status: 'listening', pitch: null };
  const onDone = vi.fn();
  const props = { phrase, bpm: 120, mic, initialSpeed: 1, onDone, onBack: vi.fn() };
  const view = render(<RhythmPractice {...props} />);
  expect(contexts).toHaveLength(0);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start four-beat count-in' }));
  });
  expect(screen.getByText('Get ready…')).toBeInTheDocument();
  expect(contexts[0].createOscillator).toHaveBeenCalledTimes(6);
  act(() => {
    now = 2150;
    frame();
  });
  mic.pitch = { midi: 64, cents: 0, onsetId: 1, onsetAt: 2150, observedAt: 2150 };
  view.rerender(<RhythmPractice {...props} />);
  mic.pitch = { ...mic.pitch, observedAt: 2190 };
  view.rerender(<RhythmPractice {...props} />);
  expect(screen.getByText('On time')).toBeInTheDocument();
  act(() => {
    now = 3600;
    frame();
  });
  expect(contexts[0].close).toHaveBeenCalledOnce();
  expect(screen.getByText('Missed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save this attempt' }));
  expect(onDone).toHaveBeenCalledWith({
    reliable: true,
    onTime: 1,
    pitch: 1,
    total: 2,
    extras: 0,
    speed: 1,
    review: [1],
  });
});

it('stops all scheduled audio when the microphone disconnects', async () => {
  const mic = { status: 'listening', pitch: null, start: vi.fn() };
  const props = { phrase, bpm: 120, mic, initialSpeed: 1, onDone: vi.fn(), onBack: vi.fn() };
  const view = render(<RhythmPractice {...props} />);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start four-beat count-in' }));
  });
  mic.status = 'off';
  view.rerender(<RhythmPractice {...props} />);
  expect(contexts[0].close).toHaveBeenCalledOnce();
  expect(screen.getByRole('alert')).toHaveTextContent('microphone paused');
  expect(props.onDone).not.toHaveBeenCalled();
});

it('closes a metronome when leaving before the audio context finishes resuming', async () => {
  let resume;
  vi.stubGlobal(
    'AudioContext',
    class {
      close = vi.fn().mockResolvedValue();
      resume = () =>
        new Promise((resolve) => {
          resume = resolve;
        });
      constructor() {
        contexts.push(this);
      }
    }
  );
  const view = render(
    <RhythmPractice
      phrase={phrase}
      bpm={120}
      mic={{ status: 'listening' }}
      initialSpeed={1}
      onDone={vi.fn()}
      onBack={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Start four-beat count-in' }));
  view.unmount();
  await act(async () => resume());
  expect(contexts[0].close).toHaveBeenCalledOnce();
});
