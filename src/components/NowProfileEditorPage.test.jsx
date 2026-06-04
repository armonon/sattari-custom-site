import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NowProfileEditorPage from './NowProfileEditorPage.jsx';

function renderEditor(route = '/profiles/armon/edit') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/profiles/:handle/edit" element={<NowProfileEditorPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('NOW profile editor page', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              schema: 'now-profile-api-v0',
              storage: { source: 'stored' },
              profile: {
                handle: 'armon',
                displayName: 'Armon Nasiri',
                headline: 'NOW profile owner',
                location: 'Los Angeles, CA',
                bio: 'Saved profile bio.',
                avatarInitials: 'AN',
                roles: ['artist', 'seller'],
                socials: [{ label: 'Website', url: 'https://example.com/' }],
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
      )
    );
  });

  it('renders the real profile editor fields and save boundary', async () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: /save one real profile/i })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Armon Nasiri')).toBeInTheDocument();
    expect(screen.getByText(/owner\/admin write guarded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save now profile/i })).toBeInTheDocument();
  });
});
