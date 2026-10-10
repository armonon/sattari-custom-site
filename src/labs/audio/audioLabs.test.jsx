import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SplitPage from '../split/SplitPage';
import KeyBpmPage from '../keybpm/KeyBpmPage';
import VoxPage from '../vox/VoxPage';
import { LAB_TOOLS } from './audioLabTools';

vi.mock('../../utils/seo', () => ({ SEO: () => null }));
vi.mock('../../pwa/SattariAppMetadata', () => ({ default: () => null }));
vi.mock('../split/SplitOffline', () => ({ default: () => null }));

class FakeWorker {
  postMessage() {}
  terminate() {}
}

afterEach(() => vi.unstubAllGlobals());

describe.each([
  ['Split', SplitPage, /Split into stems|Add a song/, /bleed between stems/],
  ['Key & BPM', KeyBpmPage, /Add tracks/, /half or double time/],
  ['Vox', VoxPage, /Record a take/, /monophonic/],
])('%s lab', (title, Page, control, limitation) => {
  it('is labelled alpha, states its limits and links the other labs', () => {
    vi.stubGlobal('Worker', FakeWorker);
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Alpha');
    expect(screen.getAllByText(control).length).toBeGreaterThan(0);
    expect(screen.getByText(limitation)).toBeInTheDocument();
    expect(screen.getByText(/Runs on your device/)).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Studio labs' });
    for (const tool of LAB_TOOLS) {
      expect(nav.querySelector(`a[href="${tool.path}"]`)).not.toBeNull();
    }
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent(title);
  });
});
