import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ChordCoach from './ChordCoach';
import { DEMO } from './music';
const { mic } = vi.hoisted(() => ({
  mic: {
    status: 'off',
    pitch: null,
    error: '',
    start: vi.fn(),
    stop: vi.fn(),
    calibration: { state: 'ready', threshold: 0.002 },
  },
}));
vi.mock('./useMicrophone', () => ({ default: () => mic }));
const lesson = {
  ...DEMO,
  chords: [
    { name: 'C', start: 0, end: 2 },
    { name: 'G', start: 2, end: 4 },
  ],
};
beforeEach(() => {
  localStorage.clear();
  mic.status = 'off';
  mic.pitch = null;
  mic.error = '';
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

it('teaches each sounding string and keeps manual exploration out of saved matches', () => {
  render(<ChordCoach lesson={lesson} onExit={vi.fn()} />);
  expect(mic.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  expect(screen.getByRole('heading', { name: 'Pluck string 5 · A' })).toBeInTheDocument();
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Next string' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish shape' }));
  expect(screen.getByRole('heading', { name: '0 of 5 strings matched.' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(`loop-chord-progress-v1:${lesson.id}`)).matched).toEqual(
    []
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next chord' }));
  expect(screen.getByRole('heading', { name: 'Build your G.' })).toBeInTheDocument();
});

it('rejects wrong octaves and sharp notes, scores a held correct note once and releases input on exit', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  mic.status = 'listening';
  mic.pitch = { midi: 40, cents: 0 };
  const onExit = vi.fn();
  const page = render(<ChordCoach lesson={lesson} onExit={onExit} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start with a clear signal' }));
  const hear = (midi, cents = 0) => {
    mic.pitch = { midi, cents };
    page.rerender(<ChordCoach lesson={lesson} onExit={onExit} />);
  };
  hear(60);
  act(() => vi.advanceTimersByTime(300));
  hear(60);
  expect(screen.getByRole('heading', { name: 'Pluck string 5 · A' })).toBeInTheDocument();
  hear(48, 48);
  act(() => vi.advanceTimersByTime(300));
  hear(48, 48);
  expect(screen.getByRole('heading', { name: 'Pluck string 5 · A' })).toBeInTheDocument();
  hear(48);
  act(() => vi.advanceTimersByTime(190));
  hear(48);
  expect(screen.getByText('Clear and in tune. You got it!')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(460));
  expect(screen.getByRole('heading', { name: 'Pluck string 4 · D' })).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(`loop-chord-progress-v1:${lesson.id}`)).matched).toEqual([
    'C:1',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Back to song' }));
  expect(mic.stop).toHaveBeenCalled();
  expect(onExit).toHaveBeenCalledOnce();
});

it('offers recovery when microphone permission fails and never scores that recovery', () => {
  mic.error = 'Microphone access was declined.';
  render(<ChordCoach lesson={lesson} onExit={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('declined');
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  expect(screen.getByRole('button', { name: 'Next string' })).toBeEnabled();
});

it('discards old chord scores after a guide edit', () => {
  localStorage.setItem(
    `loop-chord-progress-v1:${lesson.id}`,
    JSON.stringify({ fingerprint: 'old', matched: ['C:1', 'C:2', 'C:3', 'C:4', 'C:5'] })
  );
  render(<ChordCoach lesson={lesson} onExit={vi.fn()} />);
  expect(JSON.parse(localStorage.getItem(`loop-chord-progress-v1:${lesson.id}`)).matched).toEqual(
    []
  );
});
