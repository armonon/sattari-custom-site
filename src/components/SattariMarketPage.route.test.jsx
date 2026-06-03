import { render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { CartProvider } from '../context/CartContext';

beforeEach(() => {
  const storage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
  });
  vi.stubGlobal('localStorage', storage);
});

function renderAppAtRoute(route) {
  return render(
    <HelmetProvider>
      <CartProvider>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </CartProvider>
    </HelmetProvider>
  );
}

describe('Sattari Market route smoke', () => {
  it('redirects the public /market route back to the shop surface', async () => {
    renderAppAtRoute('/market');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /build your setup with instruments/i,
      })
    ).toBeInTheDocument();

    expect(screen.queryByRole('heading', { level: 1, name: 'Sattari Market' })).toBeNull();
  });

  it('renders the noindexed internal market concept route with source lanes, sample listings, and hard guardrails', async () => {
    renderAppAtRoute('/internal/market-concept');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Sattari Market' })
    ).toBeInTheDocument();

    expect(
      screen.getByText('Buy, sell, and discover music gear through trusted musician profiles.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /shop official sattari products/i })).toHaveAttribute(
      'href',
      '/shop'
    );
    expect(screen.getByRole('link', { name: /ask about local services/i })).toHaveAttribute(
      'href',
      '/services'
    );

    const disclosure = screen.getByRole('note', { name: /prototype disclosure/i });
    expect(disclosure).toHaveTextContent('without adding live marketplace connectors');
    expect(disclosure).toHaveTextContent('checkout');
    expect(disclosure).toHaveTextContent('scraping');
    expect(disclosure).toHaveTextContent('external messaging');

    expect(
      screen.getByRole('heading', { name: /built first around musicians and studios/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Drums & cymbals').length).toBeGreaterThan(0);
    expect(screen.getByText('Lessons, repairs & rentals')).toBeInTheDocument();

    const sourceRegion = screen.getByText('External marketplace links').closest('article');
    expect(sourceRegion).toBeInTheDocument();
    expect(within(sourceRegion).getByText('Approval/compliance gated')).toBeInTheDocument();
    expect(sourceRegion).toHaveTextContent('link-out/source-label concepts only');

    const listingPanel = screen
      .getByRole('heading', {
        name: /listing cards show source and readiness/i,
      })
      .closest('section');
    expect(listingPanel).toBeInTheDocument();
    expect(
      within(listingPanel).getByText('Pirouz Series cymbal — demo condition')
    ).toBeInTheDocument();
    expect(within(listingPanel).getByText('External link placeholder')).toBeInTheDocument();
    expect(within(listingPanel).getByText('Link-out concept only')).toBeInTheDocument();

    const guardrails = screen
      .getByRole('heading', { name: /what this page does not do yet/i })
      .closest('section');
    expect(guardrails).toBeInTheDocument();
    expect(guardrails).toHaveTextContent('No scraping or live third-party marketplace sync');
    expect(guardrails).toHaveTextContent('No checkout, escrow, payments, shipping labels');
    expect(guardrails).toHaveTextContent('No external buyer/seller messages');
    expect(guardrails).toHaveTextContent('No official marketplace partnership');
  });
});
