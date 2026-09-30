import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Navbar from './Navbar';

vi.mock('./ThemeToggle', () => ({ default: () => null }));
vi.mock('../context/CartContext', () => ({ useCart: () => ({ itemCount: 0 }) }));

it('preserves the logo artwork dimensions and links the brand to Home', () => {
  render(
    <MemoryRouter>
      <Navbar onCartClick={vi.fn()} />
    </MemoryRouter>
  );
  const logo = screen.getByRole('img', { name: 'Sattari Music Logo' });
  expect(logo).toHaveAttribute('width', '529');
  expect(logo).toHaveAttribute('height', '143');
  expect(logo).toHaveAttribute('src', '/sattari site/sattari logo.png');
  expect(logo.closest('a')).toHaveAttribute('href', '/');
  expect(logo.closest('picture').querySelector('source')).toHaveAttribute('type', 'image/avif');
});

it.each([
  ['a different page', 'About', 'About page'],
  ['the page already open', 'Shop', 'Shop page'],
])('closes the mobile menu after tapping a link to %s', async (_label, link, pageText) => {
  render(
    <MemoryRouter initialEntries={['/shop']}>
      <Navbar onCartClick={vi.fn()} />
      <Routes>
        <Route path="/shop" element={<p>Shop page</p>} />
        <Route path="/about" element={<p>About page</p>} />
      </Routes>
    </MemoryRouter>
  );
  const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }));

  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  fireEvent.click(nav.getByRole('link', { name: link }));

  expect(await screen.findByText(pageText)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
    'aria-expanded',
    'false'
  );
});

it('takes the collapsed phone menu out of the tab order and away from screen readers', () => {
  window.matchMedia.mockImplementation((query) => ({
    matches: query === '(max-width: 760px)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  try {
    render(
      <MemoryRouter>
        <Navbar onCartClick={vi.fn()} />
      </MemoryRouter>
    );
    const nav = screen.getByRole('navigation', { name: 'Primary navigation', hidden: true });
    expect(nav).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(nav).not.toHaveAttribute('inert');
  } finally {
    window.matchMedia.mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  }
});

it('dismisses the menu with Escape and restores focus to its toggle', () => {
  render(
    <MemoryRouter>
      <Navbar onCartClick={vi.fn()} />
    </MemoryRouter>
  );
  const toggle = screen.getByRole('button', { name: 'Open menu' });
  fireEvent.click(toggle);
  screen.getByRole('link', { name: 'About', exact: true }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveFocus();
});

it('dismisses the menu when a pointer lands outside the header', () => {
  render(
    <MemoryRouter>
      <Navbar onCartClick={vi.fn()} />
    </MemoryRouter>
  );
  const toggle = screen.getByRole('button', { name: 'Open menu' });
  fireEvent.click(toggle);
  fireEvent.pointerDown(document.body);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

it.each([
  ['/product/cymbal-felts', 'Shop'],
  ['/SHOP/VIOLINS/', 'Shop'],
  ['/stem-separator/', 'Sattari Hub'],
  ['/services/instrument-repair-los-angeles', 'Local Services'],
])('marks the parent navigation active on %s', (path, label) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Navbar onCartClick={vi.fn()} />
    </MemoryRouter>
  );
  const nav = within(screen.getByRole('navigation', { name: 'Primary navigation' }));
  expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  expect(nav.getByRole('link', { name: 'Home', exact: true })).not.toHaveAttribute('aria-current');
});
