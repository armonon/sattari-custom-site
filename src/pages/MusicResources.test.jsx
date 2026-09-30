import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it } from 'vitest';
import { GuideArticle, ToolDetailsPage } from './MusicResources';

it.each(['how-to-separate-vocals-drums-bass', 'practice-bass-with-isolated-stems'])(
  'includes the original and real separation estimates in %s',
  (slug) => {
    const { container } = render(
      <HelmetProvider>
        <MemoryRouter initialEntries={[`/guides/${slug}`]}>
          <Routes>
            <Route path="/guides/:slug" element={<GuideArticle />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(
      [...container.querySelectorAll('audio')].map((node) => node.getAttribute('src'))
    ).toEqual([
      '/audio/sattari-practice-demo.wav',
      '/audio/sattari-demo-bass.wav',
      '/audio/sattari-demo-drums.wav',
    ]);
    expect(screen.getByText(/unedited HTDemucs estimates/)).toHaveTextContent(
      'not the clean synthesis sources'
    );
    expect(screen.getByRole('link', { name: 'Sattari Studio' })).toHaveAttribute('href', '/studio');
    for (const audio of container.querySelectorAll('audio')) {
      expect(audio).toHaveAttribute('preload', 'none');
      expect(audio).not.toHaveAttribute('autoplay');
    }
  }
);
it('keeps one original mix plus both estimates on the tool reference page', () => {
  const { container } = render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/tools/stem-separator']}>
        <Routes>
          <Route path="/tools/:tool" element={<ToolDetailsPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
  expect(container.querySelectorAll('audio')).toHaveLength(3);
  expect(container.querySelectorAll('#stem-example-title')).toHaveLength(1);
});
