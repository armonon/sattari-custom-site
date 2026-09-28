import { renderToString } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';

const theme = vi.hoisted(() => ({ mode: 'night', ready: false, cyclePreference: () => {} }));
vi.mock('../context/ThemeContext', () => ({ useTheme: () => theme }));

afterEach(() => {
  theme.mode = 'night';
  theme.ready = false;
});

it('uses a label that fits every visitor until their theme is known, as the prerender does', () => {
  expect(renderToString(<ThemeToggle />)).toContain(
    'aria-label="Switch between day and night mode"'
  );
  render(<ThemeToggle />);
  expect(
    screen.getByRole('button', { name: 'Switch between day and night mode' })
  ).toBeInTheDocument();
});

it('names the other theme once the visitor’s is known', () => {
  theme.ready = true;
  theme.mode = 'day';
  render(<ThemeToggle />);
  expect(screen.getByRole('button', { name: 'Switch to night mode' })).toBeInTheDocument();
});
