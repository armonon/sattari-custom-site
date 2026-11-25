import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import * as liveInput from './useInstrumentTuner';
import * as referenceOutput from './useTunerReference';
import * as measurement from '../../utils/siteMeasurement';
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
  expect(screen.getByLabelText('Scale root')).toHaveValue('F#');
  expect(screen.getByLabelText('Scale type')).toHaveValue('minor');
  fireEvent.change(screen.getByLabelText('Instrument'), { target: { value: 'chromatic' } });
  expect(screen.queryByRole('group', { name: 'Choose a string' })).not.toBeInTheDocument();
  expect(screen.getByText(/CHROMATIC/)).toBeInTheDocument();
});

it('keeps a flat song key when opening its practice scale', () => {
  render(
    <MemoryRouter>
      <InstrumentTuner songKey="B♭ major" />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Use song key: B♭ major' }));
  expect(screen.getByLabelText('Scale root')).toHaveValue('Bb');
  const notes = within(screen.getByRole('group', { name: 'Scale notes' }));
  expect(
    notes.getAllByRole('button').map((button) => button.querySelector('strong').textContent)
  ).toEqual(['B♭3', 'C4', 'D4', 'E♭4', 'F4', 'G4', 'A4', 'B♭4']);
});

it('asks to check the string and octave when a low E is played against the high E target', () => {
  const mic = vi.spyOn(liveInput, 'default').mockReturnValue({
    status: 'listening',
    pitch: { frequency: 82.4069 },
    error: '',
    start: vi.fn(),
    stop: vi.fn(),
  });
  try {
    render(
      <MemoryRouter>
        <InstrumentTuner />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /E4.*High E/ }));
    expect(screen.getByText(/Heard E2.*check the string and octave for E4/i)).toBeInTheDocument();
    expect(screen.queryByText(/raise the pitch/i)).not.toBeInTheDocument();
    expect(mic.mock.results.at(-1).value.stop).not.toHaveBeenCalled();
  } finally {
    mic.mockRestore();
  }
});

it('measures one confirmed reference and microphone start per visit and skips failed attempts', () => {
  const input = { status: 'requesting', pitch: null, error: '', start: vi.fn(), stop: vi.fn() };
  const reference = { referenceOn: true, startingAudio: true };
  const mic = vi.spyOn(liveInput, 'default').mockImplementation(() => input);
  const audio = vi.spyOn(referenceOutput, 'default').mockImplementation(() => reference);
  const events = vi.spyOn(measurement, 'trackSiteEvent').mockReturnValue(true);
  const workspace = () => (
    <MemoryRouter>
      <InstrumentTuner />
    </MemoryRouter>
  );
  try {
    const { rerender } = render(workspace());
    expect(events).not.toHaveBeenCalled();
    reference.referenceOn = false;
    reference.startingAudio = false;
    input.status = 'error';
    rerender(workspace());
    expect(events).not.toHaveBeenCalled();
    reference.referenceOn = true;
    rerender(workspace());
    input.status = 'listening';
    reference.referenceOn = false;
    rerender(workspace());
    input.status = 'off';
    reference.referenceOn = true;
    rerender(workspace());
    input.status = 'listening';
    rerender(workspace());
    expect(events.mock.calls).toEqual([['tuner_reference_started'], ['tuner_microphone_started']]);
  } finally {
    events.mockRestore();
    audio.mockRestore();
    mic.mockRestore();
  }
});
