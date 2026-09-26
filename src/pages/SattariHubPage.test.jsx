import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import SattariHubPage from './SattariHubPage';

vi.mock('../utils/seo', () => ({ SEO: () => null }));
vi.mock('../components/HubListeningDesk', () => ({
  default: () => <section aria-label="Listening desk" />,
}));

it('launches all three real workspaces and their reference pages', () => {
  render(
    <MemoryRouter>
      <SattariHubPage />
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sattari Hub');
  for (const [name, route] of [
    ['Sattari Studio', '/studio'],
    ['Sattari Learn', '/learn'],
    ['Stem Separator', '/stem-separator'],
  ]) {
    expect(screen.getByRole('link', { name: `Open ${name}` })).toHaveAttribute('href', route);
    expect(
      screen.getByRole('link', { name: `${name} formats, privacy and limits` })
    ).toHaveAttribute('href', `/tools${route}`);
  }
  expect(screen.getAllByRole('img')).toHaveLength(3);
});

it('links to published guides and keeps future projects out of the live tool list', () => {
  render(
    <MemoryRouter>
      <SattariHubPage />
    </MemoryRouter>
  );
  expect(screen.getByRole('link', { name: 'All guides' })).toHaveAttribute('href', '/guides');
  expect(screen.getByRole('link', { name: /A song, taken apart/ })).toHaveAttribute(
    'href',
    '/guides/how-to-separate-vocals-drums-bass'
  );
  expect(screen.getByText('Planned projects')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Radio' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Market' })).not.toBeInTheDocument();
});
