import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
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

it('counts a product link on the originating sales page before React Router navigates', () => {
  const path = '/shop/guitars-los-angeles';
  render(
    <MemoryRouter initialEntries={[path]}>
      <SiteMeasurement />
      <Link to="/product/five-string-bass-guitar">
        <span>See bass</span>
      </Link>
    </MemoryRouter>
  );
  trackSiteEvent.mockClear();
  fireEvent.click(screen.getByText('See bass'));
  expect(trackSiteEvent.mock.calls[0]).toEqual(['product_link_click', path]);
  expect(
    trackSiteEvent.mock.calls.filter(([event]) => event === 'product_link_click')
  ).toHaveLength(1);
});

it('does not count a product URL on another origin as a shop click', () => {
  render(
    <MemoryRouter initialEntries={['/tuner/guitar']}>
      <SiteMeasurement />
      <a
        href="https://elsewhere.example/product/guitar"
        onClick={(event) => event.preventDefault()}
      >
        External product
      </a>
    </MemoryRouter>
  );
  trackSiteEvent.mockClear();
  fireEvent.click(screen.getByText('External product'));
  expect(trackSiteEvent).not.toHaveBeenCalled();
});
