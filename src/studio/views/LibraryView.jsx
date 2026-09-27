import { useMemo } from 'react';
import { Circle, FolderOpen, Library, ListMusic, Plus } from 'lucide-react';
import MusicLibrary from '../../components/studio/MusicLibrary';

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor((safe % 3600) / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/**
 * The library reads only deck IDs and occupancy (durations and lane status).
 * This projection keeps its identity until those change, so knob moves do not
 * re-render the memoized library.
 */
export function useLibraryDeckSlots(decks) {
  const slots = JSON.stringify(
    decks.map((deck) => ({
      id: deck.id,
      duration: deck.duration,
      lanes: Object.fromEntries(
        Object.entries(deck.lanes).map(([id, lane]) => [
          id,
          { status: lane.status, duration: lane.duration },
        ])
      ),
    }))
  );
  return useMemo(() => JSON.parse(slots), [slots]);
}

export default function LibraryView({
  libraryInputRef,
  librarySlots,
  onLoad,
  onArrange,
  analysisBlocked,
  decks,
  loadedDecks,
  loadedStems,
  recordings,
  collection,
  onCollection,
  onOpenDeck,
  onOpenStems,
  onLoadDeckFiles,
  onDownloadRecording,
}) {
  return (
    <>
      <MusicLibrary
        fileInputRef={libraryInputRef}
        decks={librarySlots}
        onLoad={onLoad}
        analysisBlocked={analysisBlocked}
        onArrange={onArrange}
      />
      <details className="sd-library-session-assets">
        <summary>Current session audio & recordings</summary>
        <div className="sd-library-view">
          <aside className="sd-library-sidebar">
            <strong>CURRENT SESSION</strong>
            <button
              type="button"
              className={collection === 'session' ? 'is-active' : ''}
              aria-pressed={collection === 'session'}
              onClick={() => onCollection('session')}
            >
              <Library size={13} /> Session audio <span>{loadedDecks.length}</span>
            </button>
            <button
              type="button"
              className={collection === 'stems' ? 'is-active' : ''}
              aria-pressed={collection === 'stems'}
              onClick={() => onCollection('stems')}
            >
              <ListMusic size={13} /> Stem lanes <span>{loadedStems.length}</span>
            </button>
            <button
              type="button"
              className={collection === 'recordings' ? 'is-active' : ''}
              aria-pressed={collection === 'recordings'}
              onClick={() => onCollection('recordings')}
            >
              <Circle size={13} /> Recordings <span>{recordings.length}</span>
            </button>
            <button type="button" onClick={onLoadDeckFiles}>
              <Plus size={13} /> Load deck files
            </button>
          </aside>
          <section className="sd-library-table">
            <header>
              <span>TRACK</span>
              <span>DECK</span>
              <span>BPM</span>
              <span>KEY</span>
              <span>TIME</span>
            </header>
            {collection === 'session' &&
              (loadedDecks.length ? (
                loadedDecks.map((deck) => (
                  <button type="button" key={deck.id} onClick={() => onOpenDeck(deck.id)}>
                    <span style={{ '--sd-accent': deck.accent }}>
                      <i />
                      {deck.title}
                    </span>
                    <strong>{deck.id}</strong>
                    <span>{deck.bpm}</span>
                    <span>{deck.keyName}</span>
                    <span>{formatTime(deck.duration)}</span>
                  </button>
                ))
              ) : (
                <div className="sd-library-empty">
                  <FolderOpen size={22} />
                  <strong>No tracks loaded</strong>
                  <button type="button" onClick={onLoadDeckFiles}>
                    Load deck files
                  </button>
                </div>
              ))}
            {collection === 'stems' &&
              (loadedStems.length ? (
                loadedStems.map((lane) => (
                  <button
                    type="button"
                    key={`${lane.deckId}:${lane.id}`}
                    onClick={() => onOpenStems(lane.deckId)}
                  >
                    <span>{lane.name || lane.label}</span>
                    <strong>{lane.deckId}</strong>
                    <span>{decks.find((deck) => deck.id === lane.deckId)?.bpm}</span>
                    <span>{decks.find((deck) => deck.id === lane.deckId)?.keyName}</span>
                    <span>{formatTime(lane.duration)}</span>
                  </button>
                ))
              ) : (
                <div className="sd-library-empty">
                  <strong>No separated stems loaded</strong>
                  <p>Open a deck’s Stems tab to import separated audio.</p>
                </div>
              ))}
            {collection === 'recordings' && !recordings.length && (
              <div className="sd-library-empty">
                <strong>No recordings yet</strong>
                <p>Record a performance to save it here.</p>
              </div>
            )}
            {collection === 'recordings' &&
              recordings.map((recording) => (
                <button
                  type="button"
                  key={recording.id}
                  onClick={() => onDownloadRecording(recording)}
                >
                  <span>
                    <Circle size={10} />
                    {recording.name}
                  </span>
                  <strong>REC</strong>
                  <span>--</span>
                  <span>--</span>
                  <span>{Math.max(1, Math.round(recording.size / 1024))} KB</span>
                </button>
              ))}
          </section>
        </div>
      </details>
    </>
  );
}
