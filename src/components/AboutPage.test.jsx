import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import AboutPage from './AboutPage';
import Navbar from './Navbar';
import Footer from './Footer';

vi.mock('./InstagramFeed', () => ({ default: () => null }));
vi.mock('./ThemeToggle', () => ({ default: () => null }));
vi.mock('../context/CartContext', () => ({ useCart: () => ({ itemCount: 0 }) }));

it.each(['/about'])('preserves the original content at %s with About metadata', async (path) => {
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <AboutPage />
      </MemoryRouter>
    </HelmetProvider>
  );
  expect(
    screen.getByRole('heading', { level: 1, name: 'About Sattari Music' })
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Founded by Mohammad Sattari' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Shop instruments & gear' })).toHaveAttribute(
    'href',
    '/shop'
  );
  expect(screen.getByRole('heading', { name: 'Find your next instrument' })).toBeInTheDocument();
  await waitFor(() =>
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://sattarimusic.com/about'
    )
  );
  expect(document.title).toBe('About Us | Woodland Hills Music Store | Sattari Music');
  // Structured data may arrive as several blocks, each an entity or a @graph.
  const entities = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(
    (node) => {
      const data = JSON.parse(node.textContent);
      return data['@graph'] || [data];
    }
  );
  expect(entities).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ '@type': 'AboutPage', url: 'https://sattarimusic.com/about' }),
    ])
  );
});

it('links to About in navigation and footer and closes the mobile menu after navigation', async () => {
  render(
    <MemoryRouter initialEntries={['/shop']}>
      <Navbar onCartClick={vi.fn()} />
      <Routes>
        <Route path="/shop" element={<p>Shop</p>} />
        <Route path="/about" element={<p>About page</p>} />
      </Routes>
      <Footer />
    </MemoryRouter>
  );
  const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }));
  expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
  expect(screen.getByRole('link', { name: 'About Sattari' })).toHaveAttribute('href', '/about');
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  fireEvent.click(nav.getByRole('link', { name: 'About' }));
  await waitFor(() => expect(screen.getByText('About page')).toBeInTheDocument());
  expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
});
