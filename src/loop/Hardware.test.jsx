import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PracticeDeck } from './Hardware';
import { SONGS } from './catalog';

let play;
let pause;
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    Object.defineProperty(this, 'paused', { configurable: true, value: false });
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
    Object.defineProperty(this, 'paused', { configurable: true, value: true });
    this.dispatchEvent(new Event('pause'));
  });
});
afterEach(() => vi.restoreAllMocks());

it('waits for a gesture, changes speed, pauses, and stops at the end of the starter phrase', async () => {
  const page = render(<PracticeDeck lesson={SONGS[0]} onChoose={vi.fn()} />);
  const audio = page.container.querySelector('audio');
  expect(play).not.toHaveBeenCalled();
  expect(audio).toHaveAttribute('preload', 'none');
  fireEvent.change(screen.getByRole('slider'), { target: { value: '50' } });
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Hear starter phrase' }))
  );
  expect(audio.playbackRate).toBe(0.5);
  expect(screen.getByRole('button', { name: 'Pause starter phrase' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } });
  expect(audio.playbackRate).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Pause starter phrase' }));
  expect(audio.paused).toBe(true);
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Hear starter phrase' }))
  );
  audio.currentTime = SONGS[0].notes[7].end + 0.1;
  fireEvent.timeUpdate(audio);
  expect(audio.paused).toBe(true);
  expect(audio.currentTime).toBe(0);
  expect(screen.getByRole('button', { name: 'Hear starter phrase' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

it('shows a recoverable playback failure without claiming to play', async () => {
  play.mockRejectedValueOnce(new Error('Audio unavailable'));
  render(<PracticeDeck lesson={SONGS[0]} onChoose={vi.fn()} />);
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Hear starter phrase' }))
  );
  expect(screen.getByRole('alert')).toHaveTextContent('couldn’t play');
  expect(screen.getByRole('button', { name: 'Hear starter phrase' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Hear starter phrase' }))
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pause starter phrase' })).toBeInTheDocument();
});

it('stops playback when opening the lesson or leaving the library', async () => {
  const choose = vi.fn();
  const page = render(<PracticeDeck lesson={SONGS[0]} onChoose={choose} />);
  const audio = page.container.querySelector('audio');
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Hear starter phrase' }))
  );
  fireEvent.click(screen.getByRole('button', { name: 'Learn this song' }));
  expect(choose).toHaveBeenCalledWith(SONGS[0], null, null);
  expect(audio.paused).toBe(true);
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Hear starter phrase' }))
  );
  pause.mockClear();
  page.unmount();
  expect(pause).toHaveBeenCalledOnce();
  expect(audio.paused).toBe(true);
});

it('pauses when the document becomes hidden', async () => {
  const page = render(<PracticeDeck lesson={SONGS[0]} onChoose={vi.fn()} />);
  const audio = page.container.querySelector('audio');
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Hear starter phrase' }))
  );
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(audio.paused).toBe(true);
  expect(screen.getByRole('button', { name: 'Hear starter phrase' })).toBeInTheDocument();
});
