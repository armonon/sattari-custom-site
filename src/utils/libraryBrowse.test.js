import { expect, it } from 'vitest';
import { libraryGroups, previewNeighbor } from './libraryBrowse';
it('keeps same-name albums from different artists separate and orders discs/tracks', () => {
  const tracks = [
    { id: 'a', title: 'Ten', album: 'Live', artist: 'One', trackNumber: 10 },
    { id: 'b', title: 'Two', album: 'Live', artist: 'One', trackNumber: 2 },
    { id: 'c', title: 'Other', album: 'Live', artist: 'Two' },
    { id: 'd', title: 'Trash', trashedAt: 'now' },
  ];
  const groups = libraryGroups(tracks, 'albums');
  expect(groups).toHaveLength(2);
  expect(groups[0].tracks.map((t) => t.id)).toEqual(['b', 'a']);
  expect(tracks[0].id).toBe('a');
  expect(libraryGroups(tracks, 'artists')).toHaveLength(2);
});
it('stops at list edges unless repeat is explicit and shuffles away from current song', () => {
  const tracks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  expect(previewNeighbor(tracks, 'c', 1)).toBeNull();
  expect(previewNeighbor(tracks, 'a', -1)).toBeNull();
  expect(previewNeighbor(tracks, 'c', 1, { repeat: 'all' }).id).toBe('a');
  expect(previewNeighbor(tracks, 'b', 1, { repeat: 'one', ended: true }).id).toBe('b');
  expect(previewNeighbor(tracks, 'b', 1, { repeat: 'one' }).id).toBe('c');
  expect(previewNeighbor(tracks, 'b', 1, { shuffle: true, random: () => 0 }).id).toBe('a');
  expect(previewNeighbor([], 'x', 1)).toBeNull();
});
