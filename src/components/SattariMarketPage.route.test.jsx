import { render, screen } from '@testing-library/react';
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

  document.head.innerHTML = '';
});

function renderAppAtRoute(pathname) {
  return render(
    <HelmetProvider>
      <CartProvider>
        <MemoryRouter initialEntries={[pathname]}>
          <App />
        </MemoryRouter>
      </CartProvider>
    </HelmetProvider>
  );
}

describe('public tab exposure smoke', () => {
  it('keeps Market, Profiles, Radio, and Downloads out of public navigation', () => {
    renderAppAtRoute('/');

    expect(screen.queryByRole('link', { name: /^market$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^profiles$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^radio$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^downloads$/i })).not.toBeInTheDocument();
  });

  it('redirects removed public routes away from their old surfaces', async () => {
    renderAppAtRoute('/radio');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Drums First. Always.' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: /sattari radio/i })
    ).not.toBeInTheDocument();
  });

  it('keeps /market pointed at the shop instead of a marketplace tab', async () => {
    renderAppAtRoute('/market');

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /build your setup with instruments, accessories, and handcrafted sattari gear/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 1, name: /sattari market/i })
    ).not.toBeInTheDocument();
  });
});
