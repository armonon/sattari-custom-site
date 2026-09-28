import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import LoopPracticePage from './LoopPracticePage';

vi.mock('../loop/library', () => ({
  readLibrary: vi.fn().mockResolvedValue([]),
  saveSong: vi.fn().mockResolvedValue(),
  removeSong: vi.fn().mockResolvedValue(),
}));

async function renderPage() {
  await act(async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <LoopPracticePage />
        </MemoryRouter>
      </HelmetProvider>
    );
  });
}

vi.setConfig({ testTimeout: 60000 });

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

it('switches guides, follows phrases, and edits notes without changing the recording', async () => {
  await renderPage();
  expect(screen.getByRole('heading', { name: 'Night shift' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Chord charts' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Em');
  expect(screen.getByRole('img', { name: /E minor. Frets/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next phrase' }));
  expect(screen.getByRole('tabpanel')).toHaveTextContent('Am');
  fireEvent.click(screen.getByRole('tab', { name: 'Tablature' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit lesson notes and chords' }));
  fireEvent.change(screen.getByLabelText('Selected note'), { target: { value: '71' } });
  expect(screen.getByLabelText('Selected note')).toHaveValue('71');
  expect(document.querySelector('audio')).toHaveAttribute('src', '/audio/loop-night-shift.wav');
});

it('rejects a non-audio import and allows returning to the demo', async () => {
  await renderPage();
  fireEvent.change(screen.getByLabelText('Choose an audio file'), {
    target: { files: [new File(['test'], 'notes.txt', { type: 'text/plain' })] },
  });
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose an audio file');
  fireEvent.click(within(dialog).getByRole('button', { name: /Try the original demo/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('opens the chord library and updates an accessible fingering diagram', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Chord library', exact: true }));
  fireEvent.change(screen.getByLabelText('Find a chord'), { target: { value: 'F#' } });
  fireEvent.click(screen.getByRole('button', { name: 'F#m', exact: true }));
  expect(screen.getByRole('img', { name: /F# minor. Frets/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hear F#m' })).toBeInTheDocument();
});
