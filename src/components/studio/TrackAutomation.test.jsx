import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import TrackAutomation from './TrackAutomation';
import { audioTrack } from '../../utils/arrangementModel';
import { newEffect } from '../../utils/arrangementEffects';

it('edits native device parameters using their real range and clears the override', () => {
  const effect = newEffect('eq');
  let current;
  function Host() {
    const [track, setTrack] = useState({ ...audioTrack('Keys'), effects: [effect] });
    current = track;
    return (
      <TrackAutomation
        track={track}
        duration={20}
        onChange={(automation) => setTrack({ ...track, automation })}
      />
    );
  }
  render(<Host />);
  fireEvent.change(screen.getByLabelText('Track automation parameter'), {
    target: { value: `fx:${effect.id}:low` },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add envelope' }));
  expect(current.automation[`fx:${effect.id}:low`]).toEqual([
    { time: 0, value: 0 },
    { time: 20, value: 0 },
  ]);
  fireEvent.keyDown(
    screen.getByRole('button', { name: 'Automation point 1: 0.00 seconds, 0.00' }),
    { key: 'ArrowDown' }
  );
  expect(current.automation[`fx:${effect.id}:low`][0].value).toBe(-0.36);
  fireEvent.click(screen.getByRole('button', { name: 'Clear envelope' }));
  expect(current.automation).toEqual({});
});
