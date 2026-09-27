import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeHeroBackground from './HomeHeroBackground';

const theme = vi.hoisted(() => ({ mode: 'day' }));
vi.mock('../context/ThemeContext', () => ({ useTheme: () => theme }));

let media;
let play;
let pause;
let connection;
let onIntersection;

beforeEach(() => {
  theme.mode = 'day';
  media = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  connection = Object.assign(new EventTarget(), { saveData: false, effectiveType: '4g' });
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection });
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: 500 });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        onIntersection = callback;
      }
      observe() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete navigator.connection;
});

it('uses the existing muted day/night loops with matching still posters', async () => {
  const { container, rerender } = render(<HomeHeroBackground />);
  const video = container.querySelector('video');
  expect(video.muted).toBe(true);
  expect(video.loop).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(video.querySelector('source')).toHaveAttribute('src', '/sattari site/bg.mp4');
  await waitFor(() => expect(play).toHaveBeenCalled());
  theme.mode = 'night';
  rerender(<HomeHeroBackground />);
  expect(container.querySelector('video source')).toHaveAttribute(
    'src',
    '/sattari site/INSTRA PATTERN.mp4'
  );
  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    '/images/home/video-night-poster.jpg'
  );
});

it('pauses and resumes from the accessible motion control', async () => {
  render(<HomeHeroBackground />);
  fireEvent.click(screen.getByRole('button', { name: 'Pause background video' }));
  expect(pause).toHaveBeenCalled();
  play.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Play background video' }));
  await waitFor(() => expect(play).toHaveBeenCalled());
});

it('keeps a still background and no motion controls for reduced motion', () => {
  media.matches = true;
  const { container } = render(<HomeHeroBackground />);
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('img')).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
  act(() => {
    media.matches = false;
    media.dispatchEvent(new Event('change'));
  });
  expect(container.querySelector('video')).toBeInTheDocument();
  act(() => {
    media.matches = true;
    media.dispatchEvent(new Event('change'));
  });
  expect(container.querySelector('video')).toBeNull();
});

it.each([{ saveData: true }, { effectiveType: '2g' }, { effectiveType: 'slow-2g' }])(
  'does not load video when the connection requests conservation: %j',
  (preference) => {
    Object.assign(connection, preference);
    const { container } = render(<HomeHeroBackground />);
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')).toBeInTheDocument();
  }
);

it('enables video on a mobile viewport when motion and data preferences allow it', () => {
  vi.stubGlobal('innerWidth', 390);
  const { container } = render(<HomeHeroBackground />);
  expect(container.querySelector('video')).toBeInTheDocument();
});

it('stops offscreen playback without losing the user pause choice', async () => {
  render(<HomeHeroBackground />);
  act(() => onIntersection([{ isIntersecting: false }]));
  expect(pause).toHaveBeenCalled();
  play.mockClear();
  act(() => onIntersection([{ isIntersecting: true }]));
  await waitFor(() => expect(play).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Pause background video' }));
  play.mockClear();
  act(() => onIntersection([{ isIntersecting: false }]));
  act(() => onIntersection([{ isIntersecting: true }]));
  expect(play).not.toHaveBeenCalled();
});

it('offers a manual play control when autoplay is blocked', async () => {
  play.mockRejectedValue(new Error('Autoplay blocked'));
  render(<HomeHeroBackground />);
  expect(await screen.findByRole('button', { name: 'Play background video' })).toBeInTheDocument();
});

it('falls back to the still image if the video fails', () => {
  const { container } = render(<HomeHeroBackground />);
  fireEvent.error(container.querySelector('video source'));
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('img')).toBeInTheDocument();
  expect(screen.queryByRole('button')).toBeNull();
});
