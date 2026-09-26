import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ArrangementNotes from './ArrangementNotes';
const audition = vi.fn();
let saved;
function Host() {
  const [notes, setNotes] = useState([]);
  saved = notes;
  return (
    <ArrangementNotes
      clip={{ duration: 8, notes }}
      bpm={120}
      onChange={setNotes}
      onAudition={audition}
    />
  );
}
function pointer(target, type, x, extra = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX: x,
    clientY: 100,
    ...extra,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  fireEvent(target, event);
}

it('opens captured notes at their actual register and keeps compact editing tools reachable', () => {
  const notes = [{ pitch: 'C2', time: 0, duration: 1, velocity: 0.7 }];
  const change = vi.fn();
  render(
    <ArrangementNotes
      compact
      clip={{ duration: 8, notes }}
      bpm={120}
      onChange={change}
      onAudition={audition}
    />
  );
  expect(screen.getByLabelText('Piano octave')).toHaveValue('2');
  expect(screen.getByRole('button', { name: 'Select C2 note 1' })).toBeInTheDocument();
  expect(screen.getByText('Selection, velocity & quantize').closest('details')).not.toHaveAttribute(
    'open'
  );
  fireEvent.click(screen.getByText('Selection, velocity & quantize'));
  fireEvent.click(screen.getByRole('button', { name: 'Quantize notes' }));
  expect(change).toHaveBeenCalledWith(notes);
});

it('keeps the grid visible while placing notes freely by default, with optional snap and bypass', () => {
  const { container } = render(<Host />);
  const grid = screen.getByRole('button', { name: 'Add C4 note', exact: true });
  const snap = screen.getByRole('button', { name: 'Snap note positions to grid' });
  expect(snap).toHaveAttribute('aria-pressed', 'false');
  expect(container.querySelector('.ae-note-grid')).toBeInTheDocument();
  fireEvent.click(grid, { clientX: 31, detail: 1 });
  expect(saved[0].time).toBeCloseTo(31 / 192);
  fireEvent.click(snap);
  fireEvent.click(grid, { clientX: 31, detail: 1 });
  expect(saved[1].time).toBe(0.125);
  fireEvent.click(grid, { clientX: 31, detail: 1, altKey: true });
  expect(saved[2].time).toBeCloseTo(31 / 192);
});

it('moves freely, snaps the absolute onset when enabled, and bypasses snap with Alt', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Add C4 note', exact: true }), {
    clientX: 31,
    detail: 1,
  });
  const note = screen.getByRole('button', { name: 'Select C4 note 1' });
  pointer(note, 'pointerdown', 100);
  pointer(note, 'pointermove', 111);
  pointer(note, 'pointerup', 111);
  expect(saved[0].time).toBeCloseTo(42 / 192);
  fireEvent.click(screen.getByRole('button', { name: 'Snap note positions to grid' }));
  pointer(note, 'pointerdown', 100);
  pointer(note, 'pointermove', 111);
  pointer(note, 'pointerup', 111);
  expect(saved[0].time).toBe(0.25);
  pointer(note, 'pointerdown', 100);
  pointer(note, 'pointermove', 107, { altKey: true });
  pointer(note, 'pointerup', 107);
  expect(saved[0].time).toBeCloseTo(0.25 + 7 / 192);
});

it('resizes note lengths continuously even when position snapping is enabled', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Add C4 note', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Snap note positions to grid' }));
  const note = screen.getByRole('button', { name: 'Select C4 note 1' });
  pointer(note.querySelector('[data-resize]'), 'pointerdown', 100);
  pointer(note, 'pointermove', 107);
  pointer(note, 'pointerup', 107);
  expect(saved[0].duration).toBeCloseTo(0.125 + 7 / 192);
  expect(saved[0].time).toBe(0);
  fireEvent.change(screen.getByLabelText('Note duration (s)'), { target: { value: '.137' } });
  expect(saved[0].duration).toBe(0.137);
  expect(screen.getByLabelText('Note duration (s)')).toHaveAttribute('step', 'any');
  expect(screen.getByLabelText('Note start (s)')).toHaveAttribute('step', 'any');
});

it('keeps free resizing inside the clip and cancels an unfinished gesture without saving it', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Add C4 note', exact: true }));
  const note = screen.getByRole('button', { name: 'Select C4 note 1' });
  pointer(note.querySelector('[data-resize]'), 'pointerdown', 100);
  pointer(note, 'pointermove', 107);
  pointer(note, 'pointercancel', 107);
  expect(saved[0].duration).toBe(0.125);
  pointer(note.querySelector('[data-resize]'), 'pointerdown', 100);
  pointer(note, 'pointermove', 10000);
  pointer(note, 'pointerup', 10000);
  expect(saved[0].duration).toBe(8);
});
it('creates and edits notes over multiple bars and octaves with independent velocity and length', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Add C4 note', exact: true }));
  expect(saved[0]).toMatchObject({ pitch: 'C4', time: 0, velocity: 0.7 });
  fireEvent.change(screen.getByLabelText('Note duration (s)'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Note velocity'), { target: { value: '127' } });
  expect(saved[0]).toMatchObject({ duration: 1, velocity: 1 });
  fireEvent.change(screen.getByLabelText('Piano octave'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Later notes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add C2 note', exact: true }));
  expect(saved[1]).toMatchObject({ pitch: 'C2', time: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
  expect(saved).toHaveLength(1);
});
it('moves chords, duplicates notes and edits their velocity together', () => {
  render(<Host />);
  fireEvent.click(screen.getByLabelText('Add C4 note'));
  fireEvent.click(screen.getByLabelText('Add E4 note'));
  const controls = within(screen.getByText('Selection, velocity & quantize').closest('details'));
  const roll = screen.getByLabelText('Piano roll');
  fireEvent.click(controls.getByRole('button', { name: 'Select all notes' }));
  fireEvent.keyDown(roll, {
    key: 'ArrowUp',
    shiftKey: true,
  });
  expect(saved.map((note) => note.pitch)).toEqual(['C5', 'E5']);
  fireEvent.change(screen.getByLabelText('Selected notes velocity'), { target: { value: '127' } });
  expect(saved.every((note) => note.velocity === 1)).toBe(true);
  fireEvent.click(controls.getByRole('button', { name: 'Duplicate notes' }));
  expect(saved).toHaveLength(4);
  expect(saved[2].time).toBe(0.125);
  fireEvent.keyDown(roll, { key: 'Delete' });
  expect(saved).toHaveLength(2);
});

it('offers triplets, snaps pitches into scale, and auditions the full selected note', () => {
  render(<Host />);
  fireEvent.change(screen.getByLabelText('Note grid'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Scale root'), { target: { value: '0' } });
  fireEvent.click(screen.getByLabelText('Snap new/moved notes to scale'));
  fireEvent.click(screen.getByRole('button', { name: 'Add C#4 note', exact: true }));
  expect(saved[0].pitch).toBe('C4');
  expect(saved[0].duration).toBeCloseTo(1 / 6);
  fireEvent.keyDown(screen.getByRole('region', { name: 'Piano roll' }), { key: 'ArrowUp' });
  expect(saved[0].pitch).toBe('D4');
  fireEvent.click(screen.getByRole('button', { name: 'Select D4 note 1' }));
  expect(audition).toHaveBeenLastCalledWith(saved[0]);
});

it('erases notes without auditioning and switches tools through scoped shortcuts', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Add C4 note', exact: true }));
  audition.mockClear();
  const roll = screen.getByRole('region', { name: 'Piano roll', exact: true });
  fireEvent.keyDown(roll, { key: 'e' });
  expect(screen.getByRole('button', { name: 'Erase notes' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Select C4 note 1' }));
  expect(saved).toEqual([]);
  expect(audition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add E4 note', exact: true }));
  expect(saved).toEqual([]);
  fireEvent.keyDown(roll, { key: 'b' });
  fireEvent.click(screen.getByRole('button', { name: 'Add E4 note', exact: true }));
  expect(saved).toHaveLength(1);
  fireEvent.keyDown(roll, { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Delete notes' })).toBeDisabled();
});

it('can edit silently without disabling instrument playback or changing written notes', () => {
  render(<Host />);
  fireEvent.click(screen.getByRole('button', { name: 'Audition notes', exact: true }));
  audition.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Add C4 note', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Audition C4', exact: true }));
  expect(saved[0]).toMatchObject({ pitch: 'C4', velocity: 0.7 });
  expect(audition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Audition notes', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Audition C4', exact: true }));
  expect(audition).toHaveBeenLastCalledWith(saved[0]);
});

it('fits the whole pattern and shows a clip-relative playhead only inside its bounds', () => {
  const { container, rerender } = render(
    <ArrangementNotes clip={{ duration: 8, notes: [] }} bpm={120} onChange={vi.fn()} playhead={2} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Fit pattern' }));
  expect(Number(screen.getByRole('slider', { name: 'Note zoom' }).value)).toBe(56);
  expect(container.querySelector('.pr-playhead')).toHaveStyle({ left: '304px' });
  rerender(
    <ArrangementNotes clip={{ duration: 8, notes: [] }} bpm={120} onChange={vi.fn()} playhead={9} />
  );
  expect(container.querySelector('.pr-playhead')).not.toBeInTheDocument();
});

it('keeps velocity editing attached to its note while virtualizing the full keyboard', () => {
  const { container } = render(<Host />);
  expect(container.querySelectorAll('.pr-key-slot').length).toBeLessThan(40);
  expect(container.querySelectorAll('.pr-key-slot.is-black').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Add C4 note', exact: true }));
  fireEvent.change(screen.getByRole('slider', { name: 'Velocity note 1' }), {
    target: { value: '64' },
  });
  expect(saved[0].velocity).toBeCloseTo(64 / 127);
  expect(container.querySelector('.pr-velocity-bar')).toBeInTheDocument();
  const viewport = screen.getByRole('region', {
    name: 'Piano notes, scroll to change pitch or time',
  });
  const seen = new Set();
  for (let top = 0; top <= 108 * 28; top += 140) {
    fireEvent.scroll(viewport, { target: { scrollTop: top } });
    for (const key of container.querySelectorAll('.ae-key'))
      seen.add(key.getAttribute('aria-label'));
  }
  expect(seen.size).toBe(108);
  expect(screen.getByRole('button', { name: 'Add C0 note', exact: true })).toBeInTheDocument();
});

it('updates the playback cursor from the transport clock and stops animation when unmounted', () => {
  let nextFrame;
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    nextFrame = callback;
    return 42;
  });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  const positionRef = { current: 11 };
  const { container, unmount } = render(
    <ArrangementNotes
      clip={{ start: 10, duration: 8, notes: [] }}
      bpm={120}
      onChange={vi.fn()}
      positionRef={positionRef}
      playing
      playhead={0}
    />
  );
  try {
    act(() => nextFrame(0));
    expect(container.querySelector('.pr-playhead')).toHaveStyle({ left: '272px' });
    positionRef.current = 20;
    act(() => nextFrame(40));
    expect(container.querySelector('.pr-playhead')).toHaveAttribute('hidden');
    unmount();
    expect(cancel).toHaveBeenCalledWith(42);
  } finally {
    request.mockRestore();
    cancel.mockRestore();
  }
});
