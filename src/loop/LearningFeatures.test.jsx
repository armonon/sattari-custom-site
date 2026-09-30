import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AdaptiveDrill from './AdaptiveDrill';
import LessonPlanner from './LessonPlanner';
import { fingeringFor } from './HandDemonstration';
import { DEMO, phrasesFor } from './music';

const { mic, trial } = vi.hoisted(() => ({
  mic: { stop: vi.fn() },
  trial: { result: null, props: null },
}));
vi.mock('./useMicrophone', () => ({ default: () => mic }));
vi.mock('./MicrophoneSetup', () => ({
  default: ({ onReady }) => <button onClick={onReady}>Ready to play</button>,
}));
vi.mock('./RhythmPractice', () => ({
  default: (props) => {
    trial.props = props;
    return <button onClick={() => props.onDone(trial.result)}>Finish simulated attempt</button>;
  },
}));
vi.setConfig({ testTimeout: 120000 });
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

it('keeps custom lessons behind import review and sends the chosen passage and level', async () => {
  const onStart = vi.fn();
  const view = render(<LessonPlanner lesson={DEMO} ready={false} onStart={onStart} />);
  expect(screen.getByRole('button', { name: 'Start this lesson' })).toBeDisabled();
  view.rerender(<LessonPlanner lesson={DEMO} ready onStart={onStart} />);
  fireEvent.change(screen.getByLabelText('From phrase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Through phrase'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Arrangement'), { target: { value: 'essentials' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start this lesson' })));
  expect(onStart).toHaveBeenCalledWith({ first: 2, last: 2, part: 'melody', level: 'essentials' });
});

it('keeps the same drill after unreliable input and reconnects the phrase after a clean pass', () => {
  const phrase = phrasesFor(DEMO)[0];
  render(
    <AdaptiveDrill
      phrase={phrase}
      bpm={DEMO.bpm}
      result={{ total: 8, onTime: 6, review: [4], speed: 0.75 }}
      onExit={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Ready to play' }));
  expect(trial.props.phrase.notes).toHaveLength(3);
  expect(trial.props.initialSpeed).toBe(0.5);
  trial.result = { reliable: false, total: 3, onTime: 0, extras: 0 };
  fireEvent.click(screen.getByRole('button', { name: 'Finish simulated attempt' }));
  fireEvent.click(screen.getByRole('button', { name: 'Try this step again' }));
  expect(trial.props.phrase.notes).toHaveLength(3);
  expect(trial.props.initialSpeed).toBe(0.5);
  trial.result = { reliable: true, total: 3, onTime: 3, extras: 0 };
  fireEvent.click(screen.getByRole('button', { name: 'Finish simulated attempt' }));
  fireEvent.click(screen.getByRole('button', { name: 'Build up the phrase' }));
  expect(trial.props.phrase.notes).toEqual(phrase.notes);
  expect(trial.props.initialSpeed).toBe(0.75);
});

it('shows position shifts instead of assigning every high fret to the little finger', () => {
  const notes = [{ fret: 0 }, { fret: 3 }, { fret: 5 }, { fret: 9 }];
  expect(fingeringFor(notes[0], notes)).toMatchObject({ finger: 0 });
  expect(fingeringFor(notes[1], notes)).toEqual({ position: 3, finger: 1 });
  expect(fingeringFor(notes[3], notes)).toEqual({ position: 7, finger: 3 });
});
