import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

it('starts with a clear goal, all four parts and separation disabled until songs exist', async () => {
  await act(async () => {
    renderPage();
  });
  expect(screen.getByRole('heading', { name: /Stem Separator/ })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: /Separate all parts/ })).toBeChecked();
  for (const goal of [
    /Vocal backing track/,
    /Drum practice/,
    /Bass practice/,
    /Solo a part/,
    /Custom/,
  ])
    expect(screen.getByRole('radio', { name: goal })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Separate' })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Try the 8-second example/ })).toBeEnabled();
  expect(screen.getByText(/All four parts/)).toBeInTheDocument();
  expect(screen.getByLabelText('Processing device')).toHaveValue('auto');
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Processing device'), { target: { value: 'cpu' } });
  });
  expect(screen.getByLabelText('Processing device')).toHaveValue('cpu');
  // Truthful storage copy: saved in this browser, not "session only".
  expect(screen.getByRole('heading', { name: /Saved in this browser/ })).toBeInTheDocument();
  expect(screen.queryByText(/Results last for this page session/)).not.toBeInTheDocument();
});

it('links to practical guides in new tabs without replacing the audio session', async () => {
  await act(async () => {
    renderPage();
  });
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

it('queues multiple files and requires a nonempty custom selection', async () => {
  await act(async () => {
    renderPage();
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Add audio tracks'), {
      target: {
        files: [
          new File(['one'], 'first.wav', { type: 'audio/wav' }),
          new File(['two'], 'second.mp3', { type: 'audio/mp3' }),
        ],
      },
    });
  });
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Separate 2 songs' })).toBeEnabled();
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
  });
  for (const name of ['Vocals', 'Drums', 'Bass', 'Other instruments'])
    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(`^${name}`) }));
    });
  expect(screen.getByRole('button', { name: 'Separate 2 songs' })).toBeDisabled();
  await act(async () => {
    fireEvent.click(screen.getByRole('checkbox', { name: /^Bass/ }));
  });
  expect(screen.getByRole('button', { name: 'Separate 2 songs' })).toBeEnabled();
  expect(screen.getByText('1 of 4 parts')).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getByRole('radio', { name: /Drum practice/ }));
  });
  expect(screen.getByText('All four parts')).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Remove first.wav' }));
  });
  expect(screen.getByRole('button', { name: 'Separate 1 song' })).toBeEnabled();
});

it('accepts a drop and reports an unsupported file without losing the audio', async () => {
  await act(async () => {
    renderPage();
  });
  await act(async () => {
    fireEvent.drop(screen.getByRole('heading', { name: 'Add a song' }).closest('.separator-drop'), {
      dataTransfer: {
        files: [
          new File(['one'], 'valid.wav', { type: 'audio/wav' }),
          new File(['text'], 'not-a-song.txt', { type: 'text/plain' }),
        ],
      },
    });
  });
  expect(screen.getByRole('article', { name: 'valid.wav' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('not-a-song.txt: Choose an audio file.');
});
