// The parts of the Sentry SDK the site uses, as one lazily loaded chunk. A
// dynamic import of '@sentry/react' itself would bundle every integration
// (session replay, feedback, profiling); named re-exports let the build keep
// only these.
export { browserTracingIntegration, captureException, init } from '@sentry/react';
