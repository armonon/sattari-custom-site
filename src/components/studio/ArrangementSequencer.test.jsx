import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ArrangementSequencer from './ArrangementSequencer';

let saved;
function Host({ initial = { start: 0, duration: 2, notes: [] }, bpm = 120, audition = () => {} }) {
  const [clip, setClip] = useState(initial);
  saved = clip;
  return (
    <ArrangementSequencer
      clip={clip}
      bpm={bpm}
      onChange={(updates) => setClip((previous) => ({ ...previous, ...updates }))}
      onAudition={audition}
    />
  );
}

it('creates timed drum notes, auditions and toggles hits with editable velocity', () => {
  const audition = vi.fn();
  render(<Host audition={audition} />);
  fireEvent.click(screen.getByRole('button', { name: 'Snare step 5', exact: true }));
  expect(saved.notes[0]).toMatchObject({ pitch: 'D2', time: 0.5, duration: 0.1, velocity: 0.8 });
  expect(audition).toHaveBeenCalledWith(saved.notes[0]);
  fireEvent.change(screen.getByRole('slider', { name: 'Velocity step 5', exact: true }), {
    target: { value: '43' },
  });
  expect(saved.notes[0].velocity).toBe(0.43);
  fireEvent.click(screen.getByRole('button', { name: 'Snare step 5', exact: true }));
  expect(saved.notes).toEqual([]);
});

it('preserves free-timed notes and appends a bar without overwriting later music', () => {
  const notes = [
    { id: 'free', pitch: 'C2', time: 0.032, duration: 0.33, velocity: 0.7 },
    { id: 'later', pitch: 'D2', time: 2.5, duration: 0.2, velocity: 0.5 },
  ];
  render(<Host initial={{ start: 0, duration: 4, notes }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Kick step 1', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Kick step 1', exact: true }));
  expect(saved.notes).toEqual(notes);
  fireEvent.click(screen.getByRole('button', { name: 'Copy bar to end' }));
  expect(saved.duration).toBe(6);
  expect(saved.notes.slice(0, 2)).toEqual(notes);
  expect(saved.notes[2]).toMatchObject({ pitch: 'C2', time: 4.032, duration: 0.33 });
  expect(saved.notes[2].id).not.toBe('free');
  expect(screen.getByRole('spinbutton', { name: 'Beat bar' })).toHaveValue(3);
});

it('respects partial clip boundaries and project tempo', () => {
  render(<Host initial={{ start: 0, duration: 0.7, notes: [] }} bpm={60} />);
  expect(screen.getByRole('button', { name: 'Kick step 4', exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Kick step 3', exact: true }));
  expect(saved.notes[0].time).toBe(0.5);
  expect(saved.notes[0].duration).toBeCloseTo(0.2);
});

it('extends repeatedly into empty bars without copying or changing earlier hits', () => {
  const notes = [{ id: 'free', pitch: 'C2', time: 0.032, duration: 0.33, velocity: 0.7 }];
  render(<Host initial={{ start: 8, duration: 2, notes }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add empty bar' }));
  expect(saved.duration).toBe(4);
  expect(saved.notes).toEqual(notes);
  expect(screen.getByRole('status')).toHaveTextContent('Bar 2 of 2');
  expect(screen.getByRole('button', { name: 'Kick step 1', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Snare step 5', exact: true }));
  expect(saved.notes[1]).toMatchObject({ pitch: 'D2', time: 2.5 });
  fireEvent.click(screen.getByRole('button', { name: 'Add empty bar' }));
  expect(saved.duration).toBe(6);
  expect(saved.notes).toHaveLength(2);
  expect(screen.getByRole('spinbutton', { name: 'Beat bar' })).toHaveValue(3);
  fireEvent.click(screen.getByRole('button', { name: 'Previous beat bar' }));
  expect(screen.getByRole('button', { name: 'Snare step 5', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

it('appends on the next bar boundary at the project tempo from a partial bar', () => {
  render(<Host initial={{ start: 0, duration: 0.7, notes: [] }} bpm={60} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add empty bar' }));
  expect(saved.duration).toBe(8);
  fireEvent.click(screen.getByRole('button', { name: 'Kick step 1', exact: true }));
  expect(saved.notes[0].time).toBe(4);
});

it.each([
  { duration: 2, disabled: true },
  { duration: 86400, disabled: false },
])('prevents extension at the length limit or when editing is disabled: %j', (state) => {
  const onChange = vi.fn();
  render(
    <ArrangementSequencer
      clip={{ start: 0, notes: [], duration: state.duration }}
      bpm={120}
      disabled={state.disabled}
      onChange={onChange}
      onAudition={() => {}}
    />
  );
  expect(screen.getByRole('button', { name: 'Add empty bar' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Add empty bar' }));
  expect(onChange).not.toHaveBeenCalled();
});

it('keeps long patterns bounded to a single visible bar and stops edits when disabled', () => {
  const onChange = vi.fn();
  render(
    <ArrangementSequencer
      clip={{ start: 0, duration: 86400, notes: [] }}
      bpm={120}
      disabled
      onChange={onChange}
      onAudition={() => {}}
    />
  );
  expect(screen.getAllByRole('button', { name: / step / })).toHaveLength(80);
  fireEvent.click(screen.getByRole('button', { name: 'Kick step 1', exact: true }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Copy bar to end' })).toBeDisabled();
});
