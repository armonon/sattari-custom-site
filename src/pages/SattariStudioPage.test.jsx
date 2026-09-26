/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  getAudioContext: vi.fn(() => ({ rawContext: {} })),
  openMicrophone: vi.fn(async () => {}),
  closeMicrophone: vi.fn(),
  getInputState: vi.fn(),
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
  playAll: vi.fn(async () => []),
  playDeck: vi.fn(async () => false),
  pauseAll: vi.fn(),
  pauseDeck: vi.fn(),
  dispose: vi.fn(),
  startRecording: vi.fn(async () => {}),
  stopRecording: vi.fn(async () => null),
  capturedPerformance: vi.fn(() => []),
  capturedSources: vi.fn(() => ({ tracks: [] })),
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
vi.mock('../utils/arrangementEngine', () => ({
  ArrangementEngine: class {
    playing = false;
    pause() {
      this.playing = false;
      return 0;
    }
    stop() {
      this.playing = false;
    }
    dispose() {}
    audition() {}
    setMasterSettings() {}
    async play() {
      return false;
    }
  },
}));

vi.mock('../utils/audioProjectStore', () => ({
  clearStudioSession: vi.fn(),
  exportAudioAssets: vi.fn(async () => []),
  getAudioAsset: vi.fn(),
  importAudioAssets: vi.fn(async () => new Map()),
  loadStudioSession: storeMethods.loadStudioSession,
  putAudioAsset: vi.fn(),
  saveStudioSession: vi.fn(),
  validateStudioProject: vi.fn(),
}));

import SattariStudioPage from './SattariStudioPage';
import { saveStudioSession, putAudioAsset } from '../utils/audioProjectStore';
import { COMPACT_ICONS_KEY } from '../utils/studioDisplay';

describe('SattariStudioPage', () => {
  beforeEach(() => {
    localStorage.removeItem(COMPACT_ICONS_KEY);
    // Emergency-download URL cleanup can fire after its test under a heavily
    // loaded machine. Keep browser URL methods defined between test cases.
    URL.createObjectURL ??= vi.fn(() => 'blob:test');
    URL.revokeObjectURL ??= vi.fn();
    // jsdom has no top-layer dialog implementation; model only open/close here.
    HTMLDialogElement.prototype.showModal ??= function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function () {
      this.removeAttribute('open');
    };
    storeMethods.loadStudioSession.mockReturnValue(null);
    vi.clearAllMocks();
    engineMethods.getInputState.mockReturnValue(undefined);
  });

  it('preserves workspace navigation and a keyboard skip target across the modern shell', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    const navigation = screen.getByRole('navigation', { name: 'STEMDECK workspaces' });
    const brand = screen.getByRole('heading', { name: 'STEMDECK', level: 1 });
    expect(brand).toHaveClass('sd-product-brand');
    expect(navigation.closest('header')).toBe(brand.closest('header'));
    expect(navigation.querySelector('.sd-action-label')).toBeNull();
    expect(brand.querySelector('img')).toBeNull();
    expect(screen.queryByText('The Sattari Stemdeck')).not.toBeInTheDocument();
    expect(
      within(navigation)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Library', 'Perform', 'Arrange', 'Mix']);
    const workspace = screen.getByRole('main');
    expect(
      within(workspace).queryByRole('region', { name: 'Live input strip' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Session inspector')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Input inspector' }));
    expect(screen.getByLabelText('Session inspector')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Live input strip' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
    expect(screen.getByLabelText('Session inspector')).not.toBeVisible();
    expect(engineMethods.closeMicrophone).not.toHaveBeenCalled();
    expect(engineMethods.pauseAll).not.toHaveBeenCalled();
    const globalPlay = screen.getByRole('button', { name: 'Play all decks' });
    expect(screen.getByRole('link', { name: 'Skip to workspace' })).toHaveAttribute(
      'href',
      '#studio-workspace'
    );
    for (const name of ['Arrange', 'Library', 'Perform']) {
      const button = within(navigation).getByRole('button', { name });
      fireEvent.click(button);
      await waitFor(() => expect(button).toHaveAttribute('aria-current', 'page'));
      expect(workspace).toBeInTheDocument();
      expect(workspace).toHaveAttribute('id', 'studio-workspace');
      expect(workspace).toHaveAttribute('tabindex', '-1');
      expect(globalPlay).toBeInTheDocument();
    }
  });

  it('lets settings restore action text without changing transport or the accessible names', async () => {
    const { container } = render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    const studio = container.querySelector('.sd-studio-next');
    expect(studio).toHaveAttribute('data-compact-icons', 'true');
    expect(screen.getByRole('button', { name: 'Record live set' })).toHaveAttribute(
      'title',
      'Record live set'
    );
    const save = screen.getByRole('button', { name: 'Save project file' });
    expect(save.querySelector('.sd-action-label')).toHaveTextContent('Save project');
    fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
    expect(screen.getByRole('complementary', { name: 'Studio settings' })).toBeInTheDocument();
    const toggle = screen.getByRole('checkbox', { name: 'Compact icons' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(studio).toHaveAttribute('data-compact-icons', 'false');
    expect(localStorage.getItem(COMPACT_ICONS_KEY)).toBe('false');
    expect(save).toHaveAccessibleName('Save project file');
    expect(engineMethods.playAll).not.toHaveBeenCalled();
    expect(engineMethods.startRecording).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(studio).toHaveAttribute('data-compact-icons', 'true');
  });

  it('offers Mic, Input and Track before importing, and exposes live-input disconnect', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    const importClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
      let chooser = within(screen.getByRole('dialog', { name: 'Add source' }));
      for (const name of ['Mic', 'Input', 'Track'])
        expect(chooser.getByRole('button', { name, exact: true })).toBeEnabled();
      expect(importClick).not.toHaveBeenCalled();
      expect(engineMethods.openMicrophone).not.toHaveBeenCalled();
      fireEvent.click(chooser.getByRole('button', { name: 'Track', exact: true }));
      expect(importClick).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Add source' }));
      chooser = within(screen.getByRole('dialog'));
      fireEvent.click(chooser.getByRole('button', { name: 'Mic', exact: true }));
      expect(chooser.getByText(/Use headphones/)).toBeInTheDocument();
      fireEvent.click(chooser.getByRole('button', { name: 'Connect mic' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(engineMethods.openMicrophone).toHaveBeenCalledWith(undefined);
      engineMethods.getInputState.mockReturnValue({
        status: 'connected',
        monitor: false,
        armed: false,
        gainDb: 0,
        highpass: 80,
        channel: -1,
        peak: 0,
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Disconnect', exact: true }));
      expect(engineMethods.closeMicrophone).toHaveBeenCalledTimes(1);
      engineMethods.getInputState.mockReturnValue({
        status: 'disconnected',
        monitor: false,
        armed: false,
        gainDb: 0,
        highpass: 80,
        channel: -1,
        peak: 0,
      });
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Disconnect', exact: true })
        ).not.toBeInTheDocument()
      );
    } finally {
      importClick.mockRestore();
    }
  });

  it('does not overwrite a saved project when restoration fails', async () => {
    storeMethods.loadStudioSession.mockImplementationOnce(() => {
      throw new Error('Damaged saved project');
    });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await waitFor(() => expect(screen.getByText(/Damaged saved project/)).toBeInTheDocument());
    expect(saveStudioSession).not.toHaveBeenCalled();
  });

  it('assigns stable deck identities when an older save has duplicate or foreign IDs', async () => {
    storeMethods.loadStudioSession.mockReturnValue({
      decks: [
        { id: 'foreign', title: 'First' },
        { id: 'foreign', title: 'Second' },
      ],
    });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await waitFor(() => expect(saveStudioSession).toHaveBeenCalled());
    expect(saveStudioSession.mock.lastCall[0].decks.map((deck) => deck.id)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
  });

  it('retains a take for emergency download after quota failure', async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:emergency-take');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    engineMethods.stopRecording.mockResolvedValueOnce(new Blob(['take'], { type: 'audio/mp4' }));
    putAudioAsset.mockRejectedValueOnce(new Error('Quota exceeded'));
    try {
      render(
        <HelmetProvider>
          <MemoryRouter>
            <SattariStudioPage />
          </MemoryRouter>
        </HelmetProvider>
      );
      await waitFor(() => expect(screen.getByLabelText('Record live set')).toBeEnabled());
      fireEvent.click(screen.getByLabelText('Record live set'));
      await waitFor(() =>
        expect(screen.getByLabelText('Stop recording live set')).toBeInTheDocument()
      );
      fireEvent.click(screen.getByLabelText('Stop recording live set'));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Download unsaved take' })).toBeInTheDocument()
      );
      expect(click).toHaveBeenCalledOnce();
      fireEvent.click(screen.getByRole('button', { name: 'Download unsaved take' }));
      expect(click).toHaveBeenCalledTimes(2);
      const closing = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(closing);
      expect(closing.defaultPrevented).toBe(true);
      fireEvent.click(screen.getByLabelText('Record live set'));
      expect(engineMethods.startRecording).toHaveBeenCalledOnce();
    } finally {
      click.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('serializes rapid record clicks and warns before closing an active take', async () => {
    let started;
    engineMethods.startRecording.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          started = resolve;
        })
    );
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    const record = screen.getByRole('button', { name: 'Record live set' });
    await waitFor(() => expect(record).toBeEnabled());
    expect(record.querySelector('.sd-record-glyph .lucide-circle')).toBeInTheDocument();
    expect(record.querySelector('.sd-record-glyph')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(record);
    fireEvent.click(record);
    expect(engineMethods.startRecording).toHaveBeenCalledOnce();
    const pendingClose = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pendingClose);
    expect(pendingClose.defaultPrevented).toBe(true);
    started();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop recording live set' })).toBeInTheDocument()
    );
    const activeClose = new Event('beforeunload', { cancelable: true });
    expect(record.querySelector('.sd-record-glyph .lucide-square')).toBeInTheDocument();
    window.dispatchEvent(activeClose);
    expect(activeClose.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording live set' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Record live set' })).toBeInTheDocument()
    );
  });

  it('saves performance history and source lanes even when master decoding fails', async () => {
    const events = [
      { time: 0, type: 'initialState', args: [{ decks: [] }] },
      { time: 2, type: 'setDeckGain', args: ['A', 50] },
    ];
    engineMethods.capturedPerformance.mockReturnValueOnce(events);
    engineMethods.capturedSources.mockReturnValueOnce({ tracks: [] }).mockReturnValueOnce({
      tracks: [{ id: 'source-lane', name: 'Dry input', clips: [], gain: 100, pan: 0 }],
    });
    engineMethods.stopRecording.mockResolvedValueOnce(new Blob(['take'], { type: 'audio/mp4' }));
    putAudioAsset.mockResolvedValueOnce({ id: 'saved-master', createdAt: 1, size: 4 });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Record live set' })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Record live set' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop recording live set' })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording live set' }));
    await waitFor(() => expect(screen.getByText(/could not decode the take/)).toBeInTheDocument());
    await waitFor(() =>
      expect(saveStudioSession.mock.lastCall[0].arranger.captures).toHaveLength(1)
    );
    const saved = saveStudioSession.mock.lastCall[0].arranger;
    expect(saved.captures[0]).toMatchObject({
      assetId: 'saved-master',
      events,
      originalEvents: events,
      duration: 2,
    });
    expect(saved.tracks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'source-lane', muted: true, offline: true }),
      ])
    );
  });
  it('keeps long-session WAV lanes and events without requiring a compressed master blob', async () => {
    engineMethods.capturedSources.mockReturnValueOnce(null).mockReturnValueOnce({
      id: 'chunks',
      tracks: [
        {
          id: 'master-chunks',
          name: 'Master safety',
          role: 'reference',
          clips: [],
          gain: 100,
          pan: 0,
        },
      ],
    });
    engineMethods.stopRecording.mockResolvedValueOnce(null);
    engineMethods.capturedPerformance.mockReturnValueOnce([
      { time: 0, type: 'initialState', args: [{ decks: [] }] },
    ]);
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    fireEvent.click(screen.getByLabelText('Long-session WAV capture'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Record live set' })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: 'Record live set' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Stop recording live set' })).toBeInTheDocument()
    );
    expect(engineMethods.startRecording).toHaveBeenCalledWith(
      expect.objectContaining({ longSession: true })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stop recording live set' }));
    await waitFor(() =>
      expect(
        screen.getByText(/Performance captured.*master safety audio is preserved/)
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(saveStudioSession.mock.lastCall[0].arranger.captures).toHaveLength(1)
    );
    expect(saveStudioSession.mock.lastCall[0].arranger.tracks[0]).toMatchObject({
      id: 'master-chunks',
      role: 'reference',
      muted: false,
      offline: false,
    });
    expect(putAudioAsset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Open performance in Arrange/ }));
    expect(screen.getByRole('button', { name: 'Arrange', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('region', { name: 'Performance editor' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Build editable source replay' })
    ).toBeInTheDocument();
  });

  it('restores and saves master processing, with independent monitor controls', async () => {
    storeMethods.loadStudioSession.mockReturnValue({
      masterProcessing: {
        low: 3,
        width: 115,
        ceiling: -2,
        inputTrim: -4,
        limiterDrive: 2,
        lowFrequency: 400,
        highFrequency: 5000,
        targetLufs: -18,
        targetPeak: -2,
      },
    });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await waitFor(() => expect(screen.getByText('Local session')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Master inspector' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open master' }));
    expect(screen.getByLabelText('Master low EQ')).toHaveValue('3');
    expect(screen.getByLabelText('Stereo width')).toHaveValue('115');
    expect(screen.getByLabelText('Input trim')).toHaveValue('-4');
    expect(screen.getByLabelText('Pre-limiter trim')).toHaveValue('2');
    expect(screen.getByLabelText('Loudness target')).toHaveValue('-18');
    fireEvent.change(screen.getByLabelText('Master low EQ'), { target: { value: '6' } });
    await waitFor(() =>
      expect(engineMethods.setMasterProcessing).toHaveBeenLastCalledWith(
        expect.objectContaining({ low: 6, width: 115, ceiling: -2 })
      )
    );
    await waitFor(() =>
      expect(saveStudioSession).toHaveBeenLastCalledWith(
        expect.objectContaining({
          masterProcessing: expect.objectContaining({
            low: 6,
            inputTrim: -4,
            limiterDrive: 2,
            lowFrequency: 400,
            highFrequency: 5000,
            targetLufs: -18,
            targetPeak: -2,
          }),
        })
      )
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

    expect(screen.getByRole('heading', { name: 'STEMDECK', level: 1 })).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Add source/i })).toBeInTheDocument();
    expect(screen.getByText('Your next set starts here.')).toBeInTheDocument();
    expect(screen.getByText('Drop a track to begin')).toBeInTheDocument();
    expect(screen.queryByText('Midnight Drive')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play all decks' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Record live set' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Library', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Perform', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Arrange', exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Project key')).toHaveValue('Off');
    expect(screen.getByLabelText('Master output status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Master inspector' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open master' }));
    expect(screen.getByRole('button', { name: 'Restore master defaults' })).toBeInTheDocument();
    expect(screen.getByLabelText('Stereo width')).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'A', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto mix', exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Arrange', exact: true }));
    expect(screen.getByRole('region', { name: 'Multitrack arrangement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add audio track' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export mixdown' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add instrument' })).toBeEnabled();

    await waitFor(() => expect(screen.getByText('Local session')).toBeInTheDocument());
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
          // This visual fixture represents separated stems. Empty lanes must
          // not borrow the full-mix waveform or expose active stem controls.
          lanes: {
            fullMix: { assetId: 'legacy-clip' },
            ...Object.fromEntries(
              ['vocals', 'drums', 'bass', 'music'].map((id) => [id, { status: 'ready' }])
            ),
          },
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

    await waitFor(() => expect(screen.getByText('Local session')).toBeInTheDocument());
    // Waveform detail is an actual display control, not an inert button. Stem
    // ranges retain accessible names even when their visible labels are compact.
    expect(screen.getByRole('button', { name: 'Waveform detail 8' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Waveform detail 16' }));
    expect(screen.getByRole('button', { name: 'Waveform detail 16' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(document.querySelectorAll('.sd-vertical-wave-shape i')).toHaveLength(4 * 48);
    expect(screen.getByRole('slider', { name: 'VOX stem level' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Arrange', exact: true }));
    // Scope editor queries so each lookup does not traverse all 192 unrelated
    // piano-roll buttons. Keep the same assertions and the default timeout.
    const replay = within(screen.getByRole('region', { name: 'Multitrack arrangement' }));
    fireEvent.click(replay.getByRole('button', { name: 'Select clip Browser Session' }));
    expect(replay.getByRole('spinbutton', { name: 'Source offset (s)' })).toHaveValue(2);
    expect(replay.getByRole('spinbutton', { name: 'Duration (s)' })).toHaveValue(24);
    expect(replay.getByText('Clip automation')).toBeInTheDocument();
    fireEvent.click(replay.getByRole('button', { name: 'Delete clip' }));
    expect(
      replay.queryByRole('button', { name: 'Select clip Browser Session' })
    ).not.toBeInTheDocument();
    fireEvent.click(replay.getByRole('button', { name: 'Undo edit' }));
    expect(replay.getByRole('button', { name: 'Select clip Browser Session' })).toBeInTheDocument();
  });

  it('changes tempo without reloading the saved project or losing piano notes', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await waitFor(() => expect(screen.getByText('Local session')).toBeInTheDocument());
    const restoreCount = storeMethods.loadStudioSession.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Arrange', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Add instrument' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add C4 note', exact: true }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Global tempo' }), {
      target: { value: '138' },
    });
    await waitFor(() =>
      expect(saveStudioSession).toHaveBeenLastCalledWith(
        expect.objectContaining({
          masterBpm: 138,
          arranger: expect.objectContaining({
            tracks: [
              expect.objectContaining({
                clips: [
                  expect.objectContaining({
                    notes: [expect.objectContaining({ pitch: 'C4', time: 0 })],
                  }),
                ],
              }),
            ],
          }),
        })
      )
    );
    expect(storeMethods.loadStudioSession).toHaveBeenCalledTimes(restoreCount);
  });

  it('wires library collections and opens the selected deck', async () => {
    storeMethods.loadStudioSession.mockReturnValue({
      decks: [
        { id: 'A', title: 'First track', duration: 30 },
        { id: 'B', title: 'Second track', duration: 30 },
      ],
    });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await screen.findByText('Local session');
    const navigation = within(screen.getByRole('navigation', { name: 'STEMDECK workspaces' }));
    fireEvent.click(navigation.getByRole('button', { name: 'Library', exact: true }));
    expect(screen.queryByRole('region', { name: 'Master output status' })).not.toBeInTheDocument();
    const summary = screen.getByText('Current session audio & recordings');
    const sessionAudio = within(summary.closest('details'));
    fireEvent.click(summary);
    fireEvent.click(sessionAudio.getByRole('button', { name: /Stem lanes/ }));
    expect(screen.getByText('No separated stems loaded')).toBeInTheDocument();
    expect(sessionAudio.queryByRole('button', { name: /Second track/ })).not.toBeInTheDocument();
    fireEvent.click(sessionAudio.getByRole('button', { name: /Recordings/ }));
    expect(screen.getByText('No recordings yet')).toBeInTheDocument();
    fireEvent.click(sessionAudio.getByRole('button', { name: /Session audio/ }));
    fireEvent.click(sessionAudio.getByRole('button', { name: /Second track/ }));
    expect(screen.getByRole('article', { name: 'Deck B' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Master output status' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Master inspector' })).toBeVisible();
    expect(navigation.getByRole('button', { name: 'Perform', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('commits bounded deck BPM and offers keyboard waveform seeking', async () => {
    storeMethods.loadStudioSession.mockReturnValue({
      decks: [{ id: 'A', title: 'Test track', duration: 30, bpm: 124 }],
    });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await screen.findByText('Local session');
    const bpm = screen.getByRole('spinbutton', { name: 'Deck A BPM' });
    fireEvent.change(bpm, { target: { value: '135.5' } });
    fireEvent.blur(bpm);
    expect(bpm).toHaveValue(135.5);
    fireEvent.change(bpm, { target: { value: '999' } });
    fireEvent.keyDown(bpm, { key: 'Enter' });
    expect(bpm).toHaveValue(240);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Seek Deck A' }), { key: 'ArrowRight' });
    expect(engineMethods.seekDeck).toHaveBeenLastCalledWith('A', 5);
    fireEvent.click(screen.getByRole('button', { name: 'Arrange', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Snap 1/16' }));
    expect(screen.getByRole('button', { name: 'Snap 1/16' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('reports playback failure without showing a false playing state', async () => {
    storeMethods.loadStudioSession.mockReturnValue({
      decks: [{ id: 'A', title: 'Test track', duration: 30 }],
    });
    engineMethods.playDeck.mockRejectedValueOnce(new Error('Audio output unavailable'));
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await screen.findByText('Local session');
    fireEvent.click(screen.getByRole('button', { name: 'Play Deck A' }));
    await screen.findByText('Audio output unavailable');
    expect(screen.getByRole('button', { name: 'Play Deck A' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Play all decks' }));
    await screen.findByText('Load a track before starting playback.');
    expect(screen.queryByRole('button', { name: 'Pause all decks' })).not.toBeInTheDocument();
  });

  it('routes the header transport and import to the arrangement without requiring decks', async () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await screen.findByText('Local session');
    fireEvent.click(screen.getByRole('button', { name: 'Arrange', exact: true }));
    expect(screen.getByRole('button', { name: 'Play arrangement transport' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add instrument' }));
    expect(screen.getByRole('button', { name: 'Play arrangement transport' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Play arrangement transport' }));
    await waitFor(() => expect(engineMethods.unlock).toHaveBeenCalled());
    await screen.findByText('No clips after the playhead.');
    const inputs = [];
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () {
      inputs.push(this);
    });
    try {
      const imports = screen.getAllByRole('button', { name: 'Import audio', exact: true });
      fireEvent.click(imports[0]);
      fireEvent.click(imports[1]);
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toBe(inputs[1]);
    } finally {
      picker.mockRestore();
    }
  });

  it('adds independent arrangement tracks without replacing occupied decks', async () => {
    storeMethods.loadStudioSession.mockReturnValue({
      decks: ['A', 'B', 'C', 'D'].map((id) => ({ id, title: `Track ${id}`, duration: 30 })),
    });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    await screen.findByText('Local session');
    fireEvent.click(screen.getByRole('button', { name: 'Arrange', exact: true }));
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Add audio track', exact: true }));
      expect(picker).not.toHaveBeenCalled();
      expect(screen.getByRole('textbox', { name: 'Track name Audio track' })).toBeInTheDocument();
      await waitFor(() =>
        expect(saveStudioSession).toHaveBeenLastCalledWith(
          expect.objectContaining({
            decks: expect.arrayContaining(
              ['A', 'B', 'C', 'D'].map((id) =>
                expect.objectContaining({ id, title: `Track ${id}` })
              )
            ),
            arranger: expect.objectContaining({
              tracks: [expect.objectContaining({ name: 'Audio track' })],
            }),
          })
        )
      );
      fireEvent.click(screen.getByRole('button', { name: 'Mix', exact: true }));
      const mix = within(screen.getByRole('region', { name: 'Arrangement track mixer' }));
      fireEvent.change(mix.getByRole('slider', { name: 'Audio track gain' }), {
        target: { value: '145' },
      });
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.tracks[0].gain).toBe(145)
      );
      fireEvent.click(screen.getByRole('button', { name: 'Arrange', exact: true }));
      fireEvent.click(screen.getByText('Editing & export'));
      fireEvent.click(screen.getByRole('button', { name: 'Undo edit' }));
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.tracks[0].gain).toBe(100)
      );
    } finally {
      picker.mockRestore();
    }
  });
});
