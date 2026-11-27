import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { describe, it, expect } from 'vitest';
import StudioInstallMetadata from './StudioInstallMetadata';

describe('Songboard installation metadata', () => {
  it('adds install metadata only while the studio is mounted', async () => {
    const view = render(
      <HelmetProvider>
        <StudioInstallMetadata />
      </HelmetProvider>
    );
    await waitFor(() =>
      expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe(
        '/studio.webmanifest'
      )
    );
    expect(
      document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')
    ).toBe('Songboard');
    view.unmount();
    await waitFor(() => expect(document.querySelector('link[rel="manifest"]')).toBeNull());
  });
});
