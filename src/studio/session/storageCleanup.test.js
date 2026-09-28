import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stubMemoryIndexedDB } from '../../test/memoryIndexedDB';
import { listAudioAssets, putAudioAsset } from '../../utils/audioProjectStore';
import { journalStore } from '../../utils/performanceJournal';
import {
  formatBytes,
  otherStudioTabsOpen,
  planStorageCleanup,
  runStorageCleanup,
} from './storageCleanup';

const hour = 60 * 60 * 1000;
const audio = (text) => new Blob([text], { type: 'audio/wav' });

beforeEach(() => stubMemoryIndexedDB(vi));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.removeItem('sattari-studio-transfer-v1');
});

async function storeOld(...names) {
  vi.useFakeTimers({ now: Date.now() - 2 * hour, toFake: ['Date'] });
  const assets = {};
  for (const name of names) assets[name] = (await putAudioAsset(audio(name), { name })).id;
  vi.useRealTimers();
  return assets;
}

const session = (assets, captures = []) => ({
  decks: [{ lanes: { fullMix: { assetId: assets.deck } } }],
  pads: [{ assetId: assets.pad }],
  recordings: [],
  arranger: { tracks: [{ clips: [{ assetId: assets.clip }] }], captures },
});

it('keeps everything the project, a pending Learn transfer and unsaved takes use', async () => {
  const assets = await storeOld(
    'deck',
    'pad',
    'clip',
    'savedTake',
    'unsavedTake',
    'transfer',
    'orphan'
  );
  localStorage.setItem(
    'sattari-studio-transfer-v1',
    JSON.stringify({ audioAssetId: assets.transfer })
  );
  await journalStore.commit({ id: 'take-saved', assetId: assets.savedTake }, [
    { takeId: 'take-saved', sequence: 0, event: {} },
  ]);
  await journalStore.commit({ id: 'take-unsaved', assetId: assets.unsavedTake }, []);
  const project = session(assets, [{ id: 'take-saved', assetId: assets.savedTake }]);

  const plan = await planStorageCleanup(project);
  expect(plan.unused.map((asset) => asset.id)).toEqual([assets.orphan]);
  expect(plan.bytes).toBe('orphan'.length);
  expect(plan.takeIds).toEqual(['take-saved']);
  expect(plan.events).toBe(1);

  await runStorageCleanup(plan);
  const left = new Set((await listAudioAssets()).map((asset) => asset.id));
  expect(left.has(assets.orphan)).toBe(false);
  for (const name of ['deck', 'pad', 'clip', 'savedTake', 'unsavedTake', 'transfer'])
    expect(left.has(assets[name])).toBe(true);
  const journal = await journalStore.inventory();
  expect(journal.takes.map((take) => take.id)).toEqual(['take-unsaved']);
});

it('offers old temporary export copies, never the current backup or a fresh export', async () => {
  const now = Date.now();
  const file = (name, age) => new File([new Uint8Array(1024)], name, { lastModified: now - age });
  const files = [
    file('export-1-aaaa.wav', 2 * hour),
    file('export-2-bbbb.sattari', 3 * hour),
    file('export-3-cccc.zip', 60 * 1000),
  ];
  const removeEntry = vi.fn(async () => {});
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: {
      getDirectory: async () => ({
        getDirectoryHandle: async () => ({
          removeEntry,
          async *entries() {
            for (const item of files)
              yield [item.name, { kind: 'file', getFile: async () => item }];
          },
        }),
      }),
    },
  });
  const plan = await planStorageCleanup(session({}), {
    keepFiles: ['export-2-bbbb.sattari'],
    now,
  });
  expect(plan.exports.map((item) => item.name)).toEqual(['export-1-aaaa.wav']);
  expect(plan.exportBytes).toBe(1024);
  await runStorageCleanup(plan);
  expect(removeEntry).toHaveBeenCalledExactlyOnceWith('export-1-aaaa.wav');
});

it('never removes audio stored within the last hour', async () => {
  await putAudioAsset(audio('just imported'));
  const plan = await planStorageCleanup(session({}));
  expect(plan.unused).toEqual([]);
});

it('detects other open Studio tabs through Web Locks', async () => {
  const held = (count) => ({
    query: async () => ({
      held: Array.from({ length: count }, () => ({ name: 'sattari-studio-tab', mode: 'shared' })),
    }),
  });
  vi.stubGlobal('navigator', { ...navigator, locks: held(1) });
  expect(await otherStudioTabsOpen()).toBe(false);
  vi.stubGlobal('navigator', { ...navigator, locks: held(2) });
  expect(await otherStudioTabsOpen()).toBe(true);
  vi.stubGlobal('navigator', {});
  expect(await otherStudioTabsOpen()).toBe(false);
});

it('formats sizes for people', () => {
  expect(formatBytes(0)).toBe('0 MB');
  expect(formatBytes(512)).toBe('0.1 MB');
  expect(formatBytes(250 * 1024 ** 2)).toBe('250.0 MB');
  expect(formatBytes(3.5 * 1024 ** 3)).toBe('3.5 GB');
});
