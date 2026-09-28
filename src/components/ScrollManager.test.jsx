import { useEffect, useState } from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ScrollManager from './ScrollManager';

let navigate;
let scrollTo;
let scrollIntoView;

function NavigateHandle() {
  navigate = useNavigate();
  return null;
}

// Renders its #section only after a moment, like a page whose code or data is
// still loading when the navigation commits.
function LatePage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 20);
    return () => clearTimeout(timer);
  }, []);
  return ready ? <section id="local-inquiry">Form</section> : <p>Loading</p>;
}

function renderRoutes(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ScrollManager />
      <NavigateHandle />
      <Routes>
        <Route path="/" element={<p>Home</p>} />
        <Route path="/shop" element={<p>Shop</p>} />
        <Route
          path="/about"
          element={
            <div>
              <p>About</p>
              <section id="team">Team</section>
            </div>
          }
        />
        <Route path="/services" element={<LatePage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  scrollTo = vi.fn();
  scrollIntoView = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete Element.prototype.scrollIntoView;
});

it('starts a newly opened page at the top, instantly', () => {
  renderRoutes();
  expect(scrollTo).not.toHaveBeenCalled();

  act(() => navigate('/shop'));

  expect(scrollTo).toHaveBeenCalledWith(0, 0);
  // The smooth scrolling set on <html> is suspended for the jump and restored.
  expect(document.documentElement.style.scrollBehavior).toBe('');
});

it('leaves Back and Forward to the browser’s own scroll restoration', () => {
  renderRoutes();
  act(() => navigate('/shop'));
  scrollTo.mockClear();

  act(() => navigate(-1));

  expect(scrollTo).not.toHaveBeenCalled();
  expect(scrollIntoView).not.toHaveBeenCalled();
});

it('scrolls to a #section once the new page has rendered it', async () => {
  renderRoutes();

  act(() => navigate('/services#local-inquiry'));
  expect(scrollIntoView).not.toHaveBeenCalled();

  await act(() => new Promise((resolve) => setTimeout(resolve, 60)));

  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('local-inquiry'));
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
  expect(scrollTo).not.toHaveBeenCalled();
});

it('glides to a section on the same page, unless reduced motion is preferred', () => {
  renderRoutes(['/about']);

  act(() => navigate('/about#team'));
  expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });

  window.matchMedia.mockImplementation((query) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  try {
    act(() => navigate('/about'));
    act(() => navigate('/about#team'));
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: 'start' });
  } finally {
    window.matchMedia.mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  }
});

it('finds a #section on first load when the page had to render it (no prerendered HTML)', async () => {
  renderRoutes(['/services#local-inquiry']);

  await act(() => new Promise((resolve) => setTimeout(resolve, 60)));

  expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('local-inquiry'));
  expect(scrollTo).not.toHaveBeenCalled();
});
