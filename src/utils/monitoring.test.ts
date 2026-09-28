import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  browserTracingIntegration: vi.fn((options) => ({ name: 'BrowserTracing', options })),
}));
vi.mock('./sentryClient', () => sentry);

const load = async () => {
  vi.resetModules();
  return import('./monitoring');
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => callback());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('never downloads the SDK when no DSN is configured', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', '');
  const monitoring = await load();
  monitoring.captureException(new Error('ignored'));
  expect(await monitoring.startMonitoring((path) => path)).toBe(false);
  expect(sentry.init).not.toHaveBeenCalled();
  expect(sentry.captureException).not.toHaveBeenCalled();
});

it('queues errors raised before the SDK loads, then sends them', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1');
  const monitoring = await load();
  const early = new Error('during hydration');
  monitoring.captureException(early, { tags: { feature: 'test' } });
  expect(sentry.captureException).not.toHaveBeenCalled();

  expect(await monitoring.startMonitoring(() => '/product/:slug')).toBe(true);
  expect(sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({ dsn: 'https://key@o1.ingest.sentry.io/1' })
  );
  expect(sentry.captureException).toHaveBeenCalledWith(early, { tags: { feature: 'test' } });

  // Page loads and navigations are named by route, not by URL.
  const { beforeStartSpan } = sentry.browserTracingIntegration.mock.calls[0][0];
  expect(beforeStartSpan({ name: '/product/cremona-violin', op: 'pageload' })).toMatchObject({
    name: '/product/:slug',
    op: 'pageload',
  });

  monitoring.captureException('later');
  expect(sentry.captureException).toHaveBeenLastCalledWith('later', undefined);
});

it('catches uncaught errors that happen before the SDK is ready', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1');
  let start: () => void = () => {};
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => (start = callback));
  const monitoring = await load();
  const ready = monitoring.startMonitoring((path) => path);
  const failure = new Error('boom before idle');
  window.dispatchEvent(new ErrorEvent('error', { error: failure, message: failure.message }));
  start();
  await ready;
  expect(sentry.captureException).toHaveBeenCalledWith(failure, undefined);
});

it('keeps at most 20 early errors', async () => {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/1');
  const monitoring = await load();
  for (let index = 0; index < 50; index += 1) monitoring.captureException(index);
  await monitoring.startMonitoring((path) => path);
  expect(sentry.captureException).toHaveBeenCalledTimes(20);
});
