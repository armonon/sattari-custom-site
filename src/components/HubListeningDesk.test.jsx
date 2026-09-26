import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HubListeningDesk from './HubListeningDesk';

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function () {
    Object.defineProperty(this, 'paused', { configurable: true, value: false });
    fireEvent.playing(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function () {
    Object.defineProperty(this, 'paused', { configurable: true, value: true });
    fireEvent.pause(this);
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(8);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  const result = render(
    <MemoryRouter>
      <HubListeningDesk />
    </MemoryRouter>
  );
  const audio = result.container.querySelector('audio');
  fireEvent.loadedMetadata(audio);
  return { ...result, audio };
}

it('does not autoplay and starts at a moderate volume with looping enabled', () => {
  const { audio } = setup();
  expect(audio.play).not.toHaveBeenCalled();
  expect(audio.volume).toBe(0.65);
  expect(audio.loop).toBe(true);
  expect(screen.getByRole('radio', { name: 'Full mix' })).toBeChecked();
  expect(screen.getByRole('link', { name: 'Download full mix WAV' })).toHaveAttribute('download');
});

it('plays, seeks, pauses, adjusts volume and toggles loop/mute', async () => {
  const { audio } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Play demo' }));
  await screen.findByRole('button', { name: 'Pause demo' });
  fireEvent.change(screen.getByRole('slider', { name: 'Demo playback position' }), {
    target: { value: '3.2' },
  });
  expect(audio.currentTime).toBe(3.2);
  fireEvent.click(screen.getByRole('button', { name: 'Pause demo' }));
  expect(audio.paused).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Loop demo' }));
  expect(audio.loop).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Mute demo' }));
  expect(audio.muted).toBe(true);
  fireEvent.change(screen.getByRole('slider', { name: 'Demo volume' }), {
    target: { value: '0.3' },
  });
  expect(audio.volume).toBe(0.3);
  expect(audio.muted).toBe(false);
});

it('keeps the playback position and resumes when switching an audible part', async () => {
  const { audio } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Play demo' }));
  audio.currentTime = 4.25;
  fireEvent.timeUpdate(audio);
  fireEvent.click(screen.getByRole('radio', { name: 'Bass', exact: true }));
  expect(audio).toHaveAttribute('src', '/audio/sattari-demo-bass.wav');
  expect(audio.paused).toBe(true);
  fireEvent.loadedMetadata(audio);
  expect(audio.currentTime).toBe(4.25);
  await screen.findByRole('button', { name: 'Pause demo' });
  expect(screen.getByRole('link', { name: 'Download bass WAV' })).toHaveAttribute(
    'href',
    '/audio/sattari-demo-bass.wav'
  );
});

it('does not start playback when switching a paused part', () => {
  const { audio } = setup();
  audio.currentTime = 2;
  fireEvent.click(screen.getByRole('radio', { name: 'Drums', exact: true }));
  fireEvent.loadedMetadata(audio);
  expect(audio.currentTime).toBe(2);
  expect(audio.play).not.toHaveBeenCalled();
});

it('preserves the pending position during rapid source changes', () => {
  const { audio } = setup();
  audio.currentTime = 5;
  fireEvent.click(screen.getByRole('radio', { name: 'Bass', exact: true }));
  audio.currentTime = 0;
  fireEvent.click(screen.getByRole('radio', { name: 'Drums', exact: true }));
  fireEvent.loadedMetadata(audio);
  expect(audio.currentTime).toBe(5);
});

it('exposes a retry and download fallback if a source cannot load', () => {
  const { audio } = setup();
  fireEvent.error(audio);
  expect(screen.getByRole('alert')).toHaveTextContent('could not load');
  fireEvent.click(screen.getByRole('button', { name: 'Retry demo audio' }));
  expect(audio.load).toHaveBeenCalledOnce();
  fireEvent.loadedMetadata(audio);
  expect(audio.play).toHaveBeenCalledOnce();
});

it('handles playback rejection without pretending the audio is playing', async () => {
  const { audio } = setup();
  audio.play.mockRejectedValueOnce(new Error('Playback blocked'));
  fireEvent.click(screen.getByRole('button', { name: 'Play demo' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not play'));
  expect(screen.getByRole('button', { name: 'Retry demo audio' })).toBeEnabled();
});

it('stops audio when leaving the Hub', () => {
  const { audio, unmount } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Play demo' }));
  unmount();
  expect(audio.pause).toHaveBeenCalled();
  expect(audio.paused).toBe(true);
});
