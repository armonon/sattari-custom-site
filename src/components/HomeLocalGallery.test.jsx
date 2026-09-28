import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HomeLocalGallery from './HomeLocalGallery';
import media from '../data/localGalleryMedia.json';

let motion;
let onIntersection;
let play;
let pause;

beforeEach(() => {
  vi.useFakeTimers();
  motion = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(window, 'matchMedia').mockReturnValue(motion);
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
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
  vi.useRealTimers();
});

function renderGallery() {
  return render(
    <MemoryRouter>
      <HomeLocalGallery />
    </MemoryRouter>
  );
}

it('loads only the initial photo, then advances photos and muted clips while visible', () => {
  const { container } = renderGallery();
  expect(container.querySelector('video')).toBeNull();
  act(() => vi.advanceTimersByTime(7000));
  expect(screen.getByText('Inside Sattari')).toBeInTheDocument();
  act(() => onIntersection([{ isIntersecting: true }]));
  act(() => vi.advanceTimersByTime(6500));
  const video = container.querySelector('video');
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  expect(video).toHaveAttribute('poster', '/images/local-gallery/owner-02-poster.jpg');
  expect(play).toHaveBeenCalled();
  fireEvent.ended(video);
  expect(screen.getByText('Care for every instrument')).toBeInTheDocument();
});

it('wraps navigation, supports arrows, and pauses while browsing', () => {
  renderGallery();
  act(() => onIntersection([{ isIntersecting: true }]));
  fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
  expect(screen.getByText('Sattari, through the years')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Next slide' }), { key: 'ArrowRight' });
  act(() => vi.advanceTimersByTime(15000));
  expect(screen.getByText('Inside Sattari')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Meet Mohammad/ })).toHaveAttribute('href', '/about');
});

it('keeps reduced-motion visitors on a still until they choose to play', () => {
  motion.matches = true;
  renderGallery();
  act(() => onIntersection([{ isIntersecting: true }]));
  act(() => vi.advanceTimersByTime(15000));
  expect(screen.getByText('Inside Sattari')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
  act(() => vi.advanceTimersByTime(6500));
  expect(screen.getByText('The Sattari collection')).toBeInTheDocument();
});

it('suspends offscreen video and does not override a manual pause', () => {
  renderGallery();
  act(() => onIntersection([{ isIntersecting: true }]));
  act(() => vi.advanceTimersByTime(6500));
  act(() => onIntersection([{ isIntersecting: false }]));
  expect(pause).toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(40000));
  expect(screen.getByText('The Sattari collection')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }));
  play.mockClear();
  act(() => onIntersection([{ isIntersecting: true }]));
  expect(play).not.toHaveBeenCalled();
});

it('pauses on keyboard focus and handles pointer pause without focus restarting it', () => {
  renderGallery();
  act(() => onIntersection([{ isIntersecting: true }]));
  const rotation = screen.getByRole('button', { name: 'Pause slideshow' });
  fireEvent.pointerDown(rotation);
  fireEvent.focus(rotation);
  fireEvent.click(rotation);
  expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
  fireEvent.click(rotation);
  fireEvent.focus(screen.getByRole('button', { name: 'Next slide' }));
  expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
});

it('falls back to a poster on video failure and leaves navigation usable', () => {
  const { container } = renderGallery();
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
  fireEvent.error(container.querySelector('video'));
  expect(container.querySelector('video')).toBeNull();
  expect(container.querySelector('.is-current img')).toHaveAttribute(
    'src',
    '/images/local-gallery/owner-02-poster.jpg'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
  expect(screen.getByText('Care for every instrument')).toBeInTheDocument();
});

it('offers manual playback when the browser blocks autoplay', async () => {
  play.mockRejectedValue(new Error('Autoplay blocked'));
  renderGallery();
  act(() => onIntersection([{ isIntersecting: true }]));
  await act(async () => vi.advanceTimersByTime(6500));
  expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
});

it('offers every usable owner upload without loading every full-size file', () => {
  const { container } = renderGallery();
  expect(media).toHaveLength(59);
  expect(media.filter((item) => item.video)).toHaveLength(13);
  expect(screen.getAllByRole('button', { name: /^Show / })).toHaveLength(58);
  expect(container.querySelectorAll('.home-local-gallery-stage img')).toHaveLength(1);
  expect(container.querySelectorAll('video')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Show 1: Inside Sattari' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.queryByRole('button', { name: /Unavailable archive image/ })).toBeNull();
});

it('crossfades only after the incoming image loads, then releases the outgoing media', () => {
  const { container } = renderGallery();
  fireEvent.load(container.querySelector('.is-current img'));
  fireEvent.click(screen.getByRole('button', { name: 'Show 3: Care for every instrument' }));
  expect(container.querySelectorAll('.home-local-gallery-slide')).toHaveLength(2);
  expect(container.querySelector('.is-previous')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelector('.is-current')).not.toHaveClass('is-ready');
  act(() => vi.advanceTimersByTime(1000));
  expect(container.querySelector('.is-previous')).toBeInTheDocument();
  fireEvent.load(container.querySelector('.is-current img'));
  expect(container.querySelector('.is-current')).toHaveClass('is-ready');
  act(() => vi.advanceTimersByTime(700));
  expect(container.querySelectorAll('.home-local-gallery-slide')).toHaveLength(1);
});

it('supports thumbnail keyboard navigation with one tab stop and wrapped selection', () => {
  renderGallery();
  const first = screen.getByRole('button', { name: 'Show 1: Inside Sattari' });
  fireEvent.keyDown(first, { key: 'End' });
  const last = screen.getByRole('button', { name: 'Show 58: Sattari, through the years' });
  expect(last).toHaveFocus();
  expect(last).toHaveAttribute('aria-pressed', 'true');
  expect(first).toHaveAttribute('tabindex', '-1');
  fireEvent.keyDown(last, { key: 'ArrowRight' });
  expect(first).toHaveFocus();
  expect(first).toHaveAttribute('aria-pressed', 'true');
});

it('does not cut a long clip short and mutes a departing video', () => {
  const { container } = renderGallery();
  act(() => onIntersection([{ isIntersecting: true }]));
  fireEvent.click(screen.getByRole('button', { name: 'Show 2: The Sattari collection' }));
  fireEvent.click(screen.getByRole('button', { name: 'Play slideshow' }));
  act(() => vi.advanceTimersByTime(40000));
  expect(screen.getByText('The Sattari collection')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unmute video' }));
  const video = container.querySelector('video');
  expect(video.muted).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
  expect(video.muted).toBe(true);
  expect(pause).toHaveBeenCalled();
  expect(screen.getByText('Care for every instrument')).toBeInTheDocument();
});

it('keeps rapid navigation bounded to two media layers and falls back on photo errors', () => {
  const { container } = renderGallery();
  for (let i = 0; i < 12; i += 1)
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
  expect(container.querySelectorAll('.home-local-gallery-slide')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Show 3: Care for every instrument' }));
  fireEvent.error(container.querySelector('.is-current img'));
  expect(container.querySelector('.is-current img')).toHaveAttribute(
    'src',
    '/sattari site/MO.avif'
  );
  expect(screen.getByText('Photo unavailable.')).toBeInTheDocument();
});
