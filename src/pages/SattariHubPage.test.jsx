import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import SattariHubPage from './SattariHubPage';

vi.mock('../utils/seo', () => ({ SEO: () => null }));

it('launches all four real workspaces and their reference pages', () => {
  render(
    <MemoryRouter>
      <SattariHubPage />
    </MemoryRouter>
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sattari Hub');
  for (const [name, route, reference = `/tools${route}`] of [
    ['Sattari Studio', '/studio'],
    ['Sattari Learn', '/learn'],
    ['Stem Separator', '/stem-separator'],
    ['Key & BPM', '/studio/keybpm', '/tools/key-bpm'],
  ]) {
    expect(screen.getByRole('link', { name: `Open ${name}` })).toHaveAttribute('href', route);
    expect(
      screen.getByRole('link', { name: `${name} formats, privacy and limits` })
    ).toHaveAttribute('href', reference);
  }
  expect(screen.getAllByRole('img')).toHaveLength(4);
  expect(screen.queryByRole('link', { name: 'Music software for Mac' })).not.toBeInTheDocument();
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

it('omits the listening desk, demo player and header shortcut', () => {
  const { container } = render(
    <MemoryRouter>
      <SattariHubPage />
    </MemoryRouter>
  );
  expect(screen.queryByText(/Listening (desk|deck)/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Play demo/i })).not.toBeInTheDocument();
  expect(
    container.querySelector('audio, #hub-listening-desk, a[href="#hub-listening-desk"]')
  ).toBeNull();
  expect(container.querySelector('.hub-workspaces').nextElementSibling).toHaveClass('hub-reading');
});

it('lists the Studio alpha labs', () => {
  render(
    <MemoryRouter>
      <SattariHubPage />
    </MemoryRouter>
  );
  for (const [name, route, stage] of [
    ['Split', '/studio/split', 'Alpha'],
    ['Key & BPM', '/studio/keybpm', 'Beta'],
    ['Vox', '/studio/vox', 'Alpha'],
  ]) {
    expect(screen.getByRole('link', { name: new RegExp(`^${stage}\\s*${name}`) })).toHaveAttribute(
      'href',
      route
    );
  }
});
