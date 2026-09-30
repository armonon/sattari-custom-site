// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createLearnBackup, inspectLearnBackup, restoreLearnBackup } from './learnBackup';
import { DEMO } from './music';
import { lessonFingerprint } from './progress';

function storage(values = {}) {
  const map = new Map(Object.entries(values));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i],
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
  };
}
const lesson = {
  ...DEMO,
  id: 'my-import',
  source: 'estimate',
  audioUrl: 'https://untrusted.invalid/audio.wav',
  polyphonicNotes: [{ midi: 64, start: 0, end: 0.5, confidence: 0.8 }],
};
const song = {
  id: lesson.id,
  lesson,
  savedAt: 123,
  file: new File(['original audio'], 'song.wav', { type: 'audio/wav' }),
  practiceFile: new Blob(['prepared audio'], { type: 'audio/wav' }),
};
const fingerprint = lessonFingerprint(lesson);
const media = [
  {
    id: 'take-1',
    kind: 'take',
    key: 'take:my-import:0',
    fingerprint,
    at: 123,
    speed: 0.75,
    seconds: 1,
    blob: new Blob(['take'], { type: 'audio/wav' }),
  },
  {
    id: 'video:my-import:0',
    kind: 'video',
    fingerprint,
    offset: 2,
    blob: new Blob(['film'], { type: 'video/mp4' }),
  },
];
const saved = () =>
  storage({
    'loop-guitar-profile-v1': JSON.stringify({ handedness: 'left', tuning: 'dropD', capo: 2 }),
    'loop-reviewed:my-import': fingerprint,
    'loop-practice-history-v1': JSON.stringify([
      { lessonId: 'my-import', at: 123, kind: 'rhythm' },
    ]),
    'sattari-cart-v1': 'private unrelated state',
  });
async function rewrite(blob, change) {
  const header = await blob.slice(0, 12).arrayBuffer();
  const length = new DataView(header).getUint32(8, true);
  const manifest = JSON.parse(await blob.slice(12, 12 + length).text());
  change(manifest);
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  new DataView(header).setUint32(8, bytes.length, true);
  return new Blob([header, bytes, blob.slice(12 + length)]);
}
it('round trips original/prepared audio, video, takes and allowlisted state with integrity verification', async () => {
  const blob = await createLearnBackup({ songs: [song], media, storage: saved() });
  const result = await inspectLearnBackup(blob);
  expect(await result.songs[0].file.text()).toBe('original audio');
  expect(result.songs[0].file.name).toBe('song.wav');
  expect(await result.songs[0].practiceFile.text()).toBe('prepared audio');
  expect(await result.media[1].blob.text()).toBe('film');
  expect(result.songs[0].lesson.polyphonicNotes).toHaveLength(1);
  expect(result.songs[0].lesson.audioUrl).toBeUndefined();
  expect(result.state.map(([key]) => key)).not.toContain('sattari-cart-v1');
});
it('supports a progress-only backup', async () => {
  const result = await inspectLearnBackup(
    await createLearnBackup({ songs: [], media: [], storage: saved() })
  );
  expect(result.songs).toEqual([]);
  expect(result.state).toHaveLength(3);
});
it('rejects damaged media before a restore can write anything', async () => {
  const blob = await createLearnBackup({ songs: [song], media, storage: saved() });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  bytes[bytes.length - 1] ^= 1;
  await expect(inspectLearnBackup(new Blob([bytes]))).rejects.toThrow('damaged');
});
it.each([
  [
    'version',
    (m) => {
      m.version = 999;
    },
  ],
  [
    'notes',
    (m) => {
      m.songs[0].lesson.notes[0].midi = NaN;
    },
  ],
  [
    'phrase bounds',
    (m) => {
      m.songs[0].lesson.phraseStarts = [80000];
    },
  ],
  [
    'asset reference',
    (m) => {
      m.songs[0].file = 999;
    },
  ],
  [
    'settings injection',
    (m) => {
      m.state.push(['sattari-cart-v1', '{}']);
    },
  ],
  [
    'duplicate id',
    (m) => {
      m.songs.push(m.songs[0]);
    },
  ],
  [
    'reserved lesson id',
    (m) => {
      m.songs[0].id = 'foundations-01';
      m.songs[0].lesson.id = 'foundations-01';
    },
  ],
  [
    'duplicate setting',
    (m) => {
      m.state.push(m.state[0]);
    },
  ],
])('rejects invalid %s', async (_, change) => {
  const blob = await createLearnBackup({ songs: [song], media, storage: saved() });
  await expect(inspectLearnBackup(await rewrite(blob, change))).rejects.toThrow();
});
it('rejects oversized manifests and trailing bytes without parsing them', async () => {
  const blob = await createLearnBackup({ songs: [], media: [], storage: storage() });
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  new DataView(header.buffer).setUint32(8, 50 * 1024 * 1024, true);
  await expect(inspectLearnBackup(new Blob([header]))).rejects.toThrow();
  await expect(inspectLearnBackup(new Blob([blob, 'extra']))).rejects.toThrow('unexpected');
});
it('merges missing progress and history but preserves existing lesson versions and settings', async () => {
  const target = storage({
    'loop-guitar-profile-v1': '{"handedness":"right","tuning":"standard","capo":0}',
    'loop-practice-progress-v1': '{"kept":{"matched":4}}',
    'loop-practice-history-v1': '[{"lessonId":"kept","at":1}]',
  });
  const backup = {
    songs: [song],
    media,
    state: [
      ['loop-guitar-profile-v1', saved().getItem('loop-guitar-profile-v1')],
      ['loop-practice-progress-v1', '{"kept":{"matched":1},"new":{"matched":3}}'],
      ['loop-practice-history-v1', '[{"lessonId":"kept","at":1},{"lessonId":"new","at":2}]'],
    ],
  };
  const addSongs = vi.fn(async () => []),
    addMedia = vi.fn(async () => ['take-1', 'video:my-import:0']);
  const report = await restoreLearnBackup(backup, { storage: target, addSongs, addMedia });
  expect(report).toMatchObject({ songs: 0, media: 2, settings: 2, skipped: 2 });
  expect(JSON.parse(target.getItem('loop-practice-progress-v1'))).toEqual({
    kept: { matched: 4 },
    new: { matched: 3 },
  });
  expect(JSON.parse(target.getItem('loop-practice-history-v1'))).toHaveLength(2);
  expect(JSON.parse(target.getItem('loop-guitar-profile-v1')).handedness).toBe('right');
});
it('reports partial storage failure without deleting existing entries', async () => {
  const target = storage({ kept: 'value' });
  await expect(
    restoreLearnBackup(
      { songs: [song], media, state: [] },
      {
        storage: target,
        addSongs: async () => ['my-import'],
        addMedia: async () => {
          throw new Error('quota');
        },
      }
    )
  ).rejects.toThrow('Added 1 lessons, 0 media files');
  expect(target.getItem('kept')).toBe('value');
});
