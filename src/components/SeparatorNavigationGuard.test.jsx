import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  createMemoryRouter,
  MemoryRouter,
  Route,
  RouterProvider,
  Routes,
  StaticRouter,
} from 'react-router-dom';
import SeparatorNavigationGuard from './SeparatorNavigationGuard';
import StemSeparatorPage from '../pages/StemSeparatorPage';
import { decodeTrack } from '../utils/stemSeparator';

const { separate, dispose } = vi.hoisted(() => ({ separate: vi.fn(), dispose: vi.fn() }));
vi.mock('../utils/stemSeparatorClient', () => ({
  StemSeparatorClient: class {
    separate(...args) {
      return separate(...args);
    }
    dispose() {
      dispose();
    }
  },
}));
vi.mock('../utils/stemSeparator', async () => ({
  ...(await vi.importActual('../utils/stemSeparator')),
  decodeTrack: vi.fn(),
}));
vi.mock('../utils/seo', () => ({ SEO: () => null, StructuredData: () => null }));

const routers = [];

function TestApp() {
  return (
    <Routes>
      <Route path="/stem-separator" element={<StemSeparatorPage />} />
      <Route path="/hub" element={<h1>Hub destination</h1>} />
      <Route path="/studio" element={<h1>Studio destination</h1>} />
      <Route path="/tools/stem-separator" element={<h1>Reference destination</h1>} />
    </Routes>
  );
}

function makeRouter(options = {}) {
  const router = createMemoryRouter([{ path: '*', element: <TestApp /> }], {
    initialEntries: ['/stem-separator'],
    ...options,
  });
  routers.push(router);
  return router;
}

function renderPage(options) {
  const router = makeRouter(options);
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
  return router;
}

function queueTrack() {
  fireEvent.change(screen.getByLabelText('Add audio tracks'), {
    target: { files: [new File(['audio'], 'song.wav', { type: 'audio/wav' })] },
  });
}

async function finishTrack() {
  queueTrack();
  fireEvent.click(screen.getByRole('button', { name: 'Separate 1 track' }));
  return screen.findByRole('link', { name: 'Download Bass WAV' });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => `blob:stem-${Math.random()}`);
      static revokeObjectURL = vi.fn();
    }
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(),
    fillRect: vi.fn(),
  });
  decodeTrack.mockResolvedValue({
    left: new Float32Array(4),
    right: new Float32Array(4),
    duration: 1,
    peaks: [0.5],
  });
  separate.mockImplementation(async (_audio, stems) =>
    stems.map((id) => ({ id, blob: new Blob(['wav']), peaks: [0.5] }))
  );
});

afterEach(() => {
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ['Sattari Hub', '/hub', 'Hub destination'],
  ['Open Studio', '/studio', 'Studio destination'],
  ['Formats, privacy & limits', '/tools/stem-separator', 'Reference destination'],
])(
  'preserves results on Cancel and leaves once on confirmation via %s',
  async (name, path, title) => {
    const router = renderPage();
    const output = await finishTrack();
    const url = output.getAttribute('href');
    const location = router.state.location;

    fireEvent.click(screen.getByRole('link', { name, exact: true }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(router.state.location).toEqual(location);
    expect(screen.getByRole('link', { name: 'Download Bass WAV' })).toBe(output);
    expect(output).toHaveAttribute('href', url);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name, exact: true }));
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4);
  }
);

it.each([
  ['Back', ['/hub', '/stem-separator'], 1, -1],
  ['Forward', ['/stem-separator', '/hub'], 0, 1],
])(
  'cancels and replays browser %s through the router without losing results',
  async (_name, initialEntries, initialIndex, delta) => {
    const router = renderPage({ initialEntries, initialIndex });
    const output = await finishTrack();
    const url = output.getAttribute('href');
    const location = router.state.location;

    await act(async () => router.navigate(delta));
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(router.state.location).toEqual(location);
    expect(screen.getByRole('link', { name: 'Download Bass WAV' })).toBe(output);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.mocked(window.confirm).mockReturnValue(true);
    await act(async () => router.navigate(delta));
    expect(await screen.findByRole('heading', { name: 'Hub destination' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/hub');
    expect(router.state.historyAction).toBe('POP');
    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
  }
);

it('does not stop active processing when navigation is cancelled', async () => {
  let signal;
  separate.mockImplementationOnce(
    (_audio, _stems, activeSignal) =>
      new Promise((_resolve, reject) => {
        signal = activeSignal;
        signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')));
      })
  );
  const router = renderPage();
  queueTrack();
  fireEvent.click(screen.getByRole('button', { name: 'Separate 1 track' }));
  await waitFor(() => expect(separate).toHaveBeenCalledTimes(1));
  const disposals = dispose.mock.calls.length;

  fireEvent.click(screen.getByRole('link', { name: 'Open Studio' }));
  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe('/stem-separator');
  expect(signal.aborted).toBe(false);
  expect(dispose).toHaveBeenCalledTimes(disposals);

  vi.mocked(window.confirm).mockReturnValue(true);
  fireEvent.click(screen.getByRole('link', { name: 'Open Studio' }));
  expect(await screen.findByRole('heading', { name: 'Studio destination' })).toBeInTheDocument();
  expect(signal.aborted).toBe(true);
});

it('allows same-page query, hash, case and trailing-slash navigation without discarding results', async () => {
  const router = renderPage();
  const output = await finishTrack();
  for (const path of [
    '/stem-separator?view=results',
    '/stem-separator#results',
    '/STEM-SEPARATOR/',
  ]) {
    await act(async () => router.navigate(path));
    expect(screen.getByRole('link', { name: 'Download Bass WAV' })).toBe(output);
  }
  expect(window.confirm).not.toHaveBeenCalled();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});

it('allows leaving a queued-only session without a warning', async () => {
  renderPage();
  queueTrack();
  fireEvent.click(screen.getByRole('link', { name: 'Sattari Hub', exact: true }));
  expect(await screen.findByRole('heading', { name: 'Hub destination' })).toBeInTheDocument();
  expect(window.confirm).not.toHaveBeenCalled();
});

it('stops blocking after the finished results are cleared', async () => {
  renderPage();
  await finishTrack();
  fireEvent.click(screen.getByRole('button', { name: 'Clear finished' }));
  fireEvent.click(screen.getByRole('link', { name: 'Sattari Hub', exact: true }));
  expect(await screen.findByRole('heading', { name: 'Hub destination' })).toBeInTheDocument();
  expect(window.confirm).not.toHaveBeenCalled();
});

it('does not require a data router under MemoryRouter or StaticRouter', () => {
  const { unmount } = render(
    <MemoryRouter>
      <SeparatorNavigationGuard when />
    </MemoryRouter>
  );
  unmount();
  expect(
    renderToString(
      <StaticRouter location="/stem-separator">
        <SeparatorNavigationGuard when />
      </StaticRouter>
    )
  ).toBe('');
  expect(window.confirm).not.toHaveBeenCalled();
});

it('hydrates the existing StaticRouter page through a wildcard data router without replacing it', async () => {
  // React's server renderer warns about layout effects in jsdom, unlike the
  // production Node prerender. Hydration warnings remain unsuppressed below.
  const serverWarnings = vi.spyOn(console, 'error').mockImplementation(() => {});
  let html;
  try {
    html = renderToString(
      <StaticRouter location="/stem-separator">
        <TestApp />
      </StaticRouter>
    );
  } finally {
    serverWarnings.mockRestore();
  }
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const heading = container.querySelector('h1');
  const onRecoverableError = vi.fn();
  const router = makeRouter();
  let root;
  try {
    await act(async () => {
      root = hydrateRoot(
        container,
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>,
        { onRecoverableError }
      );
    });
    expect(container.querySelector('h1')).toBe(heading);
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Separate tracks' })).toBeDisabled();
  } finally {
    act(() => root?.unmount());
    container.remove();
  }
});
