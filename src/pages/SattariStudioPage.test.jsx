/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Render and handle probes. The wrapped components delegate to the real ones,
// so every other test exercises unchanged behavior.
const probes = vi.hoisted(() => ({
  pageRenders: 0,
  editorRenders: 0,
  libraryRenders: 0,
  editorCalls: [],
}));

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
  triggerPad: vi.fn(async () => {}),
  setTempoFollow: vi.fn(),
  stopAll: vi.fn(),
  setDeckSend: vi.fn(() => true),
  setDeckCue: vi.fn(() => true),
  setDeckInserts: vi.fn(() => true),
  setReturn: vi.fn(() => true),
  // A stereo output: Outputs 3-4 falls back to off, as the real router does.
  setCue: vi.fn((settings) => (settings.mode === 'multichannel' ? 'off' : settings.mode)),
  getOutputCapabilities: vi.fn(() => ({
    maxChannelCount: 2,
    multichannel: false,
    sinkSelectable: false,
    sinkId: '',
  })),
  setMetering: vi.fn(),
  getChannelMeters: vi.fn(() => ({
    decks: {},
    tracks: {},
    returns: {},
    master: { peakDb: -12, rmsDb: -18, clip: false, reductionDb: 0 },
  })),
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

// A take's length comes from its container, which fake recordings lack.
vi.mock('../utils/windowedSource', async (original) => ({
  ...(await original()),
  sourceDuration: vi.fn(async () => {
    throw new Error('No decoder in tests.');
  }),
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

// The page root renders <SEO> with fresh props on every render, so SEO renders
// exactly when the page root does.
vi.mock('../utils/seo', async (importOriginal) => {
  const { createElement } = await import('react');
  const actual = await importOriginal();
  return {
    ...actual,
    SEO: (props) => {
      probes.pageRenders += 1;
      return createElement(actual.SEO, props);
    },
  };
});

// Records every imperative call the page makes on the editor, then forwards it.
// The probe keeps the editor's own memo boundary (and comparator) outside its
// Profiler, so the count is the editor's real render count.
vi.mock('../components/studio/ArrangementEditor', async (importOriginal) => {
  const { Profiler, createElement, forwardRef, memo, useImperativeHandle, useRef } =
    await import('react');
  const Actual = (await importOriginal()).default;
  const memoized = Actual.$$typeof === Symbol.for('react.memo');
  const Editor = memoized ? Actual.type : Actual;
  const ArrangementEditorProbe = forwardRef(function ArrangementEditorProbe(props, ref) {
    const inner = useRef(null);
    useImperativeHandle(
      ref,
      () =>
        new Proxy(
          {},
          {
            get:
              (_, method) =>
              (...args) => {
                probes.editorCalls.push([method, ...args]);
                return inner.current?.[method]?.(...args);
              },
          }
        ),
      []
    );
    return createElement(
      Profiler,
      {
        id: 'arrangement-editor',
        onRender: () => {
          probes.editorRenders += 1;
        },
      },
      createElement(Editor, { ...props, ref: inner })
    );
  });
  return {
    default: memoized ? memo(ArrangementEditorProbe, Actual.compare) : ArrangementEditorProbe,
  };
});

// Same memo boundary as the real library, so the count is its real render count.
vi.mock('../components/studio/MusicLibrary', async (importOriginal) => {
  const { Profiler, createElement, memo } = await import('react');
  const Actual = (await importOriginal()).default;
  return {
    default: memo(function MusicLibraryProbe(props) {
      return createElement(
        Profiler,
        {
          id: 'music-library',
          onRender: () => {
            probes.libraryRenders += 1;
          },
        },
        createElement(Actual, props)
      );
    }),
  };
});

import SattariStudioPage from './SattariStudioPage';
import { saveStudioSession, putAudioAsset } from '../utils/audioProjectStore';
import { audioClip, audioTrack, emptyArrangement } from '../utils/arrangementModel';
import { COMPACT_ICONS_KEY } from '../utils/studioDisplay';
import { MIXER_DOCK_KEY } from '../studio/mixer/useMixerDock';
import { HEADPHONES_KEY } from '../studio/mixer/useHeadphones';

// The full studio renders hundreds of buttons; a whole-document role query
// computes every one's accessible name. Queries are scoped to the owning group.
const scoped = (role, name) => within(screen.getByRole(role, { name }));
const sessionActions = () => scoped('group', 'Session actions');
const globalTransport = () => scoped('group', 'Global transport');
const workspaces = () => scoped('navigation', 'STEMDECK workspaces');
const arrangeActions = () => scoped('group', 'Arrangement actions');
const editTools = () => scoped('group', 'Editing and export tools');
const deckCard = (id) => scoped('article', `Deck ${id}`);
const inspectorPanel = () => within(screen.getByLabelText('Session inspector'));

describe('SattariStudioPage', () => {
  beforeEach(() => {
    localStorage.removeItem(COMPACT_ICONS_KEY);
    // The mixer dock and headphone cue are device preferences kept in storage.
    localStorage.removeItem(MIXER_DOCK_KEY);
    localStorage.removeItem(HEADPHONES_KEY);
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
    Object.assign(probes, { pageRenders: 0, editorRenders: 0, libraryRenders: 0, editorCalls: [] });
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
    ).toEqual(['Library', 'Perform', 'Arrange', 'Mixer']);
    const workspace = screen.getByRole('region', { name: 'Studio workspace' });
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(
      within(workspace).queryByRole('region', { name: 'Live input strip' })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Session inspector')).not.toBeVisible();
    fireEvent.click(sessionActions().getByRole('button', { name: 'Input inspector' }));
    expect(screen.getByLabelText('Session inspector')).toBeVisible();
    expect(screen.getByRole('region', { name: 'Live input strip' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close inspector' }));
    expect(screen.getByLabelText('Session inspector')).not.toBeVisible();
    expect(engineMethods.closeMicrophone).not.toHaveBeenCalled();
    expect(engineMethods.pauseAll).not.toHaveBeenCalled();
    const globalPlay = globalTransport().getByRole('button', { name: 'Play all decks' });
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
    await screen.findByText('Local session');
    const studio = container.querySelector('.sd-studio-next');
    expect(studio).toHaveAttribute('data-compact-icons', 'true');
    expect(sessionActions().getByRole('button', { name: 'Record live set' })).toHaveAttribute(
      'title',
      'Record live set'
    );
    const save = screen.getByRole('button', { name: 'Save project file' });
    expect(save.querySelector('.sd-action-label')).toHaveTextContent('Save project');
    fireEvent.click(sessionActions().getByRole('button', { name: 'Settings', exact: true }));
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

  it('opens a saved project with a damaged clip, setting only that clip aside', async () => {
    const good = { ...audioClip('verse-audio', 'Verse', 8), id: 'clip-verse' };
    const bad = { ...audioClip('chorus-audio', 'Chorus', 8), id: 'clip-chorus', gain: -5 };
    storeMethods.loadStudioSession.mockReturnValue({
      decks: [],
      arranger: {
        ...emptyArrangement(),
        tracks: [{ ...audioTrack('Vocals'), clips: [good, bad] }],
      },
    });
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariStudioPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(
      await screen.findByText(/1 damaged arrangement part was set aside so the project could open/)
    ).toBeInTheDocument();
    await waitFor(() => expect(saveStudioSession).toHaveBeenCalled());
    const saved = saveStudioSession.mock.lastCall[0].arranger;
    expect(saved.tracks[0].clips.map((clip) => clip.id)).toEqual(['clip-verse']);
    expect(saved.setAside).toEqual([{ kind: 'clip', name: 'Chorus', track: 'Vocals', part: bad }]);
    fireEvent.click(sessionActions().getByRole('button', { name: /^tools$/i }));
    fireEvent.click(
      within(document.querySelector('.sd-advanced-strip')).getByRole('button', { name: /files/i })
    );
    const panel = scoped('region', 'Damaged arrangement parts');
    expect(panel.getByText(/Chorus \(Vocals\)/)).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Download as file' })).toBeInTheDocument();
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

  it('keeps the Studio open during a take when Back or a site link is used', async () => {
    let pathname;
    function Where() {
      pathname = useLocation().pathname;
      return null;
    }
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/studio']}>
          <SattariStudioPage />
          <Where />
        </MemoryRouter>
      </HelmetProvider>
    );
    const record = sessionActions().getByRole('button', { name: 'Record live set' });
    await waitFor(() => expect(record).toBeEnabled());
    fireEvent.click(record);
    await waitFor(() =>
      expect(
        sessionActions().getByRole('button', { name: 'Stop recording live set' })
      ).toBeInTheDocument()
    );
    expect(window.history.state?.stemdeckCaptureGuard).toBe(true);
    // Back pops the guard entry; the Studio puts it back and explains.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(window.history.state?.stemdeckCaptureGuard).toBe(true);
    expect(
      await screen.findByText('Recording in progress. Finish the take before leaving the Studio.')
    ).toBeInTheDocument();
    // A link to another page of the site is held as well.
    fireEvent.click(screen.getAllByRole('link', { name: 'Music guides' })[0]);
    expect(pathname).toBe('/studio');
    fireEvent.click(sessionActions().getByRole('button', { name: 'Stop recording live set' }));
    await waitFor(() =>
      expect(sessionActions().getByRole('button', { name: 'Record live set' })).toBeInTheDocument()
    );
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
    const record = sessionActions().getByRole('button', { name: 'Record live set' });
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
      expect(
        sessionActions().getByRole('button', { name: 'Stop recording live set' })
      ).toBeInTheDocument()
    );
    const activeClose = new Event('beforeunload', { cancelable: true });
    expect(record.querySelector('.sd-record-glyph .lucide-square')).toBeInTheDocument();
    window.dispatchEvent(activeClose);
    expect(activeClose.defaultPrevented).toBe(true);
    fireEvent.click(sessionActions().getByRole('button', { name: 'Stop recording live set' }));
    await waitFor(() =>
      expect(sessionActions().getByRole('button', { name: 'Record live set' })).toBeInTheDocument()
    );
  });

  it('saves performance history and source lanes even when master decoding fails', async () => {
    const events = [
      { time: 0, type: 'initialState', args: [{ decks: [] }] },
      { time: 2, type: 'setDeckGain', args: ['A', 50] },
    ];
    engineMethods.capturedPerformance.mockReturnValueOnce(events);
    engineMethods.capturedSources.mockReturnValueOnce({ tracks: [] }).mockReturnValueOnce({
      tracks: [{ ...audioTrack('Dry input'), id: 'source-lane' }],
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
      expect(sessionActions().getByRole('button', { name: 'Record live set' })).toBeEnabled()
    );
    fireEvent.click(sessionActions().getByRole('button', { name: 'Record live set' }));
    await waitFor(() =>
      expect(
        sessionActions().getByRole('button', { name: 'Stop recording live set' })
      ).toBeInTheDocument()
    );
    fireEvent.click(sessionActions().getByRole('button', { name: 'Stop recording live set' }));
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
      tracks: [{ ...audioTrack('Master safety'), id: 'master-chunks', role: 'reference' }],
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
      expect(sessionActions().getByRole('button', { name: 'Record live set' })).toBeEnabled()
    );
    fireEvent.click(sessionActions().getByRole('button', { name: 'Record live set' }));
    await waitFor(() =>
      expect(
        sessionActions().getByRole('button', { name: 'Stop recording live set' })
      ).toBeInTheDocument()
    );
    expect(engineMethods.startRecording).toHaveBeenCalledWith(
      expect.objectContaining({ longSession: true })
    );
    fireEvent.click(sessionActions().getByRole('button', { name: 'Stop recording live set' }));
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
    expect(workspaces().getByRole('button', { name: 'Arrange', exact: true })).toHaveAttribute(
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
    fireEvent.click(sessionActions().getByRole('button', { name: 'Master inspector' }));
    fireEvent.click(inspectorPanel().getByRole('button', { name: 'Open master' }));
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
    fireEvent.click(inspectorPanel().getByRole('button', { name: 'Mute speakers' }));
    expect(engineMethods.setMasterMonitor).toHaveBeenLastCalledWith({
      mono: false,
      dimmed: false,
      muted: true,
    });
    fireEvent.click(inspectorPanel().getByRole('button', { name: 'Mono audition' }));
    expect(engineMethods.setMasterMonitor).toHaveBeenLastCalledWith({
      mono: true,
      dimmed: false,
      muted: true,
    });
    fireEvent.click(inspectorPanel().getByRole('button', { name: 'Audition neutral' }));
    expect(screen.getByLabelText('Master low EQ')).toBeDisabled();
    fireEvent.click(inspectorPanel().getByRole('button', { name: 'Restore master defaults' }));
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
    expect(globalTransport().getByRole('button', { name: 'Play all decks' })).toBeDisabled();
    expect(sessionActions().getByRole('button', { name: 'Record live set' })).toBeInTheDocument();
    expect(workspaces().getByRole('button', { name: 'Library', exact: true })).toBeInTheDocument();
    expect(workspaces().getByRole('button', { name: 'Perform', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(workspaces().getByRole('button', { name: 'Arrange', exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Project key')).toHaveValue('Off');
    expect(screen.getByLabelText('Master output status')).toBeInTheDocument();
    fireEvent.click(sessionActions().getByRole('button', { name: 'Master inspector' }));
    fireEvent.click(inspectorPanel().getByRole('button', { name: 'Open master' }));
    expect(
      inspectorPanel().getByRole('button', { name: 'Restore master defaults' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Stereo width')).toHaveValue('100');
    expect(screen.getByRole('button', { name: 'A', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto mix', exact: true })).toBeInTheDocument();

    fireEvent.click(workspaces().getByRole('button', { name: 'Arrange', exact: true }));
    expect(screen.getByRole('region', { name: 'Multitrack arrangement' })).toBeInTheDocument();
    expect(arrangeActions().getByRole('button', { name: 'Add audio track' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export mixdown' })).toBeDisabled();
    expect(arrangeActions().getByRole('button', { name: 'Add instrument' })).toBeEnabled();

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
    expect(deckCard('A').getByRole('button', { name: 'Waveform detail 8' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(deckCard('A').getByRole('button', { name: 'Waveform detail 16' }));
    expect(deckCard('A').getByRole('button', { name: 'Waveform detail 16' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(document.querySelectorAll('.sd-vertical-wave-shape i')).toHaveLength(4 * 48);
    expect(screen.getByRole('slider', { name: 'VOX stem level' })).toBeInTheDocument();
    fireEvent.click(workspaces().getByRole('button', { name: 'Arrange', exact: true }));
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
    fireEvent.click(workspaces().getByRole('button', { name: 'Arrange', exact: true }));
    fireEvent.click(arrangeActions().getByRole('button', { name: 'Add instrument' }));
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
    expect(sessionActions().getByRole('button', { name: 'Master inspector' })).toBeVisible();
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
    fireEvent.keyDown(deckCard('A').getByRole('button', { name: 'Seek Deck A' }), {
      key: 'ArrowRight',
    });
    expect(engineMethods.seekDeck).toHaveBeenLastCalledWith('A', 5);
    // The seek settles asynchronously and reports the deck ready.
    await screen.findAllByText('Deck A ready.');
    fireEvent.click(workspaces().getByRole('button', { name: 'Arrange', exact: true }));
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
    fireEvent.click(deckCard('A').getByRole('button', { name: 'Play Deck A' }));
    await screen.findByText('Audio output unavailable');
    expect(deckCard('A').getByRole('button', { name: 'Play Deck A' })).toBeInTheDocument();
    fireEvent.click(globalTransport().getByRole('button', { name: 'Play all decks' }));
    await screen.findByText('Load a track before starting playback.');
    expect(
      globalTransport().queryByRole('button', { name: 'Pause all decks' })
    ).not.toBeInTheDocument();
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
    fireEvent.click(workspaces().getByRole('button', { name: 'Arrange', exact: true }));
    expect(
      globalTransport().getByRole('button', { name: 'Play arrangement transport' })
    ).toBeDisabled();
    fireEvent.click(arrangeActions().getByRole('button', { name: 'Add instrument' }));
    expect(
      globalTransport().getByRole('button', { name: 'Play arrangement transport' })
    ).toBeEnabled();
    fireEvent.click(globalTransport().getByRole('button', { name: 'Play arrangement transport' }));
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
    fireEvent.click(workspaces().getByRole('button', { name: 'Arrange', exact: true }));
    const picker = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    try {
      fireEvent.click(
        arrangeActions().getByRole('button', { name: 'Add audio track', exact: true })
      );
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
      fireEvent.click(screen.getByRole('button', { name: 'Mixer', exact: true }));
      const mix = within(screen.getByRole('group', { name: 'Tracks' }));
      fireEvent.change(mix.getByRole('slider', { name: 'Audio track gain' }), {
        target: { value: '145' },
      });
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.tracks[0].gain).toBe(145)
      );
      fireEvent.click(workspaces().getByRole('button', { name: 'Arrange', exact: true }));
      fireEvent.click(screen.getByText('Editing & export'));
      fireEvent.click(editTools().getByRole('button', { name: 'Undo edit' }));
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.tracks[0].gain).toBe(100)
      );
    } finally {
      picker.mockRestore();
    }
  });

  describe('render isolation and editor integration', () => {
    const renderStudio = async () => {
      render(
        <HelmetProvider>
          <MemoryRouter>
            <SattariStudioPage />
          </MemoryRouter>
        </HelmetProvider>
      );
      await screen.findByText('Local session');
    };
    const view = (name) =>
      fireEvent.click(
        within(screen.getByRole('navigation', { name: 'STEMDECK workspaces' })).getByRole(
          'button',
          { name, exact: true }
        )
      );
    const openMixer = () =>
      fireEvent.click(
        within(screen.getByRole('navigation', { name: 'STEMDECK workspaces' })).getByRole(
          'button',
          { name: 'Mixer', exact: true }
        )
      );
    const editorCalls = (...methods) =>
      probes.editorCalls.filter(([method]) => methods.includes(method));
    const trackCount = (count) => screen.getByText(`${count} tracks · 120 BPM · 4/4`);

    // Animation frames run only when a test advances them.
    const controlFrames = () => {
      const frames = new Map();
      let nextId = 1;
      let clock = 0;
      const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.set(nextId, callback);
        return nextId++;
      });
      const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
        frames.delete(id);
      });
      return {
        advance(milliseconds = 60) {
          act(() => {
            clock += milliseconds;
            const due = [...frames.values()];
            frames.clear();
            due.forEach((callback) => callback(clock));
          });
        },
        restore() {
          request.mockRestore();
          cancel.mockRestore();
        },
      };
    };

    const playDeckA = async () => {
      storeMethods.loadStudioSession.mockReturnValue({
        decks: [{ id: 'A', title: 'Loop', duration: 30, bpm: 120 }],
      });
      engineMethods.playDeck.mockResolvedValueOnce(true);
      await renderStudio();
      fireEvent.click(deckCard('A').getByRole('button', { name: 'Play Deck A' }));
      await deckCard('A').findByRole('button', { name: 'Pause Deck A' });
    };

    it('updates playheads and meters on transport ticks without re-rendering the page, editor or library', async () => {
      const frames = controlFrames();
      let position = 0;
      engineMethods.getDeckPosition.mockImplementation((id) => (id === 'A' ? position : 0));
      engineMethods.getDeckMeterLevel.mockImplementation((id) => (id === 'A' ? 0.5 : 0));
      try {
        await playDeckA();
        const deckA = screen.getByRole('article', { name: 'Deck A' });
        const baseline = { page: probes.pageRenders, editor: probes.editorRenders };
        for (const seconds of [3, 6, 9]) {
          position = seconds;
          frames.advance();
        }
        expect(probes.pageRenders).toBe(baseline.page);
        expect(probes.editorRenders).toBe(baseline.editor);
        // The displays that subscribe to the transport did update: 9 s of 30 s,
        // and a half-scale meter lights 5 of its 9 segments.
        expect(deckA.querySelector('.sd-wave-playhead')).toHaveStyle({ left: '30%' });
        expect(deckA.querySelectorAll('.sd-segment-meter i.is-lit')).toHaveLength(5);

        view('Library');
        await screen.findByText('Music library storage is unavailable in this browser.');
        await act(async () => {});
        const library = { page: probes.pageRenders, library: probes.libraryRenders };
        const sampled = engineMethods.getDeckPosition.mock.calls.length;
        for (const seconds of [12, 15]) {
          position = seconds;
          frames.advance();
        }
        expect(engineMethods.getDeckPosition.mock.calls.length).toBeGreaterThan(sampled);
        expect(probes.libraryRenders).toBe(library.library);
        expect(probes.pageRenders).toBe(library.page);
      } finally {
        frames.restore();
        engineMethods.getDeckPosition.mockImplementation(() => 0);
        engineMethods.getDeckMeterLevel.mockImplementation(() => 0);
      }
    });

    it('keeps one transport loop and its throttle across deck changes', async () => {
      const frames = controlFrames();
      try {
        await playDeckA();
        frames.advance();
        const sampled = engineMethods.getDeckPosition.mock.calls.length;
        fireEvent.change(screen.getByRole('slider', { name: 'VOL' }), { target: { value: '70' } });
        fireEvent.change(screen.getByRole('slider', { name: 'LOW' }), { target: { value: '40' } });
        expect(engineMethods.setDeckGain).toHaveBeenLastCalledWith('A', 70);
        // 10 ms after the last sample the loop is still throttled; a loop
        // restarted by the deck change would have sampled immediately.
        frames.advance(10);
        expect(engineMethods.getDeckPosition.mock.calls.length).toBe(sampled);
        // A single loop samples each of the four decks once per tick.
        frames.advance(50);
        expect(engineMethods.getDeckPosition.mock.calls.length).toBe(sampled + 4);
      } finally {
        frames.restore();
      }
    });

    it('leaves the master deck rate to the engine tempo follower when decks change', async () => {
      const beats = [0, 0.5, 1.01, 1.5];
      storeMethods.loadStudioSession.mockReturnValue({
        decks: [
          {
            id: 'A',
            title: 'Live drummer',
            duration: 30,
            bpm: 120,
            synced: true,
            followTempoMap: true,
            analysis: { tempoMap: { beats, confidence: 0.9 } },
          },
          { id: 'B', title: 'Loop', duration: 30, bpm: 100 },
        ],
      });
      await renderStudio();
      expect(engineMethods.setTempoFollow).toHaveBeenLastCalledWith('D', null, 120);
      expect(engineMethods.setTempoFollow).toHaveBeenCalledWith('A', beats, 120);
      engineMethods.setPlaybackRate.mockClear();
      const deckA = within(screen.getByRole('article', { name: 'Deck A' }));
      fireEvent.change(deckA.getByRole('slider', { name: 'VOL' }), { target: { value: '70' } });
      await waitFor(() => expect(engineMethods.setPlaybackRate).toHaveBeenCalledWith('B', 1));
      expect(engineMethods.setPlaybackRate).not.toHaveBeenCalledWith('A', expect.anything());
      expect(engineMethods.setTempoFollow).toHaveBeenLastCalledWith('D', null, 120);
      expect(engineMethods.setTempoFollow).toHaveBeenCalledWith('A', beats, 120);
    });

    // Adds a track, drags its gain fader and nudges its pan with the keyboard.
    const mixTrackGestures = async () => {
      await renderStudio();
      view('Arrange');
      fireEvent.click(
        arrangeActions().getByRole('button', { name: 'Add audio track', exact: true })
      );
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.tracks).toHaveLength(1)
      );
      const trackId = saveStudioSession.mock.lastCall[0].arranger.tracks[0].id;
      openMixer();
      const mix = within(screen.getByRole('group', { name: 'Tracks' }));
      const gain = mix.getByRole('slider', { name: 'Audio track gain' });
      probes.editorCalls = [];
      fireEvent.pointerDown(gain, { pointerId: 1 });
      for (const value of ['110', '125', '145']) fireEvent.change(gain, { target: { value } });
      fireEvent.pointerUp(gain, { pointerId: 1 });
      fireEvent.blur(gain);
      const drag = editorCalls('updateTrack', 'commitLiveEdit');
      probes.editorCalls = [];
      const pan = mix.getByRole('slider', { name: 'Audio track pan' });
      fireEvent.keyDown(pan, { key: 'ArrowRight' });
      fireEvent.change(pan, { target: { value: '0.25' } });
      fireEvent.change(pan, { target: { value: '0.5' } });
      fireEvent.keyUp(pan, { key: 'ArrowRight' });
      const nudge = editorCalls('updateTrack', 'commitLiveEdit');
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.tracks[0]).toMatchObject({
          gain: 145,
          pan: 0.5,
        })
      );
      return { trackId, drag, nudge };
    };

    it('sends mixer fader gestures as live updates followed by exactly one commitLiveEdit', async () => {
      const { trackId, drag, nudge } = await mixTrackGestures();
      expect(drag).toEqual([
        ['updateTrack', trackId, { gain: 110 }, { live: true }],
        ['updateTrack', trackId, { gain: 125 }, { live: true }],
        ['updateTrack', trackId, { gain: 145 }, { live: true }],
        ['commitLiveEdit'],
      ]);
      // A key press is one gesture too, however many change events it produces.
      expect(nudge).toEqual([
        ['updateTrack', trackId, { pan: 0.25 }, { live: true }],
        ['updateTrack', trackId, { pan: 0.5 }, { live: true }],
        ['commitLiveEdit'],
      ]);
    });

    // Integration with the arrangement editor's live-edit history contract.
    it('undoes each mixer gesture as one step', async () => {
      await mixTrackGestures();
      view('Arrange');
      fireEvent.click(screen.getByText('Editing & export'));
      fireEvent.click(editTools().getByRole('button', { name: 'Undo edit' }));
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.tracks[0]).toMatchObject({
          gain: 145,
          pan: 0,
        })
      );
      fireEvent.click(editTools().getByRole('button', { name: 'Undo edit' }));
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.tracks[0].gain).toBe(100)
      );
    });

    it('redoes with Ctrl+Shift+Z when Shift reports an uppercase key', async () => {
      await renderStudio();
      view('Arrange');
      fireEvent.click(arrangeActions().getByRole('button', { name: 'Add instrument' }));
      expect(trackCount(1)).toBeInTheDocument();
      fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
      expect(trackCount(0)).toBeInTheDocument();
      fireEvent.keyDown(document.body, { key: 'Z', ctrlKey: true, shiftKey: true });
      expect(trackCount(1)).toBeInTheDocument();
      expect(editorCalls('undo')).toEqual([
        ['undo', false],
        ['undo', true],
      ]);
    });

    it('starts a new session without leaking crossfader, master assist or XY pad state', async () => {
      storeMethods.loadStudioSession.mockReturnValue({
        uiSchemaVersion: 2,
        crossfaderCurve: 'Sharp',
        crossfaderReverse: true,
        aiMasterMode: 'Club -9',
      });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
      try {
        await renderStudio();
        openMixer();
        const curve = screen.getByRole('combobox', { name: 'Crossfader curve' });
        const reverse = screen.getByRole('button', { name: 'REV' });
        const assist = screen.getByRole('combobox', { name: 'Master assist target' });
        const pad = screen.getByRole('button', { name: 'Global effects XY pad' });
        expect(curve).toHaveValue('Sharp');
        expect(reverse).toHaveClass('is-active');
        expect(assist).toHaveValue('Club -9');
        pad.setPointerCapture = vi.fn();
        pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
        fireEvent.pointerDown(pad, { pointerId: 1, clientX: 150, clientY: 20 });
        expect(pad.querySelector('i')).toHaveStyle({ left: '75%', top: '20%' });

        fireEvent.click(sessionActions().getByRole('button', { name: 'Tools' }));
        fireEvent.click(screen.getByRole('button', { name: 'NEW PROJECT' }));
        await screen.findByText('New Sattari Stemdeck session ready.');
        expect(curve).toHaveValue('Smooth');
        expect(reverse).not.toHaveClass('is-active');
        expect(assist).toHaveValue('Streaming -14');
        expect(pad.querySelector('i')).toHaveStyle({ left: '28%', top: '44%' });
        expect(engineMethods.setCrossfaderCurve).toHaveBeenLastCalledWith('Smooth');
        expect(engineMethods.setCrossfader).toHaveBeenLastCalledWith(50);
        expect(engineMethods.setMasterAssist).toHaveBeenLastCalledWith(false, 'Streaming -14');
        await waitFor(() =>
          expect(saveStudioSession).toHaveBeenLastCalledWith(
            expect.objectContaining({
              crossfaderCurve: 'Smooth',
              crossfaderReverse: false,
              aiMasterMode: 'Streaming -14',
            })
          )
        );
      } finally {
        confirm.mockRestore();
      }
    });

    it('binds the global keyboard listener once and dispatches to the latest handlers', async () => {
      const added = vi.spyOn(window, 'addEventListener');
      const removed = vi.spyOn(window, 'removeEventListener');
      const keydown = (spy) => spy.mock.calls.filter(([type]) => type === 'keydown');
      try {
        storeMethods.loadStudioSession.mockReturnValue({
          decks: [{ id: 'A', title: 'Loop', duration: 30 }],
        });
        await renderStudio();
        fireEvent.change(screen.getByRole('slider', { name: 'Performance crossfader' }), {
          target: { value: '20' },
        });
        fireEvent.change(screen.getByRole('spinbutton', { name: 'Global tempo' }), {
          target: { value: '128' },
        });
        fireEvent.keyDown(document.body, { key: '3' });
        expect(engineMethods.triggerPad).toHaveBeenLastCalledWith(2, 420);
        fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
        await waitFor(() => expect(engineMethods.playAll).toHaveBeenCalledOnce());
        view('Arrange');
        fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
        expect(editorCalls('toggle')).toHaveLength(1);
        expect(engineMethods.playAll).toHaveBeenCalledOnce();
        expect(keydown(added)).toHaveLength(1);
        expect(keydown(removed)).toHaveLength(0);
        // The editor's toggle settles asynchronously; let it finish inside act().
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      } finally {
        added.mockRestore();
        removed.mockRestore();
      }
    });

    // Records a long-session take after an unrelated instrument edit.
    const recordTakeAfterEdit = async () => {
      engineMethods.stopRecording.mockResolvedValueOnce(null);
      engineMethods.capturedSources.mockReturnValueOnce(null).mockReturnValueOnce({
        id: 'chunks',
        tracks: [
          {
            id: 'master-chunks',
            name: 'Master safety',
            kind: 'audio',
            role: 'reference',
            clips: [],
            gain: 100,
            pan: 0,
            muted: false,
            solo: false,
          },
        ],
      });
      engineMethods.capturedPerformance.mockReturnValueOnce([
        { time: 0, type: 'initialState', args: [{ decks: [] }] },
      ]);
      await renderStudio();
      view('Arrange');
      fireEvent.click(arrangeActions().getByRole('button', { name: 'Add instrument' }));
      fireEvent.click(sessionActions().getByRole('button', { name: 'Record live set' }));
      fireEvent.click(
        await sessionActions().findByRole('button', { name: 'Stop recording live set' })
      );
      await screen.findByText(/Performance captured/);
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger).toMatchObject({
          captures: [expect.objectContaining({ sourceCaptureId: 'chunks' })],
          tracks: [
            expect.objectContaining({ kind: 'midi' }),
            expect.objectContaining({ id: 'master-chunks', muted: true, offline: true }),
          ],
        })
      );
    };

    it('adds a finished take to the arrangement through applyEdit', async () => {
      await recordTakeAfterEdit();
      const edits = editorCalls('applyEdit');
      expect(edits).toHaveLength(1);
      expect(edits[0][1]).toEqual(expect.any(Function));
    });

    // Integration with the arrangement editor's applyEdit contract.
    it('keeps earlier undo history when a take finishes, undoing the take in one step', async () => {
      await recordTakeAfterEdit();
      expect(trackCount(2)).toBeInTheDocument();
      fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
      expect(trackCount(1)).toBeInTheDocument();
      await waitFor(() =>
        expect(saveStudioSession.mock.lastCall[0].arranger.captures).toHaveLength(0)
      );
      fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
      expect(trackCount(0)).toBeInTheDocument();
    });

    describe('mixer dock', () => {
      const toggle = () =>
        within(screen.getByRole('navigation', { name: 'STEMDECK workspaces' })).getByRole(
          'button',
          { name: 'Mixer', exact: true }
        );
      const dock = () => screen.queryByRole('region', { name: 'Mixer' });
      const lastSave = () => saveStudioSession.mock.lastCall[0];

      it('opens from the command bar, M and F9, never while typing, and restores focus', async () => {
        await renderStudio();
        expect(toggle()).toHaveAttribute('aria-expanded', 'false');
        expect(dock()).not.toBeInTheDocument();
        fireEvent.click(toggle());
        expect(toggle()).toHaveAttribute('aria-expanded', 'true');
        expect(dock()).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Mixer' })).toHaveFocus();
        // Meters listen only while the dock is showing.
        expect(engineMethods.setMetering).toHaveBeenLastCalledWith(true);
        fireEvent.keyDown(document.activeElement, { key: 'm' });
        expect(dock()).not.toBeInTheDocument();
        expect(toggle()).toHaveFocus();
        expect(engineMethods.setMetering).toHaveBeenLastCalledWith(false);
        fireEvent.keyDown(document.body, { key: 'F9' });
        expect(dock()).toBeInTheDocument();
        const tempo = screen.getByRole('spinbutton', { name: 'Global tempo' });
        tempo.focus();
        fireEvent.keyDown(tempo, { key: 'm' });
        expect(dock()).toBeInTheDocument();
        fireEvent.keyDown(document.body, { key: 'm', metaKey: true });
        expect(dock()).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Close mixer' }));
        expect(dock()).not.toBeInTheDocument();
      });

      it('keeps Pads & FX, crossfader curve and sync on Perform', async () => {
        await renderStudio();
        expect(screen.getByRole('slider', { name: 'Pad 1 gain' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Global effects XY pad' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Crossfader curve' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sync all' }));
        fireEvent.change(screen.getByRole('combobox', { name: 'Crossfader curve' }), {
          target: { value: 'Sharp' },
        });
        await waitFor(() =>
          expect(engineMethods.setCrossfaderCurve).toHaveBeenLastCalledWith('Sharp')
        );
      });

      it('routes deck sends, cue and inserts to the engine and saves sends and inserts', async () => {
        await renderStudio();
        fireEvent.click(toggle());
        const deckA = within(screen.getByRole('group', { name: 'Deck A channel' }));
        fireEvent.change(deckA.getByRole('slider', { name: 'Deck A send A (Reverb)' }), {
          target: { value: '40' },
        });
        expect(engineMethods.setDeckSend).toHaveBeenLastCalledWith('A', 'a', 40);

        const cue = deckA.getByRole('button', { name: 'Cue deck A in headphones' });
        fireEvent.click(cue);
        expect(engineMethods.setDeckCue).toHaveBeenLastCalledWith('A', true);
        await waitFor(() => expect(cue).toHaveAttribute('aria-pressed', 'true'));

        const inserts = deckA.getByRole('button', { name: 'Deck A inserts, 0 of 8' });
        fireEvent.click(inserts);
        const rack = screen.getByRole('dialog', { name: 'Deck A · Insert chain' });
        fireEvent.click(within(rack).getByRole('button', { name: 'Add Sattari EQ to Deck A' }));
        expect(engineMethods.setDeckInserts).toHaveBeenLastCalledWith('A', [
          expect.objectContaining({ type: 'eq', bypass: false }),
        ]);
        fireEvent.keyDown(rack, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'Deck A · Insert chain' })).toBeNull();
        expect(deckA.getByRole('button', { name: 'Deck A inserts, 1 of 8' })).toHaveFocus();
        // One autosave carries every change.
        await waitFor(() =>
          expect(lastSave().decks[0]).toMatchObject({
            sends: { a: 40, b: 0 },
            inserts: [expect.objectContaining({ type: 'eq' })],
          })
        );
      });

      it('edits the returns and the headphone cue as device preferences', async () => {
        await renderStudio();
        fireEvent.click(toggle());
        fireEvent.change(screen.getByRole('combobox', { name: 'Delay division' }), {
          target: { value: '1/8' },
        });
        expect(engineMethods.setReturn).toHaveBeenLastCalledWith('b', { division: '1/8' });
        fireEvent.change(screen.getByRole('slider', { name: 'Reverb decay in seconds' }), {
          target: { value: '4.5' },
        });
        expect(engineMethods.setReturn).toHaveBeenLastCalledWith('a', { decay: 4.5 });

        const headphones = within(screen.getByRole('group', { name: 'Headphones' }));
        expect(headphones.getByRole('radio', { name: 'Outputs 3–4' })).toBeDisabled();
        fireEvent.click(headphones.getByRole('radio', { name: 'Split' }));
        expect(engineMethods.setCue).toHaveBeenLastCalledWith({ mode: 'split', mix: 0, level: 80 });
        expect(headphones.getByRole('radio', { name: 'Split' })).toBeChecked();
        await waitFor(() =>
          expect(JSON.parse(localStorage.getItem(HEADPHONES_KEY))).toMatchObject({ mode: 'split' })
        );
        await waitFor(() =>
          expect(lastSave().mixer.returns).toMatchObject({
            a: { decay: 4.5 },
            b: { division: '1/8' },
          })
        );
        // Headphone cue is a device preference, never part of the project.
        expect(lastSave().cue).toBeUndefined();
      });

      it('restores saved sends, inserts and returns into the engine', async () => {
        const effect = {
          id: 'fx-1',
          type: 'heat',
          bypass: false,
          params: { drive: 2, output: -3 },
        };
        storeMethods.loadStudioSession.mockReturnValue({
          uiSchemaVersion: 2,
          // Cue is monitoring only: a reopened session starts with it off.
          decks: [
            { id: 'A', title: 'Track A', sends: { a: 30, b: 0 }, inserts: [effect], cue: true },
          ],
          mixer: { returns: { a: { size: 70 }, b: { division: '1/2' } } },
        });
        await renderStudio();
        await waitFor(() => expect(engineMethods.setDeckSend).toHaveBeenCalledWith('A', 'a', 30));
        expect(engineMethods.setDeckInserts).toHaveBeenCalledWith('A', [effect]);
        expect(engineMethods.setReturn).toHaveBeenCalledWith(
          'a',
          expect.objectContaining({ size: 70 })
        );
        expect(engineMethods.setReturn).toHaveBeenCalledWith(
          'b',
          expect.objectContaining({ division: '1/2' })
        );
        fireEvent.click(toggle());
        expect(screen.getByRole('slider', { name: 'Deck A send A (Reverb)' })).toHaveValue('30');
        expect(screen.getByRole('button', { name: 'Deck A inserts, 1 of 8' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cue deck A in headphones' })).toHaveAttribute(
          'aria-pressed',
          'false'
        );
        expect(engineMethods.setDeckCue).not.toHaveBeenCalledWith('A', true);
      });

      it("opens a track's devices in Arrange from its strip", async () => {
        await renderStudio();
        view('Arrange');
        fireEvent.click(
          arrangeActions().getByRole('button', { name: 'Add audio track', exact: true })
        );
        await waitFor(() => expect(lastSave().arranger.tracks).toHaveLength(1));
        view('Perform');
        fireEvent.click(toggle());
        const trackId = lastSave().arranger.tracks[0].id;
        probes.editorCalls = [];
        fireEvent.click(
          screen.getByRole('button', { name: 'Open devices for Audio track in Arrange, 0 effects' })
        );
        expect(editorCalls('openDevices')).toEqual([['openDevices', trackId]]);
        expect(
          within(screen.getByRole('navigation', { name: 'STEMDECK workspaces' })).getByRole(
            'button',
            { name: 'Arrange', exact: true }
          )
        ).toHaveAttribute('aria-current', 'page');
      });
    });
  });
});
