import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, StaticRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { preloadRoute } from './App';
import { CartProvider } from './context/CartContext';
import { InventoryProvider } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';

vi.mock('tone', () => ({}));
// A page that fails to render, for the error boundary test.
vi.mock('@pages/StudioBookingStatus', () => ({
  default: () => {
    throw new Error('Page bug');
  },
}));

const SNAPSHOT = { stock: {}, catalog: { overrides: {}, added: [], hidden: [] } };

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

let navigate: ReturnType<typeof useNavigate>;
let currentPath = '';
function NavigateHandle() {
  navigate = useNavigate();
  currentPath = useLocation().pathname;
  return null;
}

function Providers({ children, inventory }: { children: ReactNode; inventory?: typeof SNAPSHOT }) {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <InventoryProvider initialInventory={inventory}>
          <CartProvider>{children}</CartProvider>
        </InventoryProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

function renderApp(path: string) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <NavigateHandle />
        <App />
      </MemoryRouter>
    </Providers>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(SNAPSHOT))
  );
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  // These tests read React's warnings themselves (see HYDRATION_WARNING).
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

it('opens the guided shop assistant from the new homepage', async () => {
  await preloadRoute('/');
  renderApp('/');

  const launcher = screen.getByRole('button', {
    name: 'Open shop assistant: find a product or service',
  });
  expect(launcher).toHaveTextContent('Help me find something');
  fireEvent.click(launcher);
  const dialog = screen.getByRole('dialog', { name: 'What brings you here today?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Shop instruments & gear' }));
  expect(screen.getByRole('dialog', { name: 'What are you shopping for?' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cymbals' })).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'What are you shopping for?' })).toBeNull();
  expect(launcher).toHaveAttribute('aria-expanded', 'false');
}, 30000);

describe('cart drawer', () => {
  it('is a modal dialog: focus moves in, the page is inert, Escape closes and focus returns', async () => {
    renderApp('/page-that-does-not-exist');
    const openButton = screen.getByRole('button', { name: /Open cart/ });
    // Closed, the drawer is aria-hidden, which also empties its accessible name.
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
    const header = document.querySelector('.nav-wrap') as HTMLElement;
    const main = document.querySelector('main') as HTMLElement;

    expect(dialog).toHaveAttribute('inert');

    openButton.focus();
    fireEvent.click(openButton);

    expect(dialog).not.toHaveAttribute('inert');
    expect(screen.getByRole('dialog', { name: 'Shopping cart' })).toBe(dialog);
    expect(document.activeElement).toBe(dialog);
    expect(header.closest('[inert]')).not.toBeNull();
    expect(main.closest('[inert]')).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Close cart' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(dialog).not.toHaveClass('open');
    expect(dialog).toHaveAttribute('aria-hidden', 'true');
    // Only the closed drawer itself stays inert (its controls are unreachable).
    expect([...document.querySelectorAll('[inert]')]).toEqual([dialog]);
    expect(document.activeElement).toBe(openButton);
  }, 30000);

  it('moves Tab within the dialog itself, both ways, whatever the browser’s own order', async () => {
    // jsdom lays nothing out; the dialog only moves focus to visible controls.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
      {},
    ] as unknown as DOMRectList);
    renderApp('/page-that-does-not-exist');
    fireEvent.click(screen.getByRole('button', { name: /Open cart/ }));
    const dialog = screen.getByRole('dialog', { name: 'Shopping cart' });
    const controls = [
      within(dialog).getByRole('button', { name: 'Close cart' }),
      within(dialog).getByRole('link', { name: 'Browse shop' }),
    ];

    // Every Tab is handled (Safari would otherwise skip the link).
    expect(fireEvent.keyDown(document, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(controls[0]);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(controls[1]);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(controls[0]);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(controls[1]);
  }, 30000);

  it('brings focus back into the dialog when the line it was on is removed', async () => {
    localStorage.setItem(
      'sattari-cart-v1',
      JSON.stringify([{ slug: 'cymbal-felts', size: null, color: null, quantity: 1 }])
    );
    renderApp('/page-that-does-not-exist');
    fireEvent.click(await screen.findByRole('button', { name: /Open cart with 1 item/ }));
    const dialog = screen.getByRole('dialog', { name: 'Shopping cart' });
    const remove = within(dialog).getByRole('button', { name: 'Remove Cymbal Felts from cart' });

    remove.focus();
    fireEvent.click(remove);
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));

    expect(remove.isConnected).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);
  }, 30000);
});

describe('route error boundary', () => {
  it('keeps the navbar and footer when a page fails, and recovers on navigation', async () => {
    renderApp('/studio-booking');

    expect(
      await screen.findByRole(
        'heading',
        { name: 'This page could not be shown' },
        { timeout: 10000 }
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    act(() => navigate('/page-that-does-not-exist'));

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  }, 30000);
});

describe('Sattari Learn replacement', () => {
  it.each(['/learn', '/loop'])(
    'opens the guided song journey through %s and retains saved guitar setup',
    async (path) => {
      expect(await preloadRoute('/learn')).toEqual({ hydrate: false });
      localStorage.setItem(
        'loop-guitar-profile-v1',
        JSON.stringify({ handedness: 'left', tuning: 'dropD', capo: 2 })
      );
      await act(async () => {
        renderApp(path);
      });

      expect(
        await screen.findByRole('button', { name: 'Sattari Learn song library' })
      ).toBeInTheDocument();
      expect(currentPath).toBe('/learn');
      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(
        screen.getByRole('heading', { name: /Your favorite song\.\s*In your hands\./ })
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to Sattari Hub' })).toHaveAttribute(
        'href',
        '/hub'
      );
      expect(
        screen.queryByRole('navigation', { name: 'Primary navigation' })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Analyze & teach' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Learn Ode to Joy' }));
      expect(
        screen.getByText('Your guitar · Drop D tuning · capo 2 · left-handed')
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Practice this song' }));
      expect(screen.getByRole('button', { name: 'Enable microphone' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Explore without a microphone' }));
      expect(screen.getByRole('button', { name: 'Hear this phrase' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Exit practice' }));
      expect(screen.getByRole('heading', { name: 'Ode to Joy' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('link', { name: 'Back to Sattari Hub' }));
      expect(currentPath).toBe('/hub');
      await act(async () => {
        await preloadRoute('/hub');
      });
    },
    120000
  );
});

it.each(['/learn/', '/LEARN'])(
  'keeps workspace chrome consistent at %s',
  async (path) => {
    await preloadRoute('/learn');
    renderApp(path);
    expect(
      await screen.findByRole('button', { name: 'Sattari Learn song library' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Primary navigation' })
    ).not.toBeInTheDocument();
    expect(document.querySelector('.site-shell > .footer')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open shop assistant: find a product or service' })
    ).not.toBeInTheDocument();
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    fireEvent.click(skip);
    expect(screen.getByRole('main')).toHaveFocus();
  },
  30000
);

describe('hydrating prerendered pages', () => {
  const HYDRATION_WARNING = /did not match|hydrat|server HTML|server rendered/i;

  function serverRender(path: string) {
    // As in scripts/prerender.mjs: Helmet collects the head instead of editing it.
    const canUseDOM = HelmetProvider.canUseDOM;
    HelmetProvider.canUseDOM = false;
    try {
      return renderToString(
        <HelmetProvider context={{}}>
          <ThemeProvider>
            <InventoryProvider initialInventory={SNAPSHOT}>
              <CartProvider>
                <StaticRouter location={path}>
                  <App />
                </StaticRouter>
              </CartProvider>
            </InventoryProvider>
          </ThemeProvider>
        </HelmetProvider>
      );
    } finally {
      HelmetProvider.canUseDOM = canUseDOM;
    }
  }

  it.each([
    ['/', '/'],
    ['/shop', '/shop'],
    ['/product/miami-electric-violin', '/product/miami-electric-violin'],
    ['/cart', '/cart'],
    // Prerendered without the query string Stripe adds.
    ['/checkout/success', '/checkout/success?session_id=cs_test_1'],
  ])(
    '%s hydrates without mismatches or the loading fallback, whatever this browser saved',
    async (path, url) => {
      await preloadRoute(path);
      const html = serverRender(path);
      expect(html).not.toContain('Loading...');
      // Only what happens in the browser counts: the development server
      // renderer warns about layout effects, which the production prerender
      // does not.
      vi.mocked(console.error).mockClear();

      // State the server cannot know: a saved cart and a day-theme choice.
      localStorage.setItem(
        'sattari-cart-v1',
        JSON.stringify([{ slug: 'pirouz-series-cymbals', size: null, color: null, quantity: 2 }])
      );
      localStorage.setItem('sattari-theme-pref-v1', 'day');
      document.documentElement.dataset.theme = 'day';

      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);
      const seen: string[] = [];
      const observer = new MutationObserver(() => seen.push(container.textContent || ''));
      observer.observe(container, { childList: true, subtree: true, characterData: true });

      let root: Root | undefined;
      await act(async () => {
        root = hydrateRoot(
          container,
          <Providers inventory={SNAPSHOT}>
            <MemoryRouter initialEntries={[url]}>
              <App />
            </MemoryRouter>
          </Providers>
        );
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

      const warnings = vi
        .mocked(console.error)
        .mock.calls.map((args) => args.map(String).join(' '))
        .filter((message) => HYDRATION_WARNING.test(message));
      expect(warnings).toEqual([]);
      expect(seen.some((text) => text.includes('Loading...'))).toBe(false);
      // The saved cart shows up once the page is live.
      expect(container.querySelector('.cart-badge')).toHaveTextContent('2');

      observer.disconnect();
      act(() => root?.unmount());
      container.remove();
    },
    30000
  );
});
