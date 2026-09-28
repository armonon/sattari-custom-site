import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stubMemoryIndexedDB } from '../test/memoryIndexedDB';
import { journalStore } from './performanceJournal';

beforeEach(() => stubMemoryIndexedDB(vi));
afterEach(() => vi.unstubAllGlobals());

const events = (takeId, count) =>
  Array.from({ length: count }, (_, sequence) => ({
    takeId,
    sequence,
    event: { type: 'setDeckGain', time: sequence },
  }));

async function seed() {
  // 'take-1' is a prefix of 'take-10': discarding one must not touch the other.
  await journalStore.commit(
    { id: 'take-1', assetId: 'audio-1', sourceCaptureId: 'cap-1' },
    events('take-1', 3)
  );
  await journalStore.commit({ id: 'take-10', assetId: 'audio-10' }, events('take-10', 2));
  const take = (id) => ({ id, name: id, tracks: [] });
  await journalStore.sourceClip(
    take('cap-1'),
    { id: 'deck-a' },
    { id: 'c1', assetId: 'src-1', start: 0 }
  );
  await journalStore.sourceClip(
    take('cap-1'),
    { id: 'deck-b' },
    { id: 'c2', assetId: 'src-2', start: 1 }
  );
  await journalStore.sourceClip(
    take('cap-10'),
    { id: 'deck-a' },
    { id: 'c1', assetId: 'src-10', start: 0 }
  );
}

it('reports what recovery holds without reading event payloads', async () => {
  await seed();
  const inventory = await journalStore.inventory();
  expect(inventory.takes).toEqual([
    { id: 'take-1', assetId: 'audio-1', sourceCaptureId: 'cap-1', events: 3 },
    { id: 'take-10', assetId: 'audio-10', sourceCaptureId: '', events: 2 },
  ]);
  expect(inventory.captures).toEqual([
    { id: 'cap-1', assetIds: ['src-1', 'src-2'] },
    { id: 'cap-10', assetIds: ['src-10'] },
  ]);
});

it('discards saved takes and their source clips, and nothing else', async () => {
  await seed();
  await journalStore.discard({ takeIds: ['take-1'], captureIds: ['cap-1'] });
  const inventory = await journalStore.inventory();
  expect(inventory.takes.map((take) => [take.id, take.events])).toEqual([['take-10', 2]]);
  expect(inventory.captures).toEqual([{ id: 'cap-10', assetIds: ['src-10'] }]);
  const recovered = await journalStore.recover();
  expect(recovered).toHaveLength(1);
  expect(recovered[0].events).toHaveLength(2);
  expect(await journalStore.recoverSources()).toHaveLength(1);
});

it('does nothing when there is nothing to discard', async () => {
  await seed();
  await journalStore.discard({ takeIds: [], captureIds: [undefined] });
  expect((await journalStore.inventory()).takes).toHaveLength(2);
});
