// Error and performance reporting (Sentry), loaded once the browser is idle so
// the SDK never delays a page's first render. Errors raised before it loads,
// including uncaught ones, are queued and sent when it is ready. Without
// VITE_SENTRY_DSN the SDK is never downloaded at all.
type SentryModule = typeof import('./sentryClient');
type CaptureContext = Parameters<SentryModule['captureException']>[1];

const MAX_QUEUED = 20;
let sentry: SentryModule | null = null;
let queued: Array<[unknown, CaptureContext]> = [];

const dsn = () => import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function captureException(error: unknown, context?: CaptureContext) {
  if (!dsn()) return;
  if (sentry) sentry.captureException(error, context);
  else if (queued.length < MAX_QUEUED) queued.push([error, context]);
}

/**
 * Starts reporting after the page is interactive. `routeName` turns a URL path
 * into its route ("/product/:slug"), so page loads and navigations group by
 * page rather than by every product URL.
 */
export function startMonitoring(routeName: (pathname: string) => string) {
  if (!dsn() || typeof window === 'undefined') return Promise.resolve(false);
  const early = (event: ErrorEvent | PromiseRejectionEvent) =>
    captureException('reason' in event ? event.reason : (event.error ?? event.message));
  window.addEventListener('error', early);
  window.addEventListener('unhandledrejection', early);
  const load = async () => {
    const module = await import('./sentryClient');
    module.init({
      dsn: dsn(),
      environment: import.meta.env.MODE,
      integrations: [
        module.browserTracingIntegration({
          beforeStartSpan: (options) => ({
            ...options,
            name: routeName(window.location.pathname),
          }),
        }),
      ],
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    });
    window.removeEventListener('error', early);
    window.removeEventListener('unhandledrejection', early);
    sentry = module;
    const pending = queued;
    queued = [];
    for (const [error, context] of pending) module.captureException(error, context);
    return true;
  };
  return new Promise<boolean>((resolve) => {
    const start = () => load().then(resolve, () => resolve(false));
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 });
    else setTimeout(start, 2000);
  });
}
