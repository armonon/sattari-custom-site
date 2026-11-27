import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CartProvider } from '../context/CartContext';
import { InventoryProvider } from '../context/InventoryContext';
import { products } from '../data/catalog';
import GuitarShowroom from './GuitarShowroom';

const scene = vi.hoisted(() => ({
  create: vi.fn(),
  showHeroFrame: vi.fn(),
  stopMotion: vi.fn(),
  focus: vi.fn(),
  reset: vi.fn(),
  refresh: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  zoom: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('../showroom/createGaussianShowroom', () => ({ createGaussianShowroom: scene.create }));

const electricSlug = 'flame-stratocaster-electric-guitar';
const electricName = 'Flame Stratocaster Electric Guitar';
const conceptConfig = {
  url: null,
  poster: '/images/showroom/guitar-wall-clear-floor.png',
  hotspots: [],
};
const splatConfig = {
  url: '/images/showroom/test-room.spz',
  poster: '/images/showroom/guitar-wall-clear-floor.png',
  camera: { position: [0, 0, 3], target: [0, 0, 0] },
  hotspots: [{ slug: electricSlug, position: [0, 0, 0] }],
};

beforeEach(() => {
  // Most assertions exercise shopping, with automatic animation disabled.
  // Dedicated tour tests below explicitly enable and control motion.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }))
  );
  Object.values(scene).forEach((mock) => mock.mockReset());
  scene.create.mockImplementation(({ onReady }) => {
    onReady();
    return scene;
  });
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function renderShowroom({
  stock = {},
  overrides = {},
  hidden = [],
  config = conceptConfig,
  strict = false,
} = {}) {
  const inventory = { stock, catalog: { overrides, hidden, added: [] } };
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => inventory }))
  );
  let result;
  await act(async () => {
    result = render(
      <InventoryProvider initialInventory={inventory}>
        <CartProvider>
          <MemoryRouter>
            {strict ? (
              <StrictMode>
                <GuitarShowroom config={config} />
              </StrictMode>
            ) : (
              <GuitarShowroom config={config} />
            )}
          </MemoryRouter>
        </CartProvider>
      </InventoryProvider>
    );
  });
  return result;
}

async function waitForScene() {
  await waitFor(() =>
    expect(
      screen.getByRole('region', { name: 'Welcome to the shop.' }).querySelector('.showroom-canvas')
    ).not.toHaveAttribute('aria-hidden')
  );
}

function selectElectric() {
  fireEvent.click(screen.getByRole('button', { name: `Select ${electricName}` }));
  return within(
    screen.getByRole('complementary', { name: `Selected instrument: ${electricName}` })
  );
}

it('uses the current catalog price and product link when an instrument is selected', async () => {
  await renderShowroom({ overrides: { [electricSlug]: { price: 175.5 } } });

  const panel = selectElectric();
  expect(panel.getByRole('heading', { name: electricName })).toBeInTheDocument();
  expect(panel.getByText('$175.50')).toBeInTheDocument();
  expect(panel.getByRole('link', { name: 'Product photos' })).toHaveAttribute(
    'href',
    `/product/${electricSlug}`
  );
  expect(scene.create).not.toHaveBeenCalled();
  expect(panel.queryByRole('slider')).not.toBeInTheDocument();
});

it('adds a selected instrument through the shared cart', async () => {
  await renderShowroom();
  const panel = selectElectric();

  fireEvent.click(panel.getByRole('button', { name: 'Add to cart' }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('sattari-cart-v1'))).toEqual([
      expect.objectContaining({ slug: electricSlug, quantity: 1, size: null, color: null }),
    ])
  );
  expect(panel.getByRole('status')).toHaveTextContent(`${electricName} added to cart.`);
});

it('prevents a sold-out instrument from entering the cart', async () => {
  await renderShowroom({ stock: { [`${electricSlug}::::`]: 0 } });
  const panel = selectElectric();

  const add = panel.getByRole('button', { name: 'Out of stock' });
  expect(add).toBeDisabled();
  fireEvent.click(add);
  expect(JSON.parse(localStorage.getItem('sattari-cart-v1') || '[]')).toEqual([]);
});

it.each([
  { override: { colors: [{ name: 'Red', hex: '#a02020' }] }, label: 'Choose options' },
  { override: { sizes: [{ size: 'Full size', price: 150 }] }, label: 'Choose options' },
])(
  'routes a product needing $label to its detail page instead of quick-adding',
  async ({ override, label }) => {
    await renderShowroom({ overrides: { [electricSlug]: override } });
    const panel = selectElectric();

    expect(panel.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument();
    expect(panel.getByRole('link', { name: label })).toHaveAttribute(
      'href',
      `/product/${electricSlug}`
    );
    expect(JSON.parse(localStorage.getItem('sattari-cart-v1') || '[]')).toEqual([]);
  }
);

it('requires details for an inquiry-only instrument instead of quick-adding', async () => {
  // Inquiry flags belong to the authored catalog, not the editable stock layer.
  const electric = products.find((product) => product.slug === electricSlug);
  const originalInquiry = electric.purchaseInquiry;
  electric.purchaseInquiry = 'Confirm the model before ordering.';
  try {
    await renderShowroom();
    const panel = selectElectric();
    expect(panel.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Confirm product details' })).toHaveAttribute(
      'href',
      `/product/${electricSlug}`
    );
    expect(JSON.parse(localStorage.getItem('sattari-cart-v1') || '[]')).toEqual([]);
  } finally {
    if (originalInquiry === undefined) delete electric.purchaseInquiry;
    else electric.purchaseInquiry = originalInquiry;
  }
});

it('shows both original store photos and returns to the existing Gaussian scene', async () => {
  await renderShowroom({ config: splatConfig });
  await waitForScene();
  selectElectric();

  fireEvent.click(screen.getByRole('button', { name: 'Back to full wall' }));
  fireEvent.click(screen.getByRole('button', { name: 'Original store' }));
  expect(screen.getByRole('button', { name: 'Original store' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getByRole('img', { name: /actual Sattari Music store/ })).toHaveAttribute(
    'src',
    '/images/showroom/guitar-wall-reference.jpg'
  );
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(scene.reset).toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Violin wall' }));
  expect(screen.getByRole('img', { name: /actual Sattari Music violin display/ })).toHaveAttribute(
    'src',
    '/images/showroom/violin-wall-reference.jpg'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Showroom' }));
  expect(
    screen.queryByRole('img', { name: /actual Sattari Music violin display/ })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: `Explore ${electricName}` })).toBeInTheDocument();
  expect(scene.create).toHaveBeenCalledTimes(1);
});

it('keeps the concept and purchase details usable when the Gaussian viewer cannot start', async () => {
  scene.create.mockImplementation(() => {
    throw new Error('WebGL unavailable');
  });
  await renderShowroom({ config: splatConfig });
  expect(await screen.findByText(/3D could not load/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: `Explore ${electricName}` })).not.toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: /Guitars on display in the showroom/ })
  ).toBeInTheDocument();

  const panel = selectElectric();
  expect(panel.getByText('$150.00')).toBeInTheDocument();
  expect(panel.getByRole('link', { name: 'Product photos' })).toHaveAttribute(
    'href',
    `/product/${electricSlug}`
  );
  expect(panel.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  expect(panel.queryByRole('slider')).not.toBeInTheDocument();
});

it('opens product details from a scene selection and disposes the scene when leaving', async () => {
  const result = await renderShowroom({ config: splatConfig });
  await waitForScene();
  const callbacks = scene.create.mock.calls[0][0];
  act(() => callbacks.onSelect('five-string-bass-guitar'));
  expect(
    screen.getByRole('complementary', { name: 'Selected instrument: 5 String Bass Guitar' })
  ).toBeInTheDocument();

  result.unmount();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
});

it('shows the still preview without loading a 3D renderer when no splat exists', async () => {
  await renderShowroom();
  expect(screen.getByRole('heading', { name: 'Welcome to the shop.' })).toBeInTheDocument();
  expect(
    screen.queryByText(/AI-generated|reconstruction pending|Woodland Hills, California/i)
  ).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Guitars on display in the showroom/ })).toHaveAttribute(
    'src',
    '/images/showroom/guitar-wall-clear-floor.png'
  );
  expect(scene.create).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: `Explore ${electricName}` })).not.toBeInTheDocument();
  expect(screen.queryByText(/Drag to look around/)).not.toBeInTheDocument();
});

it('reveals interactive scene markers only after the configured splat reports ready', async () => {
  scene.create.mockImplementation(() => scene);
  await renderShowroom({ config: splatConfig });
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Bringing the showroom to life')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: `Explore ${electricName}` })).not.toBeInTheDocument();
  expect(scene.create.mock.calls[0][0].config).toBe(splatConfig);

  act(() => scene.create.mock.calls[0][0].onReady({ renderer: 'gaussian-splats' }));
  await waitForScene();
  expect(
    screen.queryByRole('img', { name: /Guitars on display in the showroom/ })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: `Explore ${electricName}` })).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Explore 5 String Bass Guitar' })
  ).not.toBeInTheDocument();
  selectElectric();
  expect(scene.focus).toHaveBeenCalledWith(electricSlug);
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Refine lighting' })).not.toBeInTheDocument();
});

it('falls back on a loading failure and ignores late ready callbacks', async () => {
  scene.create.mockImplementation(() => scene);
  const result = await renderShowroom({ config: splatConfig });
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  const callbacks = scene.create.mock.calls[0][0];
  act(() => callbacks.onError(new Error('Invalid splat')));
  expect(screen.getByText(/3D could not load/)).toBeInTheDocument();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
  act(() => callbacks.onReady());
  expect(screen.queryByRole('button', { name: `Explore ${electricName}` })).not.toBeInTheDocument();
  expect(selectElectric().getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  result.unmount();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
});

it('disposes an in-flight viewer and ignores callbacks after unmount', async () => {
  scene.create.mockImplementation(() => scene);
  const result = await renderShowroom({ config: splatConfig });
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  const callbacks = scene.create.mock.calls[0][0];
  result.unmount();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
  act(() => {
    callbacks.onReady();
    callbacks.onSelect(electricSlug);
    callbacks.onError(new Error('Aborted'));
  });
  expect(scene.focus).not.toHaveBeenCalled();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
});

it('moves keyboard focus into product details and returns to the chosen instrument on close', async () => {
  await renderShowroom();
  const trigger = screen.getByRole('button', { name: `Select ${electricName}` });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  const panel = screen.getByRole('complementary', { name: `Selected instrument: ${electricName}` });
  expect(panel).toHaveFocus();
  fireEvent.click(within(panel).getByRole('button', { name: 'Close instrument details' }));
  expect(trigger).toHaveFocus();
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
});

it('reports actual download size and separates downloading from preparing the scene', async () => {
  scene.create.mockImplementation(() => scene);
  await renderShowroom({ config: splatConfig });
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  const callbacks = scene.create.mock.calls[0][0];
  expect(screen.getByRole('progressbar', { name: 'Downloading showroom' })).not.toHaveAttribute(
    'value'
  );

  act(() => callbacks.onProgress({ phase: 'downloading', loaded: 15000000, total: 30000000 }));
  expect(screen.getByRole('progressbar', { name: 'Downloading showroom' })).toHaveAttribute(
    'value',
    '50'
  );
  expect(screen.getByText('50%')).toBeInTheDocument();
  act(() => callbacks.onProgress({ phase: 'decoding', loaded: 30000000, total: 30000000 }));
  expect(screen.getByText('Almost ready')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Preparing 3D view' })).not.toHaveAttribute(
    'value'
  );
  expect(screen.queryByRole('button', { name: `Explore ${electricName}` })).not.toBeInTheDocument();
  act(() => callbacks.onReady());
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  await waitForScene();
});

it('keeps downloads with unknown size indeterminate instead of inventing a percentage', async () => {
  scene.create.mockImplementation(() => scene);
  await renderShowroom({ config: splatConfig });
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  act(() =>
    scene.create.mock.calls[0][0].onProgress({ phase: 'downloading', loaded: 8000000, total: 0 })
  );
  expect(screen.getByText('Bringing the showroom to life')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Downloading showroom' })).not.toHaveAttribute(
    'value'
  );
});

it('retries a failed asset without reloading the page or accepting callbacks from the failed attempt', async () => {
  scene.create.mockImplementation(() => scene);
  await renderShowroom({ config: splatConfig });
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  const first = scene.create.mock.calls[0][0];
  act(() => first.onError(new Error('Network interrupted')));
  expect(scene.dispose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(2));
  act(() => {
    first.onReady();
    first.onProgress({ phase: 'downloading', loaded: 30000000, total: 30000000 });
  });
  expect(screen.getByText('Bringing the showroom to life')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: `Explore ${electricName}` })).not.toBeInTheDocument();
  act(() => scene.create.mock.calls[1][0].onReady());
  await waitForScene();
});

it('does not claim an addition when the saved cart is already at the per-item limit', async () => {
  localStorage.setItem(
    'sattari-cart-v1',
    JSON.stringify([{ slug: electricSlug, size: null, color: null, quantity: 10 }])
  );
  await renderShowroom();
  const panel = selectElectric();
  const add = panel.getByRole('button', { name: 'Cart limit reached' });
  expect(add).toBeDisabled();
  expect(
    panel.getByText('Your cart has 10. Maximum 10 per item in one online order.')
  ).toBeInTheDocument();
  fireEvent.click(add);
  expect(panel.getByRole('status')).not.toHaveTextContent(/added to cart/i);
  expect(JSON.parse(localStorage.getItem('sattari-cart-v1'))[0].quantity).toBe(10);
});

it('removes covered scene markers from interaction while product details are open', async () => {
  await renderShowroom({ config: splatConfig });
  await waitForScene();
  const marker = screen.getByRole('button', { name: `Explore ${electricName}` });
  fireEvent.click(marker);
  expect(marker.parentElement).toHaveAttribute('hidden');
  expect(marker.parentElement).toHaveAttribute('inert');
  expect(screen.queryByRole('button', { name: `Explore ${electricName}` })).not.toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole('complementary'), { key: 'Escape' });
  expect(marker.parentElement).not.toHaveAttribute('hidden');
  expect(marker).toHaveFocus();
});

it.each([false, true])(
  'keeps selection navigation visible with reduced motion (desktop: %s)',
  async (desktop) => {
    const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scroll,
    });
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query) => ({
        matches:
          query === '(prefers-reduced-motion: reduce)' ||
          (desktop && query === '(min-width: 960px)'),
      }))
    );
    try {
      await renderShowroom();
      vi.spyOn(
        screen.getByRole('heading', { name: 'Welcome to the shop.' }).closest('.showroom-stage'),
        'getBoundingClientRect'
      ).mockReturnValue({ top: -250 });
      selectElectric();
      expect(scroll).toHaveBeenCalledWith({
        behavior: 'instant',
        block: 'start',
      });
      const panel = screen.getByRole('complementary');
      expect(scroll.mock.contexts.at(-1)).toBe(panel.closest('.showroom-stage'));
    } finally {
      if (previous) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', previous);
      else delete HTMLElement.prototype.scrollIntoView;
    }
  }
);

it('shows only catalog-supported specifications for the selected instrument', async () => {
  await renderShowroom();
  fireEvent.click(screen.getByRole('button', { name: 'Select Classic Nylon String Guitar' }));
  let panel = within(
    screen.getByRole('complementary', { name: 'Selected instrument: Classic Nylon String Guitar' })
  );
  expect(panel.getByRole('heading', { name: 'Specifications' })).toBeInTheDocument();
  expect(panel.getByText('Overall size')).toBeInTheDocument();
  expect(panel.getByText('40 inches')).toBeInTheDocument();
  expect(panel.getByText('spruce')).toBeInTheDocument();
  expect(panel.getByText('sapele')).toBeInTheDocument();
  expect(panel.getByText('rosewood')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Previous instrument' }));
  panel = within(
    screen.getByRole('complementary', { name: 'Selected instrument: 5 String Bass Guitar' })
  );
  expect(panel.getByText('5 (BEADG)')).toBeInTheDocument();
  expect(panel.getByText('individually set up and shipped from California')).toBeInTheDocument();
  expect(panel.getByText('gloss')).toBeInTheDocument();
  expect(panel.queryByText('Top')).not.toBeInTheDocument();
  expect(panel.queryByText(/pickup|maple|mahogany/i)).not.toBeInTheDocument();
});

it('cycles through instruments and returns to the full wall with an accessible back action', async () => {
  await renderShowroom({ config: splatConfig });
  await waitForScene();
  selectElectric();
  fireEvent.click(screen.getByRole('button', { name: 'Previous instrument' }));
  expect(
    screen.getByRole('complementary', { name: 'Selected instrument: Steel String Acoustic Guitar' })
  ).toHaveFocus();
  expect(scene.focus).toHaveBeenLastCalledWith('steel-string-acoustic-guitar');
  fireEvent.click(screen.getByRole('button', { name: 'Next instrument' }));
  expect(
    screen.getByRole('complementary', { name: `Selected instrument: ${electricName}` })
  ).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Next instrument' }));
  expect(
    screen.getByRole('complementary', { name: 'Selected instrument: 5 String Bass Guitar' })
  ).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Back to full wall' }));
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  expect(scene.reset).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Select 5 String Bass Guitar' })).toHaveFocus();
});

it('skips hidden catalog instruments when moving to the next selection', async () => {
  await renderShowroom({ hidden: ['five-string-bass-guitar'] });
  selectElectric();
  fireEvent.click(screen.getByRole('button', { name: 'Next instrument' }));
  expect(
    screen.getByRole('complementary', { name: 'Selected instrument: Classic Nylon String Guitar' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Select 5 String Bass Guitar' })
  ).not.toBeInTheDocument();
});

it('replays an early product selection once the showroom finishes loading', async () => {
  scene.create.mockImplementation(() => scene);
  await renderShowroom({ config: splatConfig });
  await waitFor(() => expect(scene.create).toHaveBeenCalledTimes(1));
  selectElectric();
  scene.focus.mockClear();
  act(() => scene.create.mock.calls[0][0].onReady());
  await waitForScene();
  expect(scene.focus).toHaveBeenCalledExactlyOnceWith(electricSlug);
  act(() =>
    scene.create.mock.calls[0][0].onProgress({ phase: 'ready', loaded: 30000000, total: 30000000 })
  );
  expect(scene.focus).toHaveBeenCalledTimes(1);
});

it('advances the ambient scene once per interval in StrictMode and remains paused after interaction and selection', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  );
  // Cover Vitest's evaluated-module path during StrictMode's concurrent imports.
  const actualRenderer = await vi.importActual('../showroom/createGaussianShowroom');
  vi.spyOn(actualRenderer, 'createGaussianShowroom').mockImplementation(scene.create);
  const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  try {
    await renderShowroom({ config: splatConfig, strict: true });
    await waitForScene();
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    act(() => vi.advanceTimersByTime(8000));
    expect(scene.showHeroFrame).toHaveBeenCalledExactlyOnceWith(1);
    const stage = screen.getByRole('button', { name: 'Showroom' }).closest('.showroom-stage');
    fireEvent.pointerDown(stage);
    expect(scene.stopMotion).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(16000));
    expect(scene.showHeroFrame).toHaveBeenCalledTimes(1);
    selectElectric();
    fireEvent.click(screen.getByRole('button', { name: 'Back to full wall' }));
    act(() => vi.advanceTimersByTime(16000));
    expect(scene.showHeroFrame).toHaveBeenCalledTimes(1);
  } finally {
    if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
    else delete document.visibilityState;
  }
});

it('does not automatically move the showroom with reduced motion enabled', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }))
  );
  await renderShowroom({ config: splatConfig });
  await waitForScene();
  vi.useFakeTimers();
  act(() => vi.advanceTimersByTime(24000));
  expect(scene.showHeroFrame).not.toHaveBeenCalled();
  selectElectric();
  expect(scene.focus).toHaveBeenCalledWith(electricSlug);
});

it('suspends the tour and renderer when hidden or outside the viewport', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  );
  let intersection;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        intersection = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
  );
  const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  const result = await renderShowroom({ config: splatConfig });
  await waitForScene();
  try {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));
    vi.useFakeTimers();
    scene.showHeroFrame.mockClear();
    expect(scene.pause).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(16000));
    expect(scene.showHeroFrame).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    act(() => intersection([{ isIntersecting: true, intersectionRatio: 0.1 }]));
    act(() => vi.advanceTimersByTime(16000));
    expect(scene.showHeroFrame).not.toHaveBeenCalled();
    act(() => intersection([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    act(() => vi.advanceTimersByTime(8000));
    expect(scene.showHeroFrame).toHaveBeenCalledExactlyOnceWith(1);
    result.unmount();
    expect(disconnect).toHaveBeenCalled();
  } finally {
    if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
    else delete document.visibilityState;
  }
});

it('prerenders the showroom without window or document globals', () => {
  const originalWindow = window;
  const originalDocument = document;
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    const markup = renderToString(
      <InventoryProvider initialInventory={{ stock: {}, catalog: {} }}>
        <CartProvider>
          <MemoryRouter>
            <GuitarShowroom config={splatConfig} />
          </MemoryRouter>
        </CartProvider>
      </InventoryProvider>
    );
    expect(markup).toContain('Welcome to');
    expect(markup).toContain('the shop.');
    expect(markup).toContain('Bringing the showroom to life');
  } finally {
    vi.stubGlobal('window', originalWindow);
    vi.stubGlobal('document', originalDocument);
    errors.mockRestore();
  }
});

it('keeps shopping navigation while removing the entire former control row', async () => {
  await renderShowroom({ config: splatConfig });
  await waitForScene();
  const removed =
    /zoom in|zoom out|reset showroom|fullscreen|play showroom|pause showroom|show full wall|show electric guitars|show bass guitars|show acoustic guitars/i;
  expect(screen.queryByRole('button', { name: removed })).not.toBeInTheDocument();
  expect(screen.queryByText('How to explore')).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Guitar collection' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Explore instruments' })).toHaveAttribute(
    'href',
    '#shop-catalog'
  );
  selectElectric();
  expect(screen.getByRole('button', { name: 'Back to full wall' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Previous instrument' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Next instrument' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: removed })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
});

it('switches directly between instruments without scrolling the page or recreating the scene', async () => {
  await renderShowroom({ config: splatConfig });
  await waitForScene();
  selectElectric();
  const stage = screen.getByRole('complementary').closest('.showroom-stage');
  const measure = vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ top: 0 });
  const scroll = vi.fn();
  stage.scrollIntoView = scroll;
  fireEvent.click(screen.getByRole('button', { name: 'Switch to Classic Nylon String Guitar' }));
  expect(
    screen.getByRole('complementary', { name: 'Selected instrument: Classic Nylon String Guitar' })
  ).toBeInTheDocument();
  expect(scroll).not.toHaveBeenCalled();
  expect(scene.create).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Back to full wall' }));
  expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
  measure.mockRestore();
});
