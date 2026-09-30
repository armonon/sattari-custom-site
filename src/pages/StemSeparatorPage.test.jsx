import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import StemSeparatorPage from './StemSeparatorPage';
import { separatorGuides } from '../data/stemSeparatorContent';

vi.mock('../utils/seo', () => ({ SEO: () => null, StructuredData: () => null }));
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const renderPage = () =>
  render(
    <MemoryRouter>
      <StemSeparatorPage />
    </MemoryRouter>
  );

it('offers four selected stems and disables separation until tracks exist', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: /Stem Separator/ })).toBeInTheDocument();
  expect(screen.getByLabelText('All stems')).toBeChecked();
  expect(screen.getByRole('button', { name: 'Separate tracks' })).toBeDisabled();
  expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  expect(screen.getByRole('button', { name: 'Separate demo' })).toBeEnabled();
  expect(screen.getByLabelText('Processing device')).toHaveValue('auto');
  fireEvent.change(screen.getByLabelText('Processing device'), { target: { value: 'cpu' } });
  expect(screen.getByLabelText('Processing device')).toHaveValue('cpu');
});

it('links to practical guides in new tabs without replacing the audio session', () => {
  renderPage();
  for (const guide of separatorGuides) {
    const link = screen.getByRole('link', { name: `${guide.linkLabel} (opens in a new tab)` });
    expect(link).toHaveAttribute('href', `/guides/${guide.slug}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  expect(
    screen.getByRole('link', { name: 'Stem Separator questions (opens in a new tab)' })
  ).toHaveAttribute('href', '/tools/stem-separator#questions');
  expect(screen.getByLabelText('Add audio tracks')).toBeInTheDocument();
});

it('queues multiple files and requires a nonempty selection', () => {
  renderPage();
  fireEvent.change(screen.getByLabelText('Add audio tracks'), {
    target: {
      files: [
        new File(['one'], 'first.wav', { type: 'audio/wav' }),
        new File(['two'], 'second.mp3', { type: 'audio/mp3' }),
      ],
    },
  });
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Separate 2 tracks' })).toBeEnabled();
  fireEvent.click(screen.getByLabelText('All stems'));
  expect(screen.getByRole('button', { name: 'Separate 2 tracks' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Bass'));
  expect(screen.getByRole('button', { name: 'Separate 2 tracks' })).toBeEnabled();
  expect(screen.getByLabelText('All stems').indeterminate).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove first.wav' }));
  expect(screen.getByRole('button', { name: 'Separate 1 track' })).toBeEnabled();
});

it('accepts a drop and reports an unsupported file without losing the audio', () => {
  renderPage();
  fireEvent.drop(
    screen.getByRole('heading', { name: 'Add your tracks' }).closest('.separator-drop'),
    {
      dataTransfer: {
        files: [
          new File(['one'], 'valid.wav', { type: 'audio/wav' }),
          new File(['text'], 'not-a-song.txt', { type: 'text/plain' }),
        ],
      },
    }
  );
  expect(screen.getByRole('article', { name: 'valid.wav' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('not-a-song.txt: Choose an audio file.');
});
