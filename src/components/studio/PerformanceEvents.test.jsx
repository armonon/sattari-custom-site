import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import PerformanceEvents from './PerformanceEvents';

it('keeps original capture history while editing times, arguments and enabled state', () => {
  const build = vi.fn();
  let current;
  function Host() {
    const [capture, setCapture] = useState({
      name: 'Take',
      assetId: 'safety',
      duration: 10,
      events: [{ time: 1, type: 'setDeckGain', args: ['A', 100] }],
    });
    current = capture;
    return <PerformanceEvents capture={capture} onChange={setCapture} onBuild={build} />;
  }
  render(<Host />);
  fireEvent.click(screen.getByText('Take · 1 events'));
  fireEvent.click(screen.getByText('Edit controls'));
  fireEvent.change(screen.getByLabelText('Event 1 Gain'), { target: { value: '80' } });
  expect(current.events[0].args).toEqual(['A', 80]);
  fireEvent.change(screen.getByLabelText('Event 1 time'), { target: { value: '2.5' } });
  fireEvent.click(screen.getByText('Event values'));
  fireEvent.blur(screen.getByLabelText('Event 1 arguments'), { target: { value: '["A", 75]' } });
  expect(current.events[0]).toMatchObject({ time: 2.5, args: ['A', 75] });
  expect(current.originalEvents[0]).toMatchObject({ time: 1, args: ['A', 100] });
  fireEvent.click(screen.getByLabelText('Enabled'));
  expect(current.events[0].disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Build editable source replay' }));
  expect(build).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Restore original events' }));
  expect(current.events[0]).toEqual({ time: 1, type: 'setDeckGain', args: ['A', 100] });
});
