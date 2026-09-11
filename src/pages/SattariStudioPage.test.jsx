/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  playArrangement: vi.fn(async () => []),
  dispose: vi.fn(),
}));

const storeMethods = vi.hoisted(() => ({
  loadStudioSession: vi.fn(() => null),
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
  loadStudioSession: storeMethods.loadStudioSession,
  putAudioAsset: vi.fn(),
  saveStudioSession: vi.fn(),
}));

import SattariStudioPage from './SattariStudioPage';

describe('SattariStudioPage', () => {
  beforeEach(() => {
    storeMethods.loadStudioSession.mockReturnValue(null);
    vi.clearAllMocks();
  });

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
    expect(screen.getByRole('button', { name: 'Restore Clip' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Automation tool' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Show automation for channel A' }));
    expect(screen.getByText('CHANNEL A')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SYNC TO PROJECT' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'AUTO' }));
    expect(screen.getByText('AUTOMATION TARGET')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VOLUME' })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('LOCAL SESSION')).toBeInTheDocument());
  }, 10000);

  it('edits and restores a persisted Replay clip with automation controls', async () => {
    storeMethods.loadStudioSession.mockReturnValue({
      decks: [
        {
          id: 'A',
          title: 'Browser Session',
          duration: 30,
          bpm: 124,
          keyName: 'A min',
          waveform: Array(96).fill(22),
          arrangement: {
            enabled: true,
            start: 4,
            trimStart: 2,
            trimEnd: 26,
            gain: 100,
          },
        },
      ],
    });

    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    await waitFor(() => expect(screen.getByText('LOCAL SESSION')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'REPLAY' }));
    expect(screen.getByRole('button', { name: 'Edit Browser Session clip' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Trim start of Browser Session' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show automation for channel A' }));
    fireEvent.click(screen.getByRole('button', { name: 'AUTO' }));
    expect(screen.getByRole('button', { name: 'volume automation point 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CLIP' }));
    fireEvent.click(screen.getByRole('button', { name: 'REMOVE FROM REPLAY' }));
    expect(
      screen.getByRole('button', { name: 'Restore Browser Session to Replay' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Edit Browser Session clip' })).toBeInTheDocument();
  });
});
