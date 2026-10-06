import { PassThrough } from 'node:stream';
import { Buffer } from 'node:buffer';
import { renderToPipeableStream } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { CartProvider } from './context/CartContext';
import { InventoryProvider } from './context/InventoryContext';
import { ThemeProvider } from './context/ThemeContext';
import { localSeoPages } from './components/LocalSeoPage';
import { categories, products } from './data/catalog';
import { mergeCatalog, EMPTY_CATALOG_DOC } from './utils/catalogMerge';
import { musicGuides } from './data/musicGuides';
import { toolDetails } from './data/toolDetails';

const LOCAL_SEO_ENTRY = 'src/components/LocalSeoPage.tsx';
const localPages = Object.values(localSeoPages);

export function getPrerenderRoutes(inventory) {
  const routes = [
    ...[
      '/guides',
      '/visit',
      '/privacy',
      ...musicGuides.map((guide) => `/guides/${guide.slug}`),
      ...Object.values(toolDetails).map((tool) => `/tools${tool.path}`),
    ].map((path) => [path, 'src/pages/MusicResources.jsx']),
    ['/', 'src/pages/HomePage.jsx'],
    ['/about', 'src/components/AboutPage.jsx'],
    ['/shop', 'src/components/ShopPage.jsx'],
    ['/services', 'src/components/ServicesPage.jsx'],
    ['/services/instrument-repair-los-angeles', 'src/components/RepairPage.tsx'],
    ['/hub', 'src/pages/SattariHubPage.jsx'],
    ['/learn', 'src/pages/LoopPracticePage.jsx'],
    ['/studio', 'src/pages/SattariStudioPage.jsx'],
    ['/stem-separator', 'src/pages/StemSeparatorPage.jsx'],
    ['/downloads', 'src/pages/DownloadsPage.tsx'],
    ...localPages
      .filter((page) => !page.canonicalUrl)
      .map((page) => [new URL(page.url).pathname, LOCAL_SEO_ENTRY]),
    ...[...categories.map((category) => category.key), 'all'].map((key) => [
      `/shop/${key}`,
      'src/pages/Category.jsx',
    ]),
    ...mergeCatalog(products, inventory.catalog || EMPTY_CATALOG_DOC).map((product) => [
      `/product/${product.slug}`,
      'src/pages/ProductDetail.jsx',
    ]),
  ].map(([path, entry]) => ({ path, entry, indexable: true }));
  return [
    ...routes,
    // Public pages that canonicalize to another URL: prerendered, but left out
    // of the sitemap, which lists canonical URLs only.
    ...localPages
      .filter((page) => page.canonicalUrl)
      .map((page) => ({
        path: new URL(page.url).pathname,
        entry: LOCAL_SEO_ENTRY,
        indexable: false,
      })),
    ...[
      ['/cart', 'src/pages/CartPage.tsx'],
      ['/studio-booking', 'src/pages/StudioBookingStatus.jsx'],
      // Studio alpha labs: prerendered so they are real pages, noindex while alpha.
      ['/studio/split', 'src/labs/split/SplitPage.jsx'],
      ['/studio/keybpm', 'src/labs/keybpm/KeyBpmPage.jsx'],
      ['/studio/vox', 'src/labs/vox/VoxPage.jsx'],
      ['/checkout/success', 'src/pages/CheckoutStatus.jsx'],
      ['/checkout/cancel', 'src/pages/CheckoutStatus.jsx'],
      ['/instagram/callback', 'src/pages/InstagramCallback.jsx'],
      ['/404', 'src/components/NotFoundPage.tsx'],
      // Wave-2 alpha tools: public but noindex until the owner decides.
      ['/studio/canvas', 'src/labs/canvas/CanvasPage.jsx'],
      ['/studio/pocket', 'src/labs/pocket/PocketPage.jsx'],
      ['/press', 'src/labs/press/PressPage.jsx'],
    ].map(([path, entry]) => ({ path, entry, indexable: false })),
  ];
}

// Render the actual routes without effects, user data, network requests or audio
// initialization. The browser then mounts the same application normally.
export function renderPage(path, inventory) {
  return new Promise((resolve, reject) => {
    const helmetContext = {};
    const output = new PassThrough();
    const chunks = [];
    const timeout = setTimeout(() => {
      stream.abort();
      reject(new Error(`Prerender timed out: ${path}`));
    }, 30000);
    output.on('data', (chunk) => chunks.push(chunk));
    output.on('end', () => {
      clearTimeout(timeout);
      const { helmet } = helmetContext;
      resolve({
        html: Buffer.concat(chunks).toString(),
        head: ['title', 'meta', 'link', 'script'].map((key) => helmet[key].toString()).join('\n'),
      });
    });
    const stream = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <ThemeProvider>
          <InventoryProvider initialInventory={inventory}>
            <CartProvider>
              <StaticRouter location={path}>
                <App />
              </StaticRouter>
            </CartProvider>
          </InventoryProvider>
        </ThemeProvider>
      </HelmetProvider>,
      {
        onAllReady() {
          stream.pipe(output);
        },
        onError(error) {
          clearTimeout(timeout);
          reject(error);
        },
      }
    );
  });
}
