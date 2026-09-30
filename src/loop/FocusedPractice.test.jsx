import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FocusedPractice from './FocusedPractice';
import { DEMO } from './music';
import { GuitarProfileProvider } from './GuitarSetup';
import { readHistory } from './practicePlan';
import { lessonFingerprint } from './progress';

const { microphone } = vi.hoisted(() => ({
  microphone: {
    status: 'off',
    pitch: null,
    error: '',
    start: vi.fn(),
    stop: vi.fn(),
    calibration: { state: 'ready', threshold: 0.002 },
  },
}));
vi.mock('./useMicrophone', () => ({ default: () => microphone }));
vi.setConfig({ testTimeout: 120000 });
const lesson = {
  ...DEMO,
  notes: DEMO.notes.slice(0, 10).map((n, i) => ({ ...n, midi: i < 2 ? 64 : n.midi })),
};

beforeEach(() => {
  localStorage.clear();
  microphone.status = 'off';
  microphone.pitch = null;
  microphone.error = '';
  microphone.start.mockReset();
  microphone.stop.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

it('keeps source-song history valid when the guitar setup changes fingering', async () => {
  localStorage.setItem(
    'loop-guitar-profile-v1',
    JSON.stringify({ tuning: 'dropD', capo: 2, handedness: 'left' })
  );
  const short = { ...DEMO, id: 'setup-history', notes: DEMO.notes.slice(0, 1), phraseStarts: [0] };
  const onComplete = vi.fn();
  await act(async () =>
    render(
      <GuitarProfileProvider>
        <FocusedPractice
          lesson={short}
          sourceUrl={DEMO.audioUrl}
          onExit={vi.fn()}
          onComplete={onComplete}
          onChooseAnother={vi.fn()}
        />
      </GuitarProfileProvider>
    )
  );
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try it at my own pace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish phrase' }));
  fireEvent.click(screen.getByRole('button', { name: 'See my progress' }));
  expect(onComplete).toHaveBeenCalledWith(
    expect.objectContaining({ fingerprint: lessonFingerprint(short), matched: 0 })
  );
  expect(readHistory().at(-1)).toMatchObject({
    lessonId: short.id,
    fingerprint: lessonFingerprint(short),
  });
});

it('keeps self-guided completion separate from microphone matches and completes multiple phrases', () => {
  const complete = vi.fn();
  render(
    <FocusedPractice
      lesson={lesson}
      sourceUrl={DEMO.audioUrl}
      onExit={vi.fn()}
      onComplete={complete}
      onChooseAnother={vi.fn()}
    />
  );
  expect(microphone.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try it at my own pace' }));
  for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Next note' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish phrase' }));
  expect(
    screen.getByText('0 of 8 notes matched by microphone in this phrase.')
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next phrase' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try it at my own pace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next note' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish phrase' }));
  fireEvent.click(screen.getByRole('button', { name: 'See my progress' }));
  expect(complete).toHaveBeenCalledWith(
    expect.objectContaining({ matched: 0, total: 10, phrases: 2 })
  );
  expect(screen.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute(
    'aria-valuenow',
    '10'
  );
});

it('advances only for a correct held note, requires release for repeats, and stops the mic when exiting', () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const onExit = vi.fn();
  const props = {
    lesson,
    sourceUrl: DEMO.audioUrl,
    onExit,
    onComplete: vi.fn(),
    onChooseAnother: vi.fn(),
  };
  const page = render(<FocusedPractice {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Enable microphone' }));
  expect(microphone.start).toHaveBeenCalledOnce();
  microphone.status = 'listening';
  microphone.pitch = { midi: 40, cents: 0 };
  page.rerender(<FocusedPractice {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start with a clear signal' }));
  fireEvent.click(screen.getByRole('button', { name: 'My turn — let’s play' }));
  act(() => vi.advanceTimersByTime(500));
  const updatePitch = (midi, advance = 250) => {
    act(() => vi.advanceTimersByTime(advance));
    microphone.pitch = midi === null ? null : { midi, cents: 0 };
    page.rerender(<FocusedPractice {...props} />);
  };
  updatePitch(52);
  updatePitch(52);
  expect(screen.getByRole('status')).toHaveTextContent('Hearing E3. Aim for E4.');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  updatePitch(64);
  updatePitch(64);
  expect(screen.getByRole('status')).toHaveTextContent('You got it');
  act(() => vi.advanceTimersByTime(450));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  updatePitch(64);
  updatePitch(64);
  expect(screen.getByRole('status')).toHaveTextContent('Mute the string');
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  updatePitch(null);
  updatePitch(64);
  updatePitch(64);
  act(() => vi.advanceTimersByTime(450));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  fireEvent.click(screen.getByRole('button', { name: 'Exit practice' }));
  expect(microphone.stop).toHaveBeenCalled();
  expect(onExit).toHaveBeenCalledOnce();
});

it('keeps a denied microphone recoverable without inventing progress', () => {
  microphone.error = 'Microphone access was declined. Allow it in your browser, then try again.';
  render(
    <FocusedPractice
      lesson={lesson}
      sourceUrl={DEMO.audioUrl}
      onExit={vi.fn()}
      onComplete={vi.fn()}
      onChooseAnother={vi.fn()}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Microphone access was declined');
  expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  expect(screen.getByRole('button', { name: 'Try it at my own pace' })).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
});

it('resumes a partial phrase after leaving without inventing microphone matches', () => {
  const props = {
    lesson,
    sourceUrl: DEMO.audioUrl,
    onExit: vi.fn(),
    onComplete: vi.fn(),
    onChooseAnother: vi.fn(),
  };
  const first = render(<FocusedPractice {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try it at my own pace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next note' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next note' }));
  first.unmount();
  render(<FocusedPractice {...props} />);
  expect(screen.getByText(/Pick up at phrase 1, note 3/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  expect(screen.getByRole('button', { name: 'Next note' })).toBeInTheDocument();
});

it('keeps the current note when switching from self-guided practice into microphone setup', () => {
  const props = {
    lesson,
    sourceUrl: DEMO.audioUrl,
    onExit: vi.fn(),
    onComplete: vi.fn(),
    onChooseAnother: vi.fn(),
  };
  const view = render(<FocusedPractice {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try it at my own pace' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next note' }));
  fireEvent.click(screen.getByRole('button', { name: 'Use microphone' }));
  expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeInTheDocument();
  microphone.status = 'listening';
  microphone.pitch = { midi: 40, cents: 0 };
  view.rerender(<FocusedPractice {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start with a clear signal' }));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  expect(screen.getByRole('status')).toHaveTextContent('Hearing E2. Aim for E4.');
});

it('opens rhythm practice without requesting a microphone until the learner chooses to connect', () => {
  render(
    <FocusedPractice
      lesson={lesson}
      sourceUrl={DEMO.audioUrl}
      onExit={vi.fn()}
      onComplete={vi.fn()}
      onChooseAnother={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try it at my own pace' }));
  for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Next note' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish phrase' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try it in time' }));
  expect(screen.getByRole('heading', { name: 'Same notes. A little rhythm.' })).toBeInTheDocument();
  expect(microphone.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Connect microphone' }));
  expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeInTheDocument();
});
