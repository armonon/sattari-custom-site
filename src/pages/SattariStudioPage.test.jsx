/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const engineMethods = vi.hoisted(() => ({
  setCrossfader: vi.fn(),
  setCrossfaderCurve: vi.fn(),
  setMasterLevel: vi.fn(),
  setLimiter: vi.fn(),
  setMasterAssist: vi.fn(),
  ensureDeck: vi.fn(),
  setDeckGain: vi.fn(),
  setDeckFader: vi.fn(),
  setDeckSide: vi.fn(),
  setDeckEq: vi.fn(),
  setDeckFilter: vi.fn(),
  setDeckFx: vi.fn(),
  setDeckPitch: vi.fn(),
  setDeckKeyLock: vi.fn(),
  setStemPitch: vi.fn(),
  setLaneState: vi.fn(),
  setLaneFx: vi.fn(),
  setPlaybackRate: vi.fn(),
  setLoopRegion: vi.fn(),
  getDeckPosition: vi.fn(() => 0),
  getDeckMeterLevel: vi.fn(() => 0),
  seekDeck: vi.fn(),
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
  exportAudioAssets: vi.fn(async () => []),
  getAudioAsset: vi.fn(),
  importAudioAssets: vi.fn(),
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

    expect(screen.getByRole('heading', { name: 'StemDeck' })).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Add Source/ })).toBeInTheDocument();
    expect(screen.getByText('Drop music here, or add something you can play')).toBeInTheDocument();
    expect(screen.getByText('DROP A TRACK TO BEGIN')).toBeInTheDocument();
    expect(screen.queryByText('Midnight Drive')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play all decks' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Record live set' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SETS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PERFORM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'REPLAY' })).toBeInTheDocument();
    expect(screen.getByLabelText('Project key')).toHaveValue('Off');
    expect(screen.getByLabelText('Master output status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /OPEN MASTER/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'S1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FLOW' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'REPLAY' }));
    expect(screen.getByText('ARRANGEMENT VIEW')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Track' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bounce Edits' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Show automation for channel A' }));
    expect(screen.getByText('CHANNEL A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SYNC TO PROJECT' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('LOCAL SESSION')).toBeInTheDocument());
  }, 10000);
});
