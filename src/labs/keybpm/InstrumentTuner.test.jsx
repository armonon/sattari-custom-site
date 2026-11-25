import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import InstrumentTuner from './InstrumentTuner';
it('switches instrument targets and lets a detected song key select the scale', () => {
  render(
    <MemoryRouter>
      <InstrumentTuner songKey="F# minor" />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'violin' } });
  const strings = screen.getByRole('group', { name: 'Choose a string' });
  expect(within(strings).getAllByRole('button')).toHaveLength(4);
  expect(within(strings).getByRole('button', { name: /G3/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(within(strings).getByRole('button', { name: /E5/ }));
  expect(screen.getByText(/TARGET E5/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use song key: F# minor' }));
  expect(screen.getByLabelText('Scale root')).toHaveValue('6');
  expect(screen.getByLabelText('Scale type')).toHaveValue('minor');
  fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'chromatic' } });
  expect(screen.queryByRole('group', { name: 'Choose a string' })).not.toBeInTheDocument();
  expect(screen.getByText(/CHROMATIC/)).toBeInTheDocument();
});
