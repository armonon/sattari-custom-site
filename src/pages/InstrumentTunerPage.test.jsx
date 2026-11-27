import { fireEvent, render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it } from 'vitest';
import InstrumentTunerPage from './InstrumentTunerPage';

function open(path) {
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tuner/:instrument" element={<InstrumentTunerPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

function displayedStrings() {
  const strings = screen.getByRole('group', { name: 'Choose a string' });
  return within(strings)
    .getAllByRole('button')
    .map((button) => button.querySelector('strong').firstChild.textContent);
}

it.each([
  ['guitar', ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], 'E2'],
  ['violin', ['G3', 'D4', 'A4', 'E5'], 'G3'],
  ['viola', ['C3', 'G3', 'D4', 'A4'], 'C3'],
  ['cello', ['C2', 'G2', 'D3', 'A3'], 'C2'],
  ['bass', ['E1', 'A1', 'D2', 'G2'], 'E1'],
  ['ukulele', ['G4', 'C4', 'E4', 'A4'], 'C4'],
])('opens the %s tuner with its playable strings and scale', (slug, strings, firstScaleNote) => {
  open('/tuner/' + slug);
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Online ' + slug + ' tuner');
  expect(screen.getByLabelText('Tuning')).toHaveValue(slug);
  expect(displayedStrings()).toEqual(strings);
  const scale = screen.getByRole('group', { name: 'Scale notes' });
  expect(within(scale).getAllByRole('button')[0]).toHaveTextContent(firstScaleNote);
  expect(screen.getByRole('button', { name: 'Start live tuner' })).toBeEnabled();
});

it('opens a linked tuner in the right octave when the route changes without a reload', () => {
  open('/tuner/cello');
  fireEvent.change(screen.getByLabelText('Concert A'), { target: { value: '442' } });
  fireEvent.click(screen.getByRole('link', { name: 'Compare viola tuning' }));
  expect(screen.getByLabelText('Tuning')).toHaveValue('viola');
  expect(screen.getByLabelText('Concert A')).toHaveValue('440');
  expect(displayedStrings()).toEqual(['C3', 'G3', 'D4', 'A4']);
  expect(screen.getByRole('button', { name: 'Hear C3' })).toBeEnabled();
});

it.each([
  ['guitar', 'drop-d', ['D2', 'A2', 'D3', 'G3', 'B3', 'E4']],
  ['bass', 'bass-five', ['B0', 'E1', 'A1', 'D2', 'G2']],
])('allows the alternate %s tuning on the same canonical page', (slug, preset, notes) => {
  open('/tuner/' + slug);
  fireEvent.change(screen.getByLabelText('Tuning'), { target: { value: preset } });
  expect(displayedStrings()).toEqual(notes);
});

it('does not substitute guitar content for unknown instrument URLs', () => {
  open('/tuner/flute');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  expect(screen.queryByRole('button', { name: 'Start live tuner' })).toBeNull();
});

it('opens the low-B product link directly and rejects presets from different instruments', () => {
  open('/tuner/bass?preset=bass-five');
  expect(screen.getByLabelText('Tuning')).toHaveValue('bass-five');
  expect(displayedStrings()).toEqual(['B0', 'E1', 'A1', 'D2', 'G2']);
});
it('falls back to a published preset for invalid query parameters', () => {
  open('/tuner/violin?preset=bass-five');
  expect(screen.getByLabelText('Tuning')).toHaveValue('violin');
});
