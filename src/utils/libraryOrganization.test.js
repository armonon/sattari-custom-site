import { expect, it } from 'vitest';
import { emptyOrganization, organizeLibrary } from './libraryOrganization';

it('adds whole collections atomically and drag-reorders unique playlist references', () => {
  const state = { playlists: [{ id: 'p', name: 'Set', tracks: ['a'] }], queue: [] };
  const added = organizeLibrary(state, {
    type: 'addMany',
    playlistId: 'p',
    trackIds: ['a', 'b', 'b', 'c'],
  });
  expect(added.playlists[0].tracks).toEqual(['a', 'b', 'c']);
  expect(
    organizeLibrary(added, { type: 'reorder', playlistId: 'p', trackId: 'c', beforeId: 'a' })
      .playlists[0].tracks
  ).toEqual(['c', 'a', 'b']);
  expect(
    organizeLibrary(added, { type: 'reorder', playlistId: 'p', trackId: 'a', beforeId: 'c' })
      .playlists[0].tracks
  ).toEqual(['b', 'a', 'c']);
  expect(
    organizeLibrary(state, { type: 'enqueueMany', trackIds: ['a', 'b'] }).queue.map(
      (t) => t.trackId
    )
  ).toEqual(['a', 'b']);
  expect(state.playlists[0].tracks).toEqual(['a']);
  expect(() =>
    organizeLibrary(state, { type: 'addMany', playlistId: 'missing', trackIds: ['a'] })
  ).toThrow();
});

it('keeps playlist edits immutable and stores unique references without touching audio', () => {
  const empty = emptyOrganization();
  const created = organizeLibrary(empty, { type: 'create', name: ' Set ' });
  const playlistId = created.playlists[0].id;
  const added = organizeLibrary(created, { type: 'add', playlistId, trackId: 'song-a' });
  const duplicate = organizeLibrary(added, { type: 'add', playlistId, trackId: 'song-a' });
  const renamed = organizeLibrary(duplicate, { type: 'rename', playlistId, name: 'Encore' });
  expect(empty.playlists).toEqual([]);
  expect(created.playlists[0].tracks).toEqual([]);
  expect(renamed.playlists[0]).toEqual({ id: playlistId, name: 'Encore', tracks: ['song-a'] });
  expect(
    organizeLibrary(renamed, { type: 'remove', playlistId, trackId: 'song-a' }).playlists[0].tracks
  ).toEqual([]);
});

it('allows repeated queued songs and reorders/removes individual occurrences', () => {
  const one = organizeLibrary(emptyOrganization(), { type: 'enqueue', trackId: 'song' });
  const two = organizeLibrary(one, { type: 'enqueue', trackId: 'song' });
  expect(two.queue[0].id).not.toBe(two.queue[1].id);
  const moved = organizeLibrary(two, { type: 'move', id: two.queue[1].id, direction: -1 });
  expect(moved.queue[0].id).toBe(two.queue[1].id);
  expect(organizeLibrary(moved, { type: 'move', id: moved.queue[0].id, direction: -1 })).toEqual(
    moved
  );
  expect(organizeLibrary(moved, { type: 'dequeue', id: moved.queue[0].id }).queue).toEqual(
    one.queue
  );
});

it('moves playlist references and rejects empty names', () => {
  const state = { playlists: [{ id: 'p', name: 'Set', tracks: ['a', 'b'] }], queue: [] };
  expect(
    organizeLibrary(state, { type: 'move', playlistId: 'p', trackId: 'b', direction: -1 })
      .playlists[0].tracks
  ).toEqual(['b', 'a']);
  expect(() => organizeLibrary(state, { type: 'create', name: ' ' })).toThrow('name');
  expect(() => organizeLibrary(state, { type: 'rename', playlistId: 'p', name: '' })).toThrow(
    'name'
  );
});
