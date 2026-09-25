// Bounce's album/artist browsing model, adapted to StemDeck's persistent IDs.
export const libraryArtist = (track) => track.albumArtist || track.artist || 'Unknown artist';
export const albumKey = (track) => JSON.stringify([libraryArtist(track), track.album || 'Unfiled']);
export function libraryGroups(tracks, mode) {
  const groups = new Map();
  for (const track of tracks) {
    if (track.trashedAt) continue;
    const key = mode === 'artists' ? libraryArtist(track) : albumKey(track);
    if (!groups.has(key))
      groups.set(key, {
        key,
        title: mode === 'artists' ? libraryArtist(track) : track.album || 'Unfiled',
        artist: libraryArtist(track),
        tracks: [],
      });
    groups.get(key).tracks.push(track);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      tracks: group.tracks.sort(
        (a, b) =>
          (a.discNumber || 0) - (b.discNumber || 0) ||
          (a.trackNumber || 0) - (b.trackNumber || 0) ||
          a.title.localeCompare(b.title, undefined, { numeric: true })
      ),
    }))
    .sort(
      (a, b) =>
        a.title.localeCompare(b.title, undefined, { numeric: true }) ||
        a.artist.localeCompare(b.artist)
    );
}
export function previewNeighbor(
  tracks,
  currentId,
  direction,
  { shuffle = false, repeat = 'off', ended = false, random = Math.random } = {}
) {
  if (!tracks.length) return null;
  const index = tracks.findIndex((track) => track.id === currentId);
  if (ended && repeat === 'one' && index >= 0) return tracks[index];
  if (shuffle && tracks.length > 1) {
    const candidates = tracks.filter((track) => track.id !== currentId);
    return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  }
  const next = index < 0 ? 0 : index + direction;
  if (next < 0 || next >= tracks.length)
    return repeat === 'all' ? tracks[(next + tracks.length) % tracks.length] : null;
  return tracks[next];
}
