import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderPlus,
  Music2,
  Play,
  Search,
  Upload,
  Heart,
  Disc3,
  UserRound,
  ListMusic,
  ListPlus,
  Disc3 as DeckIcon,
  AlignJustify,
} from 'lucide-react';
import StudioAction from './StudioAction';
import LibraryBrowse from './LibraryBrowse';
import { StudioPanel } from './StudioPanel';
import { albumKey, libraryArtist, libraryGroups, previewNeighbor } from '../../utils/libraryBrowse';
import { analyzeAudioFile } from '../../utils/audioAnalysis';
import {
  droppedLibraryFiles,
  getLibraryAudio,
  importLibraryTrack,
  isLibraryAudio,
  listLibraryTracks,
  saveLibraryAnalysis,
  selectLibraryTracks,
  updateLibraryTrack,
} from '../../utils/musicLibrary';
import './MusicLibrary.css';
import './BounceLibrary.css';
import LibraryPreview from './LibraryPreview';
import { LIBRARY_DRAG_TYPE } from '../../utils/libraryFiles';
import {
  downloadLibraryFile,
  exportLibraryBackup,
  restoreLibraryBackup,
} from '../../utils/libraryBackup';
import { emptyOrganization, libraryOrganization } from '../../utils/libraryOrganization';
const needsAnalysis = (track) => !(track.analysis?.bpm > 0 && track.analysis?.key);

export default memo(function MusicLibrary({
  fileInputRef,
  decks,
  onLoad,
  onArrange,
  analysisBlocked = false,
}) {
  const [tracks, setTracks] = useState([]);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Opening your music library…');
  const [query, setQuery] = useState('');
  const [browse, setBrowse] = useState('songs');
  const [drill, setDrill] = useState(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [continuous, setContinuous] = useState(false);
  const [folder, setFolder] = useState('');
  const [sort, setSort] = useState('title');
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState('auto');
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState('');
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [organization, setOrganization] = useState(emptyOrganization);
  const [organizationReady, setOrganizationReady] = useState(false);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [playlistId, setPlaylistId] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [collectionsExpanded, setCollectionsExpanded] = useState(false);
  const [queueVisible, setQueueVisible] = useState(false);
  const [trash, setTrash] = useState(false);
  const [editing, setEditing] = useState('');
  const [organizationError, setOrganizationError] = useState('');
  const backupInput = useRef(null);
  const organizationLock = useRef(false);
  const folderInput = useRef(null);
  const audio = useRef(null);
  const previewUrl = useRef('');
  const previewRequest = useRef(0);
  const importing = useRef(false);
  const cancel = useRef(false);
  const alive = useRef(true);
  const action = useRef(false);
  useEffect(() => {
    if (analysisBlocked) cancel.current = true;
  }, [analysisBlocked]);

  useEffect(() => {
    alive.current = true;
    let closed = false;
    listLibraryTracks()
      .then((items) => {
        if (closed) return;
        setTracks(items);
        setReady(true);
        setStatus('Stored on this device. Importing does not load or replace decks.');
      })
      .catch((error) => {
        if (!closed) setStatus(error.message);
      });
    return () => {
      closed = true;
      alive.current = false;
      cancel.current = true;
      previewRequest.current += 1;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);
  useEffect(() => {
    let closed = false;
    libraryOrganization()
      .then((value) => {
        if (!closed) {
          setOrganization(value);
          setOrganizationReady(true);
        }
      })
      .catch((error) => {
        if (!closed) setOrganizationError(error.message);
      });
    return () => {
      closed = true;
    };
  }, []);
  const organize = async (command) => {
    if (!organizationReady || organizationLock.current) return;
    organizationLock.current = true;
    setSavingOrganization(true);
    try {
      const next = await libraryOrganization(command);
      if (alive.current) {
        setOrganization(next);
        if (command.type === 'create') {
          setBrowse('songs');
          setDrill(null);
          setTrash(false);
          setPlaylistId(next.playlists.at(-1).id);
          setPlaylistName('');
          setSort('playlist');
          setQuery('');
          setFolder('');
          setPage(0);
        }
      }
      return next;
    } catch (error) {
      if (alive.current) setStatus(error.message || 'Could not save organization.');
    } finally {
      organizationLock.current = false;
      if (alive.current) setSavingOrganization(false);
    }
  };
  const selectedPlaylist = organization.playlists.find((item) => item.id === playlistId);
  const organizationDisabled = !organizationReady || savingOrganization;
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);

  const folders = useMemo(
    () => [...new Set(tracks.map((track) => track.folder).filter(Boolean))].sort(),
    [tracks]
  );
  const collectionTracks = useMemo(() => {
    const result = selectLibraryTracks(
      tracks.filter(
        (track) =>
          !!track.trashedAt === trash &&
          (!selectedPlaylist || selectedPlaylist.tracks.includes(track.id))
      ),
      { query, folder, sort }
    );
    return selectedPlaylist && sort === 'playlist'
      ? result.sort(
          (a, b) => selectedPlaylist.tracks.indexOf(a.id) - selectedPlaylist.tracks.indexOf(b.id)
        )
      : result;
  }, [tracks, query, folder, sort, selectedPlaylist, trash]);
  const filtered = useMemo(
    () =>
      collectionTracks.filter(
        (track) =>
          (browse !== 'favorites' || track.favorite) &&
          (!drill ||
            (drill.mode === 'albums' ? albumKey(track) : libraryArtist(track)) === drill.key)
      ),
    [collectionTracks, browse, drill]
  );
  const groups = useMemo(() => libraryGroups(collectionTracks, browse), [collectionTracks, browse]);
  const browsing = !trash && !drill && ['albums', 'artists'].includes(browse);
  const browseTo = (mode) => {
    setBrowse(mode);
    setDrill(null);
    setPage(0);
    setTrash(false);
  };
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 50) - 1));
  const visible = filtered.slice(currentPage * 50, currentPage * 50 + 50);
  const freeDecks = decks.filter(
    (deck) =>
      !deck.duration &&
      !Object.values(deck.lanes).some((lane) => lane.status === 'loading' || lane.duration > 0)
  );

  const importFiles = async (pendingFiles) => {
    if (!ready || importing.current || action.current) return;
    importing.current = true;
    cancel.current = false;
    setBusy(true);
    let added = 0,
      duplicates = 0,
      failed = 0,
      ignored = 0;
    try {
      const entries = await pendingFiles;
      const usable = entries.filter(({ file }) => isLibraryAudio(file));
      ignored = entries.length - usable.length;
      for (const [index, { file, path }] of usable.entries()) {
        if (cancel.current) break;
        if (alive.current) setStatus(`Importing ${index + 1}/${usable.length}: ${file.name}`);
        try {
          const result = await importLibraryTrack(file, path);
          if (result.duplicate) duplicates += 1;
          else {
            added += 1;
            if (alive.current) setTracks((items) => [...items, result.track]);
          }
        } catch (error) {
          failed += 1;
          // Quota errors are unlikely to improve for subsequent files.
          if (error.name === 'QuotaExceededError') {
            cancel.current = true;
            break;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (alive.current)
        setStatus(
          `${cancel.current ? 'Stopped. ' : ''}${added} imported · ${duplicates} already in library · ${ignored} non-audio skipped · ${failed} failed.${failed ? ' Check available storage and retry; saved tracks are kept.' : ''}`
        );
    } catch (error) {
      if (alive.current) setStatus(error.message);
    } finally {
      importing.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const runJob = async (job) => {
    if (!ready || importing.current || action.current || organizationLock.current) return;
    importing.current = true;
    cancel.current = false;
    setBusy(true);
    const progress = (message) => {
      if (alive.current) setStatus(message);
    };
    try {
      await job(progress, () => cancel.current);
    } catch (error) {
      progress(error.message || 'Operation failed. Your existing library is kept.');
    } finally {
      try {
        const savedTracks = await listLibraryTracks();
        if (alive.current) setTracks(savedTracks);
        try {
          const savedOrganization = await libraryOrganization();
          if (alive.current) setOrganization(savedOrganization);
        } catch (error) {
          if (alive.current) setOrganizationError(error.message);
        }
      } catch (error) {
        progress(error.message);
      }
      importing.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const setTrashed = (track, trashed) =>
    runJob(async (progress) => {
      stopPreview();
      await updateLibraryTrack(track.id, { trashedAt: trashed ? new Date().toISOString() : null });
      progress(
        trashed
          ? `${track.title} moved to Trash. Audio is recoverable; loaded decks are unchanged.`
          : `${track.title} restored to your collection.`
      );
    });
  const batchAnalyze = () =>
    runJob(async (progress, cancelled) => {
      let completed = 0,
        failed = 0;
      const pending = filtered.filter(needsAnalysis);
      for (const track of pending) {
        if (cancelled()) break;
        progress(`Analyzing ${completed + failed + 1}/${pending.length}: ${track.title}`);
        if (await openTrack(track, 'missing')) completed++;
        else failed++;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      progress(
        `${cancelled() ? 'Stopped. ' : ''}${completed} analyzed · ${failed} failed. Estimates can be corrected in song details.`
      );
    });
  const dropTrack = (event, command) => {
    const trackId = event.dataTransfer.getData(LIBRARY_DRAG_TYPE);
    if (!trackId) return;
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    if (!tracksById.get(trackId)?.trashedAt && tracksById.has(trackId) && !busy)
      void organize({ ...command, trackId });
  };

  const stopPreview = () => {
    previewRequest.current += 1;
    audio.current?.pause();
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = '';
    setPreview(null);
  };

  const previewTrack = async (track, autoplay = false) => {
    stopPreview();
    const request = previewRequest.current;
    try {
      const blob = await getLibraryAudio(track.id);
      if (!alive.current || request !== previewRequest.current) return;
      if (!blob) throw new Error('This track’s audio is missing. Reimport the source file.');
      const url = URL.createObjectURL(blob);
      previewUrl.current = url;
      setPreview({
        id: track.id,
        title: track.title,
        artist: libraryArtist(track),
        album: track.album,
        url,
        autoplay,
      });
      setStatus(`${track.title} selected for preview.`);
    } catch (error) {
      if (alive.current) setStatus(error.message);
    }
  };

  const stepPreview = (direction, ended = false, autoplay = false) => {
    const next = previewNeighbor(
      filtered.filter((track) => !track.trashedAt),
      preview?.id,
      direction,
      { shuffle, repeat, ended }
    );
    if (next) void previewTrack(next, autoplay);
  };

  const openTrack = async (track, analyze = false, destination = target) => {
    if (action.current) return;
    action.current = true;
    setWorking(track.id);
    try {
      const blob = await getLibraryAudio(track.id);
      if (!blob) throw new Error('This track’s audio is missing. Reimport the source file.');
      if (!alive.current) return;
      const file = new File([blob], track.name, { type: blob.type || track.type });
      if (analyze === true || analyze === 'missing') {
        setStatus(`Analyzing ${track.title}…`);
        const analysis = await analyzeAudioFile(file);
        if (analyze === 'missing') {
          if (track.analysis?.bpm > 0) analysis.bpm = track.analysis.bpm;
          if (track.analysis?.key) analysis.key = track.analysis.key;
        }
        const saved = await saveLibraryAnalysis(track.id, analysis);
        if (alive.current && saved) {
          setTracks((items) => items.map((item) => (item.id === saved.id ? saved : item)));
          setStatus(
            `Analyzed ${track.title}: ${analysis.bpm} BPM · ${analysis.key}. Estimates may need correction.`
          );
        }
        return saved;
      } else if (analyze === 'arrange') {
        stopPreview();
        await onArrange?.(file);
      } else {
        stopPreview();
        const deck = await onLoad(track, file, destination);
        if (alive.current)
          setStatus(
            deck
              ? `${track.title} loaded into Deck ${deck}. Your library copy is unchanged.`
              : 'Track was not loaded. Check the session message above.'
          );
        return deck;
      }
    } catch (error) {
      if (alive.current) setStatus(error.message || 'Track could not be opened.');
    } finally {
      action.current = false;
      if (alive.current) setWorking('');
    }
  };

  return (
    <section
      className={`sd-music-library sd-bounce-library${dragging ? ' is-dragging' : ''}`}
      aria-label="Music library"
      data-queue-open={queueVisible}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.types || []).includes(LIBRARY_DRAG_TYPE)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.getData?.(LIBRARY_DRAG_TYPE)) return;
        if (ready && !busy) void importFiles(droppedLibraryFiles(event.dataTransfer));
      }}
    >
      <header>
        <div>
          <Music2 size={20} />
          <div>
            <h3>
              {trash
                ? 'Trash'
                : drill?.title ||
                  selectedPlaylist?.name ||
                  { songs: 'Songs', albums: 'Albums', artists: 'Artists', favorites: 'Favorites' }[
                    browse
                  ]}
            </h3>
            <p>{tracks.filter((track) => !track.trashedAt).length} songs · On this device</p>
          </div>
        </div>
        <div className="sd-music-import-actions" role="group" aria-label="Library actions">
          <button
            type="button"
            aria-expanded={queueVisible}
            aria-controls="library-up-next"
            onClick={() => setQueueVisible((value) => !value)}
          >
            <ListMusic size={16} aria-hidden="true" /> Up Next{' '}
            <span>{organization.queue.length}</span>
          </button>
          <details className="sd-library-add">
            <summary>
              <FolderPlus size={16} aria-hidden="true" /> Add music
            </summary>
            <div>
              <StudioAction
                type="button"
                disabled={!ready || busy}
                onClick={() => fileInputRef.current?.click()}
                icon={Upload}
                label="Import songs"
                className="sd-library-primary-action"
              />
              <StudioAction
                type="button"
                disabled={!ready || busy}
                onClick={() => folderInput.current?.click()}
                icon={FolderPlus}
                label="Import folder / album"
                className="sd-library-primary-action"
              />
            </div>
          </details>
          {busy && (
            <button
              type="button"
              onClick={() => {
                cancel.current = true;
              }}
            >
              Stop after current song
            </button>
          )}
          <details className="sd-library-manage">
            <summary>Manage library</summary>
            <button
              type="button"
              disabled={!ready || busy || !!working || organizationDisabled}
              onClick={() =>
                void runJob(async (progress, cancelled) => {
                  const archive = await exportLibraryBackup(progress, cancelled);
                  downloadLibraryFile(
                    archive,
                    `Sattari-library-${new Date().toISOString().slice(0, 10)}.sattarilibrary`
                  );
                  progress(
                    'Backup download started: audio, metadata, playlists and queue. Keep this file outside your browser.'
                  );
                })
              }
            >
              Back up library
            </button>
            <button
              type="button"
              disabled={!ready || busy || !!working || organizationDisabled}
              onClick={() => backupInput.current?.click()}
            >
              Restore backup
            </button>
            <p>
              Restore merges verified audio without replacing existing songs. Trash is recoverable
              and included in backups.
            </p>
          </details>
        </div>
      </header>
      <div className="sd-library-planning">
        <aside className="sd-library-sidebar-browser" aria-label="Library navigation">
          <nav className="sd-bounce-tabs" aria-label="Library browsing">
            {[
              ['songs', 'Songs', ListMusic],
              ['albums', 'Albums', Disc3],
              ['artists', 'Artists', UserRound],
              ['favorites', 'Favorites', Heart],
            ].map(([id, label, Icon]) => (
              <button
                type="button"
                key={id}
                aria-pressed={browse === id && !trash && !playlistId && !drill}
                onClick={() => browseTo(id)}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
          <StudioPanel
            panelId="library-playlists"
            label="Playlists"
            className={`sd-library-playlists${collectionsExpanded ? ' is-expanded' : ''}`}
            aria-label="Collections"
          >
            <button
              type="button"
              className="sd-library-collection-toggle"
              aria-expanded={collectionsExpanded}
              onClick={() => setCollectionsExpanded((value) => !value)}
            >
              {collectionsExpanded ? 'Hide collection tools' : 'Collections & playlists'}
            </button>
            <button
              type="button"
              aria-pressed={trash}
              onClick={() => {
                setBrowse('songs');
                setDrill(null);
                setTrash(!trash);
                setPlaylistId('');
                setFolder('');
                setQuery('');
                setPage(0);
              }}
            >
              {' '}
              {trash
                ? 'Back to all music'
                : `Trash (${tracks.filter((track) => track.trashedAt).length})`}
            </button>
            {organizationError && <p role="alert">{organizationError}</p>}
            <label className="sd-collection-select">
              Collection
              <select
                aria-label="Library collection"
                value={playlistId}
                onChange={(event) => {
                  setBrowse('songs');
                  setDrill(null);
                  setPlaylistId(event.target.value);
                  setTrash(false);
                  setPage(0);
                  setSort(event.target.value ? 'playlist' : 'title');
                  setQuery('');
                  setFolder('');
                }}
              >
                <option value="">All music</option>
                {organization.playlists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.tracks.length})
                  </option>
                ))}
              </select>
            </label>
            <div className="sd-collection-drop-targets" aria-label="Playlist drop targets">
              {organization.playlists.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={playlistId === item.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropTrack(event, { type: 'add', playlistId: item.id })}
                  onClick={() => {
                    setBrowse('songs');
                    setDrill(null);
                    setPlaylistId(item.id);
                    setTrash(false);
                    setFolder('');
                    setQuery('');
                    setPage(0);
                    setSort('playlist');
                  }}
                >
                  {item.name} <span>{item.tracks.length}</span>
                </button>
              ))}
            </div>
            <label>
              Folder / album
              <select
                value={folder}
                onChange={(event) => {
                  setDrill(null);
                  setFolder(event.target.value);
                  setPage(0);
                }}
              >
                <option value="">All folders</option>
                {folders.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <details className="sd-new-playlist">
              <summary>New playlist</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void organize({ type: 'create', name: playlistName });
                }}
              >
                <input
                  aria-label="Playlist name"
                  placeholder="New playlist name"
                  maxLength={80}
                  value={playlistName}
                  onChange={(event) => setPlaylistName(event.target.value)}
                />
                <button type="submit" disabled={organizationDisabled || !playlistName.trim()}>
                  Create playlist
                </button>
              </form>
            </details>
            {selectedPlaylist && (
              <>
                <label>
                  Rename playlist
                  <input
                    aria-label="Rename playlist"
                    maxLength={80}
                    defaultValue={selectedPlaylist.name}
                    key={selectedPlaylist.id + selectedPlaylist.name}
                    onBlur={(event) => {
                      if (
                        event.target.value.trim() &&
                        event.target.value.trim() !== selectedPlaylist.name
                      )
                        void organize({ type: 'rename', playlistId, name: event.target.value });
                    }}
                    disabled={organizationDisabled}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setBrowse('songs');
                    setDrill(null);
                    setPlaylistId('');
                    setSort('title');
                    setTrash(false);
                    setFolder('');
                    setQuery('');
                    setPage(0);
                  }}
                >
                  Browse all songs to add
                </button>
                <button
                  type="button"
                  disabled={organizationDisabled || busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete playlist “${selectedPlaylist.name}”? Your songs will stay in the library.`
                      )
                    )
                      void organize({ type: 'delete', playlistId }).then((result) => {
                        if (result) {
                          setPlaylistId('');
                          setSort('title');
                        }
                      });
                  }}
                >
                  Delete playlist
                </button>
              </>
            )}
            <p>
              Playlists reference your songs; they never duplicate or delete the audio. Saved on
              this device.
            </p>
          </StudioPanel>
        </aside>
        <div id="library-up-next" className="sd-library-queue-slot" hidden={!queueVisible}>
          <StudioPanel
            panelId="library-queue"
            label="Up Next"
            className="sd-library-queue"
            aria-label="Up next queue"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropTrack(event, { type: 'enqueue' })}
          >
            <header>
              <span>{organization.queue.length} queued</span>
              <button
                type="button"
                disabled={
                  organizationDisabled ||
                  !!working ||
                  busy ||
                  !organization.queue.length ||
                  !freeDecks.length ||
                  (target !== 'auto' && !freeDecks.some((deck) => deck.id === target))
                }
                onClick={async () => {
                  const entry = organization.queue[0],
                    track = tracks.find((item) => item.id === entry.trackId);
                  if (!track || track.trashedAt) {
                    setStatus(
                      'This queued song is missing or in Trash. Restore it or remove it from Up Next.'
                    );
                    return;
                  }
                  if (await openTrack(track)) void organize({ type: 'dequeue', id: entry.id });
                }}
              >
                Load next
              </button>
            </header>
            <p>Your next songs, in order. Load next prepares a deck; it does not start playback.</p>
            {!organization.queue.length && (
              <p className="sd-library-queue-empty">Choose Queue beside a song to plan your set.</p>
            )}
            <ol>
              {organization.queue.map((entry, index) => {
                const track = tracks.find((item) => item.id === entry.trackId);
                return (
                  <li key={entry.id}>
                    <span>
                      {track?.title || 'Missing song'}
                      {track?.trashedAt ? ' · In Trash' : ''}
                    </span>
                    <div>
                      <button
                        type="button"
                        aria-label={`Move queued song ${index + 1} up`}
                        disabled={organizationDisabled || !!working || index === 0}
                        onClick={() => void organize({ type: 'move', id: entry.id, direction: -1 })}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move queued song ${index + 1} down`}
                        disabled={
                          organizationDisabled ||
                          !!working ||
                          index === organization.queue.length - 1
                        }
                        onClick={() => void organize({ type: 'move', id: entry.id, direction: 1 })}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove queued song ${index + 1}`}
                        disabled={organizationDisabled || !!working}
                        onClick={() => void organize({ type: 'dequeue', id: entry.id })}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div
              className="sd-library-deck-targets"
              onDrop={(event) => {
                if (event.dataTransfer.getData(LIBRARY_DRAG_TYPE)) {
                  event.preventDefault();
                  event.stopPropagation();
                  setDragging(false);
                  setStatus(
                    'Choose an empty deck. Occupied decks are never replaced by a library drop.'
                  );
                }
              }}
            >
              <strong>Drop onto an empty deck</strong>
              {decks.map((deck) => (
                <button
                  key={deck.id}
                  type="button"
                  disabled={busy || !!working || !freeDecks.some((item) => item.id === deck.id)}
                  aria-pressed={target === deck.id}
                  onClick={() => setTarget(deck.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDragging(false);
                    const track = tracksById.get(event.dataTransfer.getData(LIBRARY_DRAG_TYPE));
                    if (
                      track &&
                      !track.trashedAt &&
                      !busy &&
                      freeDecks.some((item) => item.id === deck.id)
                    )
                      void openTrack(track, false, deck.id);
                  }}
                >
                  Deck {deck.id}
                  {freeDecks.some((item) => item.id === deck.id) ? '' : ' · occupied'}
                </button>
              ))}
            </div>
          </StudioPanel>
        </div>
      </div>
      <div className="sd-library-songs">
        <input
          ref={backupInput}
          type="file"
          accept=".sattarilibrary"
          hidden
          aria-label="Restore library backup"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file)
              void runJob(async (progress, cancelled) => {
                const count = await restoreLibraryBackup(file, progress, cancelled);
                progress(
                  `Restored ${count} songs and merged playlists / queue. Existing songs are unchanged.`
                );
              });
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.aiff,.aif,.flac,.m4a,.aac,.ogg,.opus"
          multiple
          hidden
          aria-label="Import library songs"
          onChange={(event) => {
            const files = Array.from(event.target.files || []).map((file) => ({
              file,
              path: file.name,
            }));
            event.target.value = '';
            void importFiles(Promise.resolve(files));
          }}
        />
        <input
          ref={folderInput}
          type="file"
          webkitdirectory=""
          multiple
          hidden
          aria-label="Import music folder"
          onChange={(event) => {
            const files = Array.from(event.target.files || []).map((file) => ({
              file,
              path: file.webkitRelativePath || file.name,
            }));
            event.target.value = '';
            void importFiles(Promise.resolve(files));
          }}
        />
        <div className="sd-music-filters">
          <label className="sd-music-search">
            <Search size={16} />
            <input
              aria-label="Search music library"
              placeholder="Search songs, artists, albums, BPM or key"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            Sort
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(0);
              }}
            >
              {selectedPlaylist && <option value="playlist">Playlist order</option>}
              <option value="title">Song title</option>
              <option value="artist">Artist</option>
              <option value="recent">Recently added</option>
              <option value="album">Folder / track order</option>
              <option value="bpm">BPM</option>
              <option value="key">Key</option>
            </select>
          </label>
          <label>
            Load into
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="auto">Next empty deck</option>
              {decks.map((deck) => (
                <option
                  value={deck.id}
                  key={deck.id}
                  disabled={!freeDecks.some((item) => item.id === deck.id)}
                >
                  Deck {deck.id}
                  {deck.duration ? ' · occupied' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="sd-music-status" role="status">
          {status}
        </p>
        <div className="sd-library-list-tools">
          {drill && (
            <button
              type="button"
              onClick={() => {
                setDrill(null);
                setPage(0);
              }}
            >
              Back to {drill.mode}
            </button>
          )}
          <strong>
            {trash
              ? 'Trash'
              : drill?.title ||
                (browse === 'favorites'
                  ? 'Favorites'
                  : selectedPlaylist?.name ||
                    folder ||
                    (browsing ? (browse === 'albums' ? 'Albums' : 'Artists') : 'All songs'))}
          </strong>

          <details className="sd-library-batch-tools">
            <summary>Collection actions</summary>
            <div>
              {!browsing && !trash && filtered.length > 0 && (
                <>
                  <button
                    type="button"
                    disabled={organizationDisabled || busy}
                    onClick={() =>
                      void organize({
                        type: 'enqueueMany',
                        trackIds: filtered.map((track) => track.id),
                      })
                    }
                  >
                    Queue collection
                  </button>
                  <select
                    aria-label="Add collection to playlist"
                    value=""
                    disabled={organizationDisabled || busy || !organization.playlists.length}
                    onChange={(event) => {
                      if (event.target.value)
                        void organize({
                          type: 'addMany',
                          playlistId: event.target.value,
                          trackIds: filtered.map((track) => track.id),
                        });
                    }}
                  >
                    <option value="">Add collection to playlist…</option>
                    {organization.playlists.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                type="button"
                disabled={
                  busy || !!working || analysisBlocked || trash || !filtered.some(needsAnalysis)
                }
                onClick={() => void batchAnalyze()}
              >
                Analyze missing BPM / key
              </button>
            </div>
          </details>
          <small>
            {analysisBlocked
              ? 'Pause playback / recording before analysis.'
              : 'Drag a song to a playlist, Up Next, Perform or Arrange.'}
          </small>
        </div>
        {browsing ? (
          <LibraryBrowse
            key={browse + query + folder + playlistId}
            groups={groups}
            mode={browse}
            onOpen={(group) => {
              setDrill({ key: group.key, title: group.title, mode: browse });
              setSort('album');
              setPage(0);
            }}
          />
        ) : !tracks.length ? (
          <div className="sd-music-empty">
            <FolderPlus size={30} />
            <strong>Bring your music collection</strong>
            <p>Drop audio files or a folder here. Importing keeps your decks unchanged.</p>
          </div>
        ) : !filtered.length ? (
          <p className="sd-music-empty">
            {selectedPlaylist && !selectedPlaylist.tracks.length
              ? 'This playlist is empty. Browse all songs, then choose Add to playlist beside a song.'
              : 'No songs match this search.'}
          </p>
        ) : (
          <div className="sd-music-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Song</th>
                  <th>Folder / album</th>
                  <th>BPM</th>
                  <th>Key</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((track) => (
                  <tr
                    key={track.id}
                    className={preview?.id === track.id ? 'is-previewing' : ''}
                    draggable={!trash && !busy}
                    onDragOver={(event) => {
                      if (selectedPlaylist && sort === 'playlist') event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (selectedPlaylist && sort === 'playlist')
                        dropTrack(event, { type: 'reorder', playlistId, beforeId: track.id });
                    }}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = selectedPlaylist ? 'copyMove' : 'copy';
                      event.dataTransfer.setData(LIBRARY_DRAG_TYPE, track.id);
                      event.dataTransfer.setData('text/plain', track.title);
                    }}
                  >
                    <td>
                      <strong>{track.title}</strong>
                      <small>{track.artist || `${(track.size / 1048576).toFixed(1)} MB`}</small>
                      {!trash && (
                        <button
                          type="button"
                          className="sd-bounce-favorite"
                          aria-label={`Favorite ${track.title}`}
                          aria-pressed={!!track.favorite}
                          disabled={busy}
                          onClick={() =>
                            void runJob(async () => {
                              await updateLibraryTrack(track.id, { favorite: !track.favorite });
                            })
                          }
                        >
                          <Heart
                            size={15}
                            fill={track.favorite ? 'currentColor' : 'none'}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </td>
                    <td title={track.folder}>{track.album}</td>
                    <td>{track.analysis?.bpm || '—'}</td>
                    <td>{track.analysis?.key || '—'}</td>
                    <td>
                      {trash ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setTrashed(track, false)}
                        >
                          Restore song
                        </button>
                      ) : (
                        <div className="sd-music-row-actions">
                          <StudioAction
                            className="sd-library-primary-action"
                            type="button"
                            onClick={() => void previewTrack(track, true)}
                            aria-label={`Preview ${track.title}`}
                            icon={Play}
                            label="Preview"
                          />
                          <StudioAction
                            className="sd-library-primary-action"
                            type="button"
                            aria-label={`Queue ${track.title}`}
                            disabled={organizationDisabled}
                            onClick={() => void organize({ type: 'enqueue', trackId: track.id })}
                            icon={ListPlus}
                            label="Queue"
                          />
                          <StudioAction
                            className="sd-library-primary-action"
                            type="button"
                            disabled={
                              !!working ||
                              busy ||
                              !freeDecks.length ||
                              (target !== 'auto' && !freeDecks.some((deck) => deck.id === target))
                            }
                            onClick={() => void openTrack(track)}
                            aria-label={`Load ${track.title} into deck`}
                            icon={DeckIcon}
                            label="Load"
                          />
                          <details className="sd-song-more">
                            <summary aria-label={`More actions for ${track.title}`}>More</summary>
                            <div className="sd-song-more-content">
                              <select
                                aria-label={`Add ${track.title} to playlist`}
                                value=""
                                disabled={organizationDisabled || !organization.playlists.length}
                                onChange={(event) => {
                                  if (event.target.value)
                                    void organize({
                                      type: 'add',
                                      playlistId: event.target.value,
                                      trackId: track.id,
                                    });
                                }}
                              >
                                <option value="">Add to playlist…</option>
                                {organization.playlists.map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                              {selectedPlaylist && (
                                <details className="sd-playlist-track-actions">
                                  <summary>Playlist actions</summary>
                                  <button
                                    type="button"
                                    aria-label={`Move ${track.title} earlier in playlist`}
                                    disabled={
                                      organizationDisabled ||
                                      selectedPlaylist.tracks[0] === track.id
                                    }
                                    onClick={() =>
                                      void organize({
                                        type: 'move',
                                        playlistId,
                                        trackId: track.id,
                                        direction: -1,
                                      })
                                    }
                                  >
                                    Move earlier
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Move ${track.title} later in playlist`}
                                    disabled={
                                      organizationDisabled ||
                                      selectedPlaylist.tracks.at(-1) === track.id
                                    }
                                    onClick={() =>
                                      void organize({
                                        type: 'move',
                                        playlistId,
                                        trackId: track.id,
                                        direction: 1,
                                      })
                                    }
                                  >
                                    Move later
                                  </button>
                                  <button
                                    type="button"
                                    disabled={organizationDisabled}
                                    onClick={() =>
                                      void organize({
                                        type: 'remove',
                                        playlistId,
                                        trackId: track.id,
                                      })
                                    }
                                  >
                                    Remove from playlist
                                  </button>
                                </details>
                              )}

                              <button
                                type="button"
                                disabled={!!working || busy || analysisBlocked}
                                onClick={() => void openTrack(track, true)}
                              >
                                {working === track.id ? 'Working…' : 'Analyze'}
                              </button>

                              {onArrange && (
                                <StudioAction
                                  type="button"
                                  disabled={!!working || busy}
                                  onClick={() => void openTrack(track, 'arrange')}
                                  aria-label={`Add ${track.title} to arrangement`}
                                  icon={AlignJustify}
                                  label="Arrange"
                                />
                              )}
                              <details
                                className="sd-song-details"
                                onToggle={(event) => {
                                  if (event.currentTarget.open) setEditing(track.id);
                                }}
                              >
                                <summary>Song details</summary>
                                {editing === track.id && (
                                  <>
                                    <form
                                      onSubmit={(event) => {
                                        event.preventDefault();
                                        const values = new FormData(event.currentTarget);
                                        void runJob(async (progress) => {
                                          const bpm = Number(values.get('bpm'));
                                          if (
                                            values.get('bpm') &&
                                            (!Number.isFinite(bpm) || bpm < 20 || bpm > 400)
                                          )
                                            throw new Error('BPM must be between 20 and 400.');
                                          await updateLibraryTrack(track.id, {
                                            title: values.get('title'),
                                            artist: values.get('artist'),
                                            album: values.get('album'),
                                            analysis: {
                                              ...track.analysis,
                                              bpm: values.get('bpm') ? bpm : undefined,
                                              key: String(values.get('key')).trim().slice(0, 40),
                                              source: 'manual',
                                            },
                                          });
                                          progress(
                                            'Song details saved. Existing deck settings are unchanged.'
                                          );
                                        });
                                      }}
                                    >
                                      {[
                                        ['title', 'Title', track.title],
                                        ['artist', 'Artist', track.artist],
                                        ['album', 'Album', track.album],
                                        ['bpm', 'BPM', track.analysis?.bpm],
                                        ['key', 'Key', track.analysis?.key],
                                      ].map(([name, label, value]) => (
                                        <label key={name}>
                                          {label}
                                          <input
                                            name={name}
                                            aria-label={`${track.title} ${label}`}
                                            defaultValue={value || ''}
                                            maxLength={200}
                                            required={name === 'title'}
                                            type={name === 'bpm' ? 'number' : 'text'}
                                            min={name === 'bpm' ? 20 : undefined}
                                            max={name === 'bpm' ? 400 : undefined}
                                            step="any"
                                          />
                                        </label>
                                      ))}
                                      <button type="submit" disabled={busy || !!working}>
                                        Save details
                                      </button>
                                    </form>
                                    <button
                                      type="button"
                                      disabled={busy || !!working}
                                      onClick={() =>
                                        void runJob(async (progress) => {
                                          const blob = await getLibraryAudio(track.id);
                                          if (!blob) throw new Error('Audio is missing.');
                                          downloadLibraryFile(blob, track.name);
                                          progress('Original audio download started.');
                                        })
                                      }
                                    >
                                      Download original
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy || !!working}
                                      onClick={() => void setTrashed(track, true)}
                                    >
                                      Move to Trash
                                    </button>
                                  </>
                                )}
                              </details>
                            </div>
                          </details>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer>
          <span>Stored on this device. Use Manage library to back up your music.</span>
          {!browsing && (
            <div>
              <button
                type="button"
                disabled={!currentPage}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                {filtered.length
                  ? `${currentPage * 50 + 1}–${Math.min((currentPage + 1) * 50, filtered.length)} of ${filtered.length}`
                  : '0 songs'}
              </span>
              <button
                type="button"
                disabled={(currentPage + 1) * 50 >= filtered.length}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </footer>
      </div>
      <LibraryPreview
        ref={audio}
        preview={preview}
        onClose={stopPreview}
        onPrevious={(playing) => stepPreview(-1, false, playing)}
        onNext={(playing) => stepPreview(1, false, playing)}
        onEnded={() => {
          if (continuous) stepPreview(1, true, true);
        }}
        canPrevious={!!previewNeighbor(filtered, preview?.id, -1, { shuffle, repeat })}
        canNext={!!previewNeighbor(filtered, preview?.id, 1, { shuffle, repeat })}
        shuffle={shuffle}
        onShuffle={() => setShuffle((value) => !value)}
        repeat={repeat}
        onRepeat={() =>
          setRepeat((value) => (value === 'off' ? 'all' : value === 'all' ? 'one' : 'off'))
        }
        continuous={continuous}
        onContinuous={() => setContinuous((value) => !value)}
      />
    </section>
  );
});
