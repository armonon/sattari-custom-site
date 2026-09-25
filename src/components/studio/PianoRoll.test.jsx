/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PianoRoll from './PianoRoll';

it('aligns seven naturals and five accidentals with all 192 editable steps', () => {
  const toggle = vi.fn();
  const clear = vi.fn();
  const { container, rerender } = render(
    <PianoRoll notes={[]} onToggleNote={toggle} onClear={clear} />
  );
  expect(container.querySelectorAll('.sd-piano-key.is-natural')).toHaveLength(7);
  expect(container.querySelectorAll('.sd-piano-key.is-accidental')).toHaveLength(5);
  expect(container.querySelectorAll('.sd-piano-row > button')).toHaveLength(192);
  expect(screen.getByRole('button', { name: 'Clear piano notes' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'C4 step 1', exact: true }));
  expect(toggle).toHaveBeenCalledWith('C4', 0);
  rerender(
    <PianoRoll
      notes={[{ pitch: 'C4', step: 0, velocity: 96 }]}
      onToggleNote={toggle}
      onClear={clear}
    />
  );
  expect(screen.getByRole('button', { name: 'C4 step 1', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(container.querySelectorAll('.sd-piano-key.has-notes')).toHaveLength(1);
  expect(screen.getByText('1 note')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear piano notes' }));
  expect(clear).toHaveBeenCalledOnce();
  expect(screen.getByText('Pattern sketch · not in playback')).toBeInTheDocument();
});
