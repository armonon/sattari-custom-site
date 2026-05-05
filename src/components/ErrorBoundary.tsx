import React, { ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              padding: '2rem',
              background: 'rgba(255, 59, 48, 0.1)',
              border: '1px solid #ff3b30',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#ff3b30',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            <h2>Something went wrong</h2>
            <p>We&apos;re sorry for the inconvenience. Please try refreshing the page.</p>
            {process.env.NODE_ENV === 'development' && (
              <details style={{ marginTop: '1rem', textAlign: 'left' }}>
                <summary>Error details</summary>
                <pre
                  style={{
                    background: '#000',
                    padding: '1rem',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '0.85rem',
                  }}
                >
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default Sentry.withErrorBoundary(ErrorBoundary, {
  fallback: (
    <div
      style={{
        padding: '2rem',
        background: 'rgba(255, 59, 48, 0.1)',
        border: '1px solid #ff3b30',
        borderRadius: '8px',
        textAlign: 'center',
        color: '#ff3b30',
      }}
    >
      <h2>Something went wrong</h2>
      <p>We&apos;re sorry for the inconvenience. Please try refreshing the page.</p>
    </div>
  ),
});
