import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { captureException } from '../utils/monitoring';
import { isChunkLoadError, reloadForNewDeploy } from '@utils/lazyComponents';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  /** The page being shown. A new value clears the error, so navigating away recovers. */
  resetKey: string;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

// Sits inside the layout, around the routes only: a page that fails to render
// (or whose code cannot be downloaded) replaces just the page, and the navbar
// and footer stay usable.
export default class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // A missing chunk after a deploy is fixed by a reload; lazyComponents has
    // usually started one already, and the guard there prevents a loop.
    if (isChunkLoadError(error) && reloadForNewDeploy()) return;
    console.error('Route error caught by boundary:', error, errorInfo);
    captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  componentDidUpdate(previous: RouteErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkError = isChunkLoadError(error);
    return (
      <section className="section page-header-offset route-error" role="alert">
        <div className="container section-header narrow">
          <h1>{chunkError ? 'This page needs a refresh' : 'This page could not be shown'}</h1>
          <p>
            {chunkError
              ? 'The site was updated while this tab was open, or the connection dropped. Reload to get the latest version.'
              : 'Something went wrong on our side. Reload to try again, or keep browsing.'}
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="button button-solid"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <Link to="/" className="button button-outline">
              Go to the homepage
            </Link>
          </div>
        </div>
      </section>
    );
  }
}
