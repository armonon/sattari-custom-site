import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LibraryPreview from './LibraryPreview';

let devices;
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  devices = new EventTarget();
  devices.selectAudioOutput = vi.fn(async () => ({ deviceId: 'headphones', label: 'Headphones' }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: devices });
  Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', {
    configurable: true,
    value: vi.fn(async () => {}),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  delete navigator.mediaDevices;
  delete HTMLMediaElement.prototype.setSinkId;
});
it('requires explicit routing and never autoplays a selected song', async () => {
  const { rerender } = render(<LibraryPreview preview={{ title: 'Song', url: 'blob:first' }} />);
  const audio = screen.getByLabelText('Preview Song');
  expect(audio.autoplay).toBe(false);
  expect(audio.controls).toBe(false);
  expect(audio.muted).toBe(true);
  expect(audio.volume).toBe(0.25);
  expect(screen.getByRole('button', { name: 'Play preview' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Preview output and options'));
  fireEvent.click(screen.getByRole('button', { name: 'Choose cue output' }));
  await screen.findByText(/Output: Headphones/);
  expect(audio.setSinkId).toHaveBeenCalledWith('headphones');
  expect(audio.controls).toBe(false);
  expect(screen.getByRole('button', { name: 'Play preview' })).toBeEnabled();
  rerender(<LibraryPreview preview={{ title: 'Next', url: 'blob:next' }} />);
  expect(screen.getByLabelText('Preview Next').autoplay).toBe(false);
});
it('closes output options without pausing audio, replacing its element or resetting its route', async () => {
  render(<LibraryPreview preview={{ title: 'Song', url: 'blob:first' }} />);
  fireEvent.click(screen.getByLabelText('Preview output and options'));
  fireEvent.click(screen.getByRole('button', { name: 'Choose cue output' }));
  await screen.findByText(/Output: Headphones/);
  const audio = screen.getByLabelText('Preview Song');
  audio.currentTime = 24;
  audio.pause.mockClear();
  audio.setSinkId.mockClear();
  fireEvent.click(screen.getByLabelText('Preview output and options'));
  expect(
    screen.getByLabelText('Preview output and options').closest('details')
  ).not.toHaveAttribute('open');
  expect(screen.queryByRole('button', { name: 'Collapse Preview player' })).not.toBeInTheDocument();
  expect(audio.pause).not.toHaveBeenCalled();
  expect(audio.setSinkId).not.toHaveBeenCalled();
  expect(audio.muted).toBe(false);
  fireEvent.click(screen.getByLabelText('Preview output and options'));
  expect(screen.getByLabelText('Preview Song')).toBe(audio);
  expect(audio.currentTime).toBe(24);
});
it('only continues playback after explicit routing and keeps next/repeat controls separate from decks', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const next = vi.fn(),
    ended = vi.fn(),
    repeat = vi.fn();
  const { rerender } = render(
    <LibraryPreview
      preview={{ title: 'Song', url: 'blob:first', autoplay: true }}
      onNext={next}
      onEnded={ended}
      canNext
      onRepeat={repeat}
    />
  );
  const audio = screen.getByLabelText('Preview Song');
  fireEvent.loadedMetadata(audio);
  expect(play).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('Preview output and options'));
  fireEvent.click(screen.getByRole('button', { name: 'Use system speakers' }));
  await screen.findByText(/Output: System speakers/);
  fireEvent.loadedMetadata(audio);
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Next preview song' }));
  expect(next).toHaveBeenCalledWith(false);
  fireEvent.click(screen.getByRole('button', { name: 'Preview repeat: off' }));
  expect(repeat).toHaveBeenCalledTimes(1);
  fireEvent.ended(audio);
  expect(ended).toHaveBeenCalledTimes(1);
  rerender(<LibraryPreview preview={{ title: 'Second', url: 'blob:second' }} onNext={next} />);
  fireEvent.loadedMetadata(screen.getByLabelText('Preview Second'));
  expect(play).toHaveBeenCalledTimes(1);
});
it('fails muted rather than falling back to speakers, and invalidates unplugged routes', async () => {
  render(<LibraryPreview preview={{ title: 'Song', url: 'blob:first' }} />);
  const audio = screen.getByLabelText('Preview Song');
  audio.setSinkId.mockRejectedValueOnce(new Error('Unavailable'));
  fireEvent.click(screen.getByLabelText('Preview output and options'));
  fireEvent.click(screen.getByRole('button', { name: 'Choose cue output' }));
  await screen.findByRole('alert');
  expect(audio.muted).toBe(true);
  expect(audio.controls).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Use system speakers' }));
  await waitFor(() => expect(audio.muted).toBe(false));
  act(() => devices.dispatchEvent(new Event('devicechange')));
  expect(audio.muted).toBe(true);
  expect(audio.controls).toBe(false);
  expect(screen.getByRole('alert')).toHaveTextContent('devices changed');
  expect(screen.getByRole('button', { name: 'Play preview' })).toBeDisabled();
});

it('wires the compact play, pause, seek and volume controls to the same audio element', async () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  render(<LibraryPreview preview={{ title: 'Song', url: 'blob:first' }} />);
  const audio = screen.getByLabelText('Preview Song');
  Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
  fireEvent.loadedMetadata(audio);
  fireEvent.change(screen.getByRole('slider', { name: 'Preview position' }), {
    target: { value: '42.5' },
  });
  expect(audio.currentTime).toBe(42.5);
  fireEvent.change(screen.getByRole('slider', { name: 'Preview volume' }), {
    target: { value: '0.4' },
  });
  expect(audio.volume).toBe(0.4);
  fireEvent.click(screen.getByLabelText('Preview output and options'));
  fireEvent.click(screen.getByRole('button', { name: 'Use system speakers' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play preview' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Play preview' }));
  expect(play).toHaveBeenCalledTimes(1);
  fireEvent.play(audio);
  audio.pause.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Pause preview' }));
  expect(audio.pause).toHaveBeenCalledTimes(1);
});
