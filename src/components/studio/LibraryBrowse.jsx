import { useEffect, useRef, useState } from 'react';
import { Disc3, UserRound } from 'lucide-react';
import { getLibraryAudio } from '../../utils/musicLibrary';
import { readLibraryTags } from '../../utils/libraryTags';

function AlbumArtwork({ track }) {
  const ref = useRef(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    let closed = false,
      objectUrl = '',
      started = false;
    const load = async () => {
      if (started) return;
      started = true;
      try {
        const file = await getLibraryAudio(track.id);
        if (!file || closed) return;
        const tags = await readLibraryTags(file, { artwork: true });
        if (tags.artwork && !closed) {
          objectUrl = URL.createObjectURL(tags.artwork);
          setUrl(objectUrl);
        }
      } catch {
        /* artwork is optional; the album remains usable */
      }
    };
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              void load();
              observer.disconnect();
            }
          })
        : null;
    if (observer) observer.observe(ref.current);
    else void load();
    return () => {
      closed = true;
      observer?.disconnect();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [track.id]);
  return (
    <span className="sd-bounce-art" ref={ref}>
      {url ? <img src={url} alt="" loading="lazy" /> : <Disc3 size={38} aria-hidden="true" />}
    </span>
  );
}
export default function LibraryBrowse({ groups, mode, onOpen }) {
  const [page, setPage] = useState(0);
  const current = Math.min(page, Math.max(0, Math.ceil(groups.length / 24) - 1));
  return (
    <section
      aria-label={`${mode === 'artists' ? 'Artist' : 'Album'} browser`}
      className="sd-bounce-browser"
    >
      <div className="sd-bounce-grid">
        {groups.slice(current * 24, current * 24 + 24).map((group) => (
          <button
            className="sd-bounce-card"
            type="button"
            key={group.key}
            onClick={() => onOpen(group)}
            aria-label={`Open ${mode === 'artists' ? 'artist' : 'album'} ${group.title}${mode === 'albums' ? ` by ${group.artist}` : ''}`}
          >
            {mode === 'artists' ? (
              <span className="sd-bounce-art is-artist">
                <UserRound size={36} aria-hidden="true" />
              </span>
            ) : (
              <AlbumArtwork key={group.tracks[0].id} track={group.tracks[0]} />
            )}
            <strong>{group.title}</strong>
            <span>
              {mode === 'albums'
                ? group.artist
                : `${new Set(group.tracks.map((track) => track.album)).size} albums`}
            </span>
            <small>{group.tracks.length} songs</small>
          </button>
        ))}
      </div>
      {!groups.length && <p>No {mode} match this search.</p>}
      {groups.length > 24 && (
        <nav aria-label="Browse pages">
          <button type="button" disabled={!current} onClick={() => setPage(current - 1)}>
            Previous page
          </button>
          <span>
            {current + 1} / {Math.ceil(groups.length / 24)}
          </span>
          <button
            type="button"
            disabled={(current + 1) * 24 >= groups.length}
            onClick={() => setPage(current + 1)}
          >
            Next page
          </button>
        </nav>
      )}
    </section>
  );
}
