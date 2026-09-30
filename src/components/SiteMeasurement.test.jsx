import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import SiteMeasurement from './SiteMeasurement';
import { trackSiteEvent } from '../utils/siteMeasurement';

vi.mock('../utils/siteMeasurement', () => ({
  measurementBlocked: () => false,
  measurementPreference: () => 'allowed',
  setMeasurementPreference: vi.fn(),
  trackSiteEvent: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

it('counts software download clicks without including filenames or treating demos as software', () => {
  render(
    <MemoryRouter initialEntries={['/downloads']}>
      <SiteMeasurement />
      <a download href="/downloads/build.pkg" onClick={(event) => event.preventDefault()}>
        Software
      </a>
      <a download href="/audio/demo.wav" onClick={(event) => event.preventDefault()}>
        Demo
      </a>
      <a
        download
        href="https://elsewhere.example/downloads/build.pkg"
        onClick={(event) => event.preventDefault()}
      >
        External
      </a>
    </MemoryRouter>
  );
  trackSiteEvent.mockClear();
  fireEvent.click(screen.getByText('Software'));
  fireEvent.click(screen.getByText('Demo'));
  fireEvent.click(screen.getByText('External'));
  expect(trackSiteEvent.mock.calls).toEqual([['software_download']]);
});
