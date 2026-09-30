import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import LoopPracticePage from './LoopPracticePage';
import { readLibrary, saveSong } from '../loop/library';
import { DEMO } from '../loop/music';

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

vi.setConfig({ testTimeout: 120000 });

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
  fireEvent.click(screen.getByRole('button', { name: 'Learn Night shift' }));
  fireEvent.click(screen.getByRole('button', { name: 'Explore & edit the full practice sheet' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Tune your guitar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Chord library', exact: true }));
  fireEvent.change(screen.getByLabelText('Find a chord'), { target: { value: 'F#' } });
  fireEvent.click(screen.getByRole('button', { name: 'F#m', exact: true }));
  expect(screen.getByRole('img', { name: /F# minor. Frets/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hear F#m' })).toBeInTheDocument();
});

it('starts in the song library, filters classics, and takes a chosen song through review into focused practice', async () => {
  await renderPage();
  expect(screen.getByRole('heading', { name: /Your favorite song/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enable microphone' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Classics', exact: true }));
  expect(screen.queryByRole('button', { name: 'Learn Night shift' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Find a song'), { target: { value: 'Ode' } });
  expect(screen.queryByRole('button', { name: 'Learn Twinkle, Twinkle' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Learn Ode to Joy' }));
  expect(screen.getByRole('heading', { name: 'Ode to Joy' })).toBeInTheDocument();
  expect(document.querySelector('audio')).toHaveAttribute('src', '/audio/loop-ode-to-joy.wav');
  fireEvent.click(screen.getByRole('tab', { name: 'Chord charts' }));
  expect(screen.getByRole('img', { name: /C major. Frets/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Practice this song' }));
  expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeInTheDocument();
  expect(
    screen.queryByRole('navigation', { name: 'Sattari Learn navigation' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
  expect(screen.getByRole('button', { name: 'Hear this phrase' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Exit practice' }));
  expect(screen.getByRole('heading', { name: 'Ode to Joy' })).toBeInTheDocument();
});

it('reopens both recordings, switches playback, and retains prepared audio when editing', async () => {
  const file = new File(['original'], 'recording.wav', { type: 'audio/wav' });
  const practiceFile = new Blob(['instruments'], { type: 'audio/wav' });
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob) {
        return blob === practiceFile ? 'blob:prepared-test' : 'blob:original-test';
      }
      static revokeObjectURL = vi.fn();
    }
  );
  readLibrary.mockResolvedValueOnce([
    {
      id: 'prepared-test',
      file,
      practiceFile,
      lesson: {
        ...DEMO,
        id: 'prepared-test',
        source: 'estimate',
        title: 'Prepared recording',
        quality: { preparation: 'instruments', coverage: 0.8 },
      },
    },
  ]);
  try {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Learn Prepared recording' }));
    expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:prepared-test');
    fireEvent.click(screen.getByRole('button', { name: 'Original song' }));
    expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:original-test');
    fireEvent.click(screen.getByRole('button', { name: 'Rebuild from the original recording' }));
    expect(screen.getByRole('radio', { name: /Guitar on its own/ })).toBeChecked();
    expect(screen.getByRole('button', { name: /recording\.wav/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review & edit the guide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Instruments', exact: true }));
    expect(document.querySelector('audio')).toHaveAttribute('src', 'blob:prepared-test');
    fireEvent.click(screen.getByRole('button', { name: 'Edit lesson notes and chords' }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Selected note'), { target: { value: '65' } });
    });
    expect(saveSong).toHaveBeenLastCalledWith(
      expect.objectContaining({
        file,
        practiceFile,
        lesson: expect.objectContaining({ id: 'prepared-test' }),
      })
    );
  } finally {
    cleanup();
    vi.unstubAllGlobals();
  }
});
