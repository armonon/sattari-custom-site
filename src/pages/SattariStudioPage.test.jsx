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
  setMasterProcessing: vi.fn(),
  setMasterMonitor: vi.fn(),
  getMasterStatus: vi.fn(() => ({
    left: -96,
    right: -96,
    peak: -96,
    rms: -96,
    correlation: null,
    reduction: 0,
    clipped: false,
    state: 'running',
    sampleRate: 48000,
  })),
  unlock: vi.fn(async () => {}),
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
import { saveStudioSession } from '../utils/audioProjectStore';

describe('SattariStudioPage', () => {
  beforeEach(() => {
    storeMethods.loadStudioSession.mockReturnValue(null);
    vi.clearAllMocks();
  });

  it('restores and saves master processing, with independent monitor controls', async () => {
    storeMethods.loadStudioSession.mockReturnValue({
      masterProcessing: { low: 3, width: 115, ceiling: -2 },
    });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await waitFor(() => expect(screen.getByText('LOCAL SESSION')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Open master' }));
    expect(screen.getByLabelText('Master low EQ')).toHaveValue('3');
    expect(screen.getByLabelText('Stereo width')).toHaveValue('115');
    fireEvent.change(screen.getByLabelText('Master low EQ'), { target: { value: '6' } });
    await waitFor(() =>
      expect(engineMethods.setMasterProcessing).toHaveBeenLastCalledWith(
        expect.objectContaining({ low: 6, width: 115, ceiling: -2 })
      )
    );
    expect(saveStudioSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ masterProcessing: expect.objectContaining({ low: 6 }) })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mute speakers' }));
    expect(engineMethods.setMasterMonitor).toHaveBeenLastCalledWith({
      mono: false,
      dimmed: false,
      muted: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mono audition' }));
    expect(engineMethods.setMasterMonitor).toHaveBeenLastCalledWith({
      mono: true,
      dimmed: false,
      muted: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Audition neutral' }));
    expect(screen.getByLabelText('Master low EQ')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore master defaults' }));
    expect(screen.getByLabelText('Master low EQ')).toHaveValue('0');
    expect(screen.getByLabelText('Stereo width')).toHaveValue('100');
    expect(screen.getByLabelText('Limiter threshold')).toHaveValue('-1');
    expect(engineMethods.setMasterMonitor).toHaveBeenLastCalledWith({
      mono: false,
      dimmed: false,
      muted: false,
    });
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
    fireEvent.click(screen.getByRole('button', { name: 'Open master' }));
    expect(screen.getByRole('button', { name: 'Restore master defaults' })).toBeInTheDocument();
    expect(screen.getByLabelText('Stereo width')).toHaveValue('100');
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
