import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import HomePage from './HomePage';

vi.mock('../components/HomeHeroBackground', () => ({
  default: () => <div data-testid="hero-video-background" />,
}));

const renderHome = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </HelmetProvider>
  );

it('layers the transparent instrument artwork over the dynamic hero background', () => {
  const { container } = renderHome();
  expect(screen.getByTestId('hero-video-background')).toBeInTheDocument();
  expect(container.querySelector('.home-hero-art')).toHaveAttribute(
    'src',
    '/images/home/sattari-instruments-cutout.png'
  );
});

it('keeps the three main Hub destinations on the homepage', () => {
  renderHome();
  expect(screen.getByRole('link', { name: 'Open Sattari Studio' })).toHaveAttribute(
    'href',
    '/studio'
  );
  expect(screen.getByRole('link', { name: 'Open Sattari Learn' })).toHaveAttribute(
    'href',
    '/learn'
  );
  expect(screen.getByRole('link', { name: 'Open Sattari Stem Separator' })).toHaveAttribute(
    'href',
    '/stem-separator'
  );
  expect(screen.getByRole('link', { name: 'Enter the Hub' })).toHaveAttribute('href', '/hub');
});

it('introduces a worldwide music company without advertising worldwide shipping', () => {
  const { container } = renderHome();
  expect(screen.getByText('For musicians worldwide')).toBeInTheDocument();
  expect(container.querySelector('.home-hero-description')).toHaveTextContent(
    'Learn guitar. Find your instrument. Create music.'
  );
  expect(container.textContent).not.toMatch(/worldwide shipping|global delivery/i);
  expect(screen.getByRole('link', { name: /Instrument repair/ })).toHaveAttribute(
    'href',
    '/services/instrument-repair-los-angeles'
  );
});

it('lets visitors call to arrange an appointment without implying shop opening hours', () => {
  renderHome();
  expect(
    screen.getByRole('link', { name: 'By appointment only. Call to arrange your visit.' })
  ).toHaveAttribute('href', 'tel:+14244653020');
  expect(screen.getByText('Studio & rehearsal / Every day, 6 PM to midnight')).toBeInTheDocument();
});

it('omits the listening desk, extra promotions, development row and listening shortcut', () => {
  const { container } = renderHome();
  expect(container.querySelector('audio')).toBeNull();
  expect(container.querySelector('a[href="#hub-listening-desk"]')).toBeNull();
  expect(container.querySelector('a[href="/guides"]')).toBeNull();
  expect(container.querySelector('a[href="/downloads"]')).toBeNull();
  for (const label of [
    'Listening desk',
    'Inside the groove',
    'In development',
    'Radio',
    'Community',
    'Instrument market',
  ]) {
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  }
});
