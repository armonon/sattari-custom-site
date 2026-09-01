/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const engineMethods = vi.hoisted(() => ({
  setCrossfader: vi.fn(),
  setMasterLevel: vi.fn(),
  setLimiter: vi.fn(),
  ensureDeck: vi.fn(),
  setDeckGain: vi.fn(),
  setPlaybackRate: vi.fn(),
  setLoop: vi.fn(),
  getDeckPosition: vi.fn(() => 0),
  getMeterLevel: vi.fn(() => 0),
  dispose: vi.fn(),
}));

vi.mock('../utils/studioAudioEngine', () => ({
  StudioAudioEngine: class {
    constructor() {
      Object.assign(this, engineMethods);
    }
  },
}));

vi.mock('../utils/audioProjectStore', () => ({
  clearStudioSession: vi.fn(),
  getAudioAsset: vi.fn(),
  loadStudioSession: vi.fn(() => null),
  putAudioAsset: vi.fn(),
  saveStudioSession: vi.fn(),
}));

import SattariStudioPage from './SattariStudioPage';

describe('SattariStudioPage', () => {
  it('opens a real empty workspace without fictional preloaded audio', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(screen.getByRole('heading', { name: 'Studio' })).toBeInTheDocument();
    expect(screen.getAllByText('Empty deck')).toHaveLength(4);
    expect(screen.queryByText('Midnight Drive')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play loaded decks' })).toBeDisabled();

    await waitFor(() => expect(screen.getByText('Saved locally')).toBeInTheDocument());
  }, 10000);
});
