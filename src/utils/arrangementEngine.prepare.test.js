import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('tone', () => ({}));
vi.mock('./audioProjectStore', () => ({
  getAudioAsset: vi.fn(async (id) => ({
    blob: { id, arrayBuffer: async () => new ArrayBuffer(8) },
  })),
}));
vi.mock('./arrangementSourceWindow', async (original) => ({
  ...(await original()),
  decodeSourceWindow: vi.fn(),
}));

import { ArrangementEngine } from './arrangementEngine';
import { decodeSourceWindow } from './arrangementSourceWindow';
import { audioClip, audioTrack, emptyArrangement } from './arrangementModel';

const RATE = 48000;
const bytes = (buffer) => buffer.length * buffer.numberOfChannels * 4;
let engine, alive;
beforeEach(() => {
  vi.clearAllMocks();
  alive = [];
  engine = new ArrangementEngine(
    {
      rawContext: {
        sampleRate: RATE,
        decodeAudioData: vi.fn(async () => ({ length: RATE, numberOfChannels: 2, duration: 1 })),
      },
    },
    {}
  );
  decodeSourceWindow.mockImplementation(async (raw, blob, start, end, budget) => {
    // What else of this source is still decoded while a new window is read?
    alive.push({
      source: blob.id,
      others: [...engine.buffers.values()].filter((buffer) => buffer.source === blob.id).length,
      budget,
    });
    return {
      buffer: { source: blob.id, start, end, numberOfChannels: 2, length: (end - start) * RATE },
      offset: start,
    };
  });
});

function project() {
  const song = audioTrack('Song'),
    hit = audioTrack('Hit'),
    sampler = audioTrack('Sampler');
  song.clips = [{ ...audioClip('song', 'Song', 100, 0), sourceDuration: 200 }];
  // Lies entirely in the pre-roll overlap of the first two export sections.
  hit.clips = [{ ...audioClip('hit', 'Hit', 3, 25), sourceDuration: 3 }];
  sampler.kind = 'midi';
  sampler.clips = [
    {
      ...audioClip('sample', 'Sampler', 100, 0),
      kind: 'midi',
      instrument: 'sampler',
      sourceDuration: 1,
      notes: [{ pitch: 'C4', time: 1, duration: 90, velocity: 0.8 }],
    },
  ];
  return { ...emptyArrangement(), tracks: [song, hit, sampler] };
}
// renderSection windows: 30 s sections with a 12 s pre-roll.
const windows = [
  { start: 0, end: 30 },
  { start: 18, end: 60 },
  { start: 48, end: 90 },
  { start: 78, end: 100 },
];

it('reuses identical export windows and sampler decodes without holding two windows', async () => {
  const snapshots = [];
  for (const window of windows) {
    await engine.prepare(project(), true, window);
    snapshots.push(new Map(engine.buffers));
  }
  const decoded = (source) => alive.filter((call) => call.source === source);
  expect(decoded('song')).toHaveLength(4); // its range changes every section
  expect(decoded('hit')).toHaveLength(1); // same request in sections 1 and 2
  expect(engine.context.rawContext.decodeAudioData).toHaveBeenCalledTimes(1);
  // The previous window of a source is always released before the next is read.
  expect(alive.every((call) => call.others === 0)).toBe(true);
  expect(snapshots[1].get('hit')).toBe(snapshots[0].get('hit'));
  expect(snapshots[1].get('sample')).toBe(snapshots[0].get('sample'));
  expect(snapshots[2].has('hit')).toBe(false); // released once no longer in range
  // Reused buffers stay counted against the section's decode budget.
  const budget = 384 * 1024 * 1024;
  expect(decoded('song')[1].budget).toBe(
    budget - bytes(snapshots[0].get('hit')) - bytes(snapshots[0].get('sample'))
  );
});

it('prepares a reused window exactly like a fresh decode of the same request', async () => {
  const data = project();
  await engine.prepare(data, true, windows[0]);
  await engine.prepare(data, true, windows[1]);
  const fresh = new ArrangementEngine(engine.context, {});
  await fresh.prepare(data, true, windows[1]);
  const sorted = (entries) => [...entries].sort((a, b) => String(a[0]).localeCompare(b[0]));
  const shape = (target) => ({
    offsets: sorted(target.bufferOffsets),
    keys: sorted(target.clipSourceKeys),
    windowed: [...target.windowedBuffers].sort(),
    buffers: sorted(target.buffers).map(([key, { start, end, length }]) => [
      key,
      start,
      end,
      length,
    ]),
  });
  expect(shape(engine)).toEqual(shape(fresh));
});
