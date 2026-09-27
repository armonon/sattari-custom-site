import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MusicLibrary from './MusicLibrary';
import {
  getLibraryAudio,
  importLibraryTrack,
  libraryMetadata,
  listLibraryTracks,
  saveLibraryAnalysis,
  updateLibraryTrack,
} from '../../utils/musicLibrary';
import { analyzeAudioFile } from '../../utils/audioAnalysis';
import {
  emptyOrganization,
  organizeLibrary,
  libraryOrganization,
} from '../../utils/libraryOrganization';

// Song rows carry several buttons each; header actions are found in their group.
const libraryActions = () => within(screen.getByRole('group', { name: 'Library actions' }));
vi.mock('../../utils/libraryOrganization', async (original) => ({
  ...(await original()),
  libraryOrganization: vi.fn(),
}));

vi.mock('../../utils/musicLibrary', async (original) => ({
  ...(await original()),
  listLibraryTracks: vi.fn(),
  getLibraryAudio: vi.fn(),
  importLibraryTrack: vi.fn(),
  saveLibraryAnalysis: vi.fn(),
  updateLibraryTrack: vi.fn(),
}));
vi.mock('../../utils/audioAnalysis', () => ({ analyzeAudioFile: vi.fn() }));
const decks = ['A', 'B', 'C', 'D'].map((id) => ({ id, duration: id === 'A' ? 30 : 0, lanes: {} }));
const song = (name) => new File(['audio'], `${name}.wav`, { type: 'audio/wav', lastModified: 100 });
const track = (name) => libraryMetadata(song(name), `My Album/${name}.wav`);

beforeEach(() => {
  vi.clearAllMocks();
  let organization = emptyOrganization();
  libraryOrganization.mockImplementation(async (command) => {
    if (command) organization = organizeLibrary(organization, command);
    return organization;
  });
  listLibraryTracks.mockResolvedValue([]);
  getLibraryAudio.mockResolvedValue(song('Song'));
  importLibraryTrack.mockImplementation(async (file, path) => ({
    track: libraryMetadata(file, path),
    duplicate: false,
  }));
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});

function mount(onLoad = vi.fn(async () => 'B'), customDecks = decks) {
  return {
    ...render(
      <MusicLibrary fileInputRef={{ current: null }} decks={customDecks} onLoad={onLoad} />
    ),
    onLoad,
  };
}

describe('independent music library', () => {
  it('uses sidebar browsing and a compact playback shelf with an optional queue', async () => {
    mount();
    expect(
      screen.getByRole('navigation', { name: 'Library browsing' }).closest('aside')
    ).toHaveAttribute('aria-label', 'Library navigation');
    expect(screen.queryByRole('region', { name: 'Up next queue' })).not.toBeInTheDocument();
    const player = screen.getByRole('region', { name: 'Preview / cue player' });
    expect(player).toHaveClass('sd-library-miniplayer');
    expect(player.parentElement).toHaveAttribute('aria-label', 'Music library');
    expect(
      screen.queryByRole('button', { name: 'Collapse Preview player' })
    ).not.toBeInTheDocument();
    fireEvent.click(libraryActions().getByRole('button', { name: /^Up Next/ }));
    expect(screen.getByRole('region', { name: 'Up next queue' })).toBeInTheDocument();
    fireEvent.click(libraryActions().getByRole('button', { name: /^Up Next/ }));
    expect(screen.queryByRole('region', { name: 'Up next queue' })).not.toBeInTheDocument();
    await screen.findByText('Bring your music collection');
  });
  it('keeps preview, queue and load visible while secondary song actions are collapsed', async () => {
    listLibraryTracks.mockResolvedValue([track('First')]);
    mount();
    await screen.findByText('First');
    for (const name of ['Preview First', 'Queue First', 'Load First into deck']) {
      expect(screen.getByRole('button', { name })).toHaveClass('sd-library-primary-action');
    }
    const more = screen.getByLabelText('More actions for First');
    expect(more.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Analyze', exact: true }).closest('details')).toBe(
      more.closest('details')
    );
    fireEvent.click(more);
    expect(screen.getByRole('button', { name: 'Analyze', exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Add First to playlist')).toBeInTheDocument();
    fireEvent.click(more);
    expect(screen.getByLabelText('Preview First', { selector: 'button' })).toBeInTheDocument();
  });
  it('drag-reorders a playlist without copying audio or changing decks', async () => {
    const saved = [track('First'), track('Second'), track('Third')];
    listLibraryTracks.mockResolvedValue(saved);
    let org = {
      playlists: [{ id: 'p', name: 'Test playlist', tracks: saved.map((t) => t.id) }],
      queue: [],
    };
    libraryOrganization.mockImplementation(async (command) => {
      if (command) org = organizeLibrary(org, command);
      return org;
    });
    const { onLoad } = mount();
    await screen.findByRole('option', { name: 'Test playlist (3)' });
    fireEvent.change(screen.getByLabelText('Library collection'), { target: { value: 'p' } });
    fireEvent.drop(screen.getByText('First').closest('tr'), {
      dataTransfer: { getData: () => saved[2].id },
    });
    await waitFor(() =>
      expect(org.playlists[0].tracks).toEqual([saved[2].id, saved[0].id, saved[1].id])
    );
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Third');
    expect(onLoad).not.toHaveBeenCalled();
    expect(importLibraryTrack).not.toHaveBeenCalled();
  });
  it('browses albums and artists, queues a whole album, and preserves favorites on reopen', async () => {
    let saved = [
      { ...track('First'), artist: 'One', album: 'Live' },
      { ...track('Second'), artist: 'Two', album: 'Live' },
    ];
    listLibraryTracks.mockImplementation(async () => saved);
    updateLibraryTrack.mockImplementation(async (id, changes) => {
      saved = saved.map((item) => (item.id === id ? { ...item, ...changes } : item));
      return saved.find((item) => item.id === id);
    });
    const { onLoad, unmount } = mount();
    await screen.findByText('First');
    fireEvent.click(screen.getByRole('button', { name: 'Albums', exact: true }));
    expect(screen.getByRole('button', { name: 'Open album Live by Two' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open album Live by One' }));
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Collection actions'));
    fireEvent.click(screen.getByRole('button', { name: 'Queue collection' }));
    fireEvent.click(libraryActions().getByRole('button', { name: /^Up Next/ }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Up next queue' })).getAllByRole('listitem')
      ).toHaveLength(1)
    );
    fireEvent.click(screen.getByLabelText('Favorite First', { selector: 'button' }));
    await waitFor(() => expect(saved[0].favorite).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Artists', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Open artist Two' }));
    expect(screen.getByLabelText('Preview Second', { selector: 'button' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Favorites', exact: true }));
    expect(screen.getByLabelText('Preview First', { selector: 'button' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview Second' })).not.toBeInTheDocument();
    expect(onLoad).not.toHaveBeenCalled();
    unmount();
    mount();
    await screen.findByLabelText('Favorite First', { selector: 'button' });
    expect(screen.getByLabelText('Favorite First', { selector: 'button' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
  it('exposes collapsible collection tools without changing the selected song collection', async () => {
    mount();
    await screen.findByText('Stored on this device. Importing does not load or replace decks.');
    const tools = screen.getByRole('button', { name: 'Collections & playlists' });
    expect(tools).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(tools);
    expect(screen.getByRole('button', { name: 'Hide collection tools' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByLabelText('Library collection')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Hide collection tools' }));
    expect(screen.getByRole('button', { name: 'Collections & playlists' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
  it('supports song drag-out and drop-to-queue without importing duplicate files', async () => {
    const saved = track('First');
    listLibraryTracks.mockResolvedValue([saved]);
    mount();
    await screen.findByText('First');
    const data = new Map();
    const dataTransfer = {
      setData: (type, value) => data.set(type, value),
      getData: (type) => data.get(type) || '',
      types: ['application/x-sattari-library-track'],
    };
    fireEvent.dragStart(screen.getByText('First').closest('tr'), { dataTransfer });
    expect(data.get('application/x-sattari-library-track')).toBe(saved.id);
    fireEvent.click(libraryActions().getByRole('button', { name: /^Up Next/ }));
    fireEvent.drop(screen.getByRole('region', { name: 'Up next queue' }), { dataTransfer });
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Up next queue' })).getAllByRole('listitem')
      ).toHaveLength(1)
    );
    expect(importLibraryTrack).not.toHaveBeenCalled();
  });
  it('keeps Trash recoverable without changing a loaded deck', async () => {
    let saved = track('First');
    listLibraryTracks.mockImplementation(async () => [saved]);
    updateLibraryTrack.mockImplementation(async (_, changes) => (saved = { ...saved, ...changes }));
    const { onLoad } = mount();
    await screen.findByText('First');
    fireEvent.click(screen.getByLabelText('More actions for First'));
    fireEvent.click(screen.getByText('Song details'));
    fireEvent.click(await screen.findByRole('button', { name: 'Move to Trash' }));
    await screen.findByText(/moved to Trash/);
    await waitFor(() => expect(screen.queryByText('First')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Trash (1)' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore song' }));
    await screen.findByText(/restored to your collection/);
    await waitFor(() => expect(saved.trashedAt).toBe(null));
    expect(onLoad).not.toHaveBeenCalled();
  });
  it('analyzes missing metadata sequentially and blocks analysis during a performance', async () => {
    const saved = [track('First'), { ...track('Second'), analysis: { bpm: 120, key: 'C major' } }];
    listLibraryTracks.mockResolvedValue(saved);
    analyzeAudioFile.mockResolvedValue({ bpm: 124, key: 'A minor' });
    saveLibraryAnalysis.mockImplementation(async (id, analysis) => ({
      ...saved.find((item) => item.id === id),
      analysis,
    }));
    const { rerender } = mount();
    await screen.findByText('First');
    fireEvent.click(screen.getByText('Collection actions'));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze missing BPM / key' }));
    await screen.findByText(/1 analyzed · 0 failed/);
    expect(analyzeAudioFile).toHaveBeenCalledTimes(1);
    rerender(
      <MusicLibrary
        fileInputRef={{ current: null }}
        decks={decks}
        onLoad={vi.fn()}
        analysisBlocked
      />
    );
    expect(screen.getByRole('button', { name: 'Analyze missing BPM / key' })).toBeDisabled();
  });
  it('creates persistent playlists and adds song references without loading audio', async () => {
    listLibraryTracks.mockResolvedValue([track('First'), track('Second')]);
    const { onLoad, unmount } = mount();
    await screen.findByText('First');
    fireEvent.click(screen.getByText('New playlist', { exact: true }));
    fireEvent.change(screen.getByLabelText('Playlist name'), { target: { value: 'Opening set' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create playlist' }));
    await screen.findByText(/This playlist is empty/);
    fireEvent.click(screen.getByRole('button', { name: 'Browse all songs to add' }));
    const playlistId = screen.getByRole('option', { name: 'Opening set (0)' }).value;
    fireEvent.click(screen.getByLabelText('More actions for First'));
    fireEvent.change(screen.getByLabelText('Add First to playlist'), {
      target: { value: playlistId },
    });
    await screen.findByRole('option', { name: 'Opening set (1)' });
    fireEvent.change(screen.getByLabelText('Library collection'), {
      target: { value: playlistId },
    });
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.queryByText('Second')).not.toBeInTheDocument();
    expect(onLoad).not.toHaveBeenCalled();
    expect(getLibraryAudio).not.toHaveBeenCalled();
    unmount();
    mount();
    await screen.findByRole('option', { name: 'Opening set (1)' });
  });
  it('reorders the queue and removes only a successfully loaded song', async () => {
    listLibraryTracks.mockResolvedValue([track('First'), track('Second')]);
    const onLoad = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('B');
    mount(onLoad);
    await screen.findByText('First');
    fireEvent.click(screen.getByLabelText('Queue First', { selector: 'button' }));
    fireEvent.click(libraryActions().getByRole('button', { name: /^Up Next/ }));
    const queue = within(screen.getByRole('region', { name: 'Up next queue' }));
    await waitFor(() => expect(queue.getAllByRole('listitem')).toHaveLength(1));
    fireEvent.click(screen.getByLabelText('Queue Second', { selector: 'button' }));
    await waitFor(() => expect(queue.getAllByRole('listitem')).toHaveLength(2));
    fireEvent.click(queue.getByRole('button', { name: 'Move queued song 2 up' }));
    await waitFor(() => expect(queue.getAllByRole('listitem')[0]).toHaveTextContent('Second'));
    fireEvent.click(queue.getByRole('button', { name: 'Load next' }));
    await screen.findByText(/Track was not loaded/);
    expect(queue.getAllByRole('listitem')).toHaveLength(2);
    fireEvent.click(queue.getByRole('button', { name: 'Load next' }));
    await waitFor(() => expect(queue.getAllByRole('listitem')).toHaveLength(1));
    expect(queue.getAllByRole('listitem')[0]).toHaveTextContent('First');
    expect(onLoad).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Second' }),
      expect.any(File),
      'auto'
    );
  });
  it('adds library audio to the arranger even when every deck is occupied', async () => {
    listLibraryTracks.mockResolvedValue([track('First')]);
    const onLoad = vi.fn(),
      onArrange = vi.fn(async () => {});
    render(
      <MusicLibrary
        fileInputRef={{ current: null }}
        decks={decks.map((deck) => ({ ...deck, duration: 30 }))}
        onLoad={onLoad}
        onArrange={onArrange}
      />
    );
    await screen.findByText('First');
    expect(screen.getByLabelText('Load First into deck', { selector: 'button' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('More actions for First'));
    fireEvent.click(screen.getByRole('button', { name: 'Add First to arrangement' }));
    await waitFor(() => expect(onArrange).toHaveBeenCalledWith(expect.any(File)));
    expect(onLoad).not.toHaveBeenCalled();
  });
  it('imports more than four songs without loading or replacing any deck', async () => {
    const { onLoad } = mount();
    await screen.findByText(/Stored on this device/);
    fireEvent.change(screen.getByLabelText('Import library songs'), {
      target: { files: Array.from({ length: 7 }, (_, i) => song(`Song ${i}`)) },
    });
    await screen.findByText(/7 imported/);
    expect(importLibraryTrack).toHaveBeenCalledTimes(7);
    expect(onLoad).not.toHaveBeenCalled();
    expect(analyzeAudioFile).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText(/^Load .* into deck$/, { selector: 'button' })).toHaveLength(7);
  });
  it('supports folder selection, groups albums, and searches saved songs', async () => {
    listLibraryTracks.mockResolvedValue([track('First'), track('Second')]);
    mount();
    await screen.findByText('First');
    expect(screen.getByLabelText('Import music folder')).toHaveAttribute('webkitdirectory');
    expect(screen.getByRole('option', { name: 'My Album' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search music library'), {
      target: { value: 'Second' },
    });
    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
  it('previews independently, revokes its URL, and loads into the chosen empty deck', async () => {
    const saved = track('First');
    listLibraryTracks.mockResolvedValue([saved]);
    const { onLoad } = mount();
    await screen.findByText('First');
    fireEvent.click(screen.getByLabelText('Preview First', { selector: 'button' }));
    await within(screen.getByRole('region', { name: 'Preview / cue player' })).findByText('First');
    expect(onLoad).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    fireEvent.change(screen.getByLabelText('Load into'), { target: { value: 'C' } });
    fireEvent.click(screen.getByLabelText('Load First into deck', { selector: 'button' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(saved, expect.any(File), 'C'));
    expect(screen.getByRole('option', { name: 'Deck A · occupied' })).toBeDisabled();
  });
  it('analyzes only on request and updates searchable BPM/key metadata', async () => {
    const saved = track('First');
    listLibraryTracks.mockResolvedValue([saved]);
    analyzeAudioFile.mockResolvedValue({ bpm: 121, key: 'C major' });
    saveLibraryAnalysis.mockResolvedValue({ ...saved, analysis: { bpm: 121, key: 'C major' } });
    mount();
    await screen.findByText('First');
    fireEvent.click(screen.getByLabelText('More actions for First'));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    await screen.findByText('121');
    expect(screen.getByText('C major')).toBeInTheDocument();
    expect(saveLibraryAnalysis).toHaveBeenCalledWith(saved.id, { bpm: 121, key: 'C major' });
  });
  it('keeps earlier successful imports when storage fills', async () => {
    importLibraryTrack
      .mockImplementationOnce(async (file) => ({ track: libraryMetadata(file), duplicate: false }))
      .mockRejectedValueOnce(new DOMException('Full', 'QuotaExceededError'));
    mount();
    await screen.findByText(/Stored on this device/);
    fireEvent.change(screen.getByLabelText('Import library songs'), {
      target: { files: [song('One'), song('Two'), song('Three')] },
    });
    await screen.findByText(/1 imported.*1 failed/);
    expect(importLibraryTrack).toHaveBeenCalledTimes(2);
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.queryByText('Three')).not.toBeInTheDocument();
  });
  it('disables loading when all decks are occupied and limits rendered rows to 50', async () => {
    listLibraryTracks.mockResolvedValue(Array.from({ length: 53 }, (_, i) => track(`Song ${i}`)));
    mount(
      undefined,
      decks.map((deck) => ({ ...deck, duration: 30 }))
    );
    await screen.findByText('Song 0');
    expect(screen.getAllByLabelText(/^Load .* into deck$/, { selector: 'button' })).toHaveLength(
      50
    );
    expect(
      screen
        .getAllByRole('button', { name: /^Load .* into deck$/ })
        .every((button) => button.disabled)
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByLabelText(/^Load .* into deck$/, { selector: 'button' })).toHaveLength(3);
  });
});
