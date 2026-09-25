import { expect, it, vi } from 'vitest';
import { parseLibraryTags, readLibraryTags } from './libraryTags';
const sync = (n) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
const bytes = (s) => [...new TextEncoder().encode(s)];
const frame = (id, payload, version = 3) => [
  ...bytes(id),
  ...(version === 4 ? sync(payload.length) : [0, 0, payload.length >> 8, payload.length & 255]),
  0,
  0,
  ...payload,
];
const tag = (frames, version = 3) =>
  new Uint8Array([...bytes('ID3'), version, 0, 0, ...sync(frames.length), ...frames]);
it('reads Bounce-style text metadata and embedded raster artwork without storing images in track metadata', () => {
  const fixture = tag([
    ...frame('TIT2', [3, ...bytes('Track')]),
    ...frame('TPE1', [3, ...bytes('Artist')]),
    ...frame('TRCK', [0, ...bytes('02/12')]),
    ...frame('APIC', [0, ...bytes('image/png'), 0, 3, 0, 137, 80, 78, 71]),
  ]);
  expect(parseLibraryTags(fixture)).toEqual({ title: 'Track', artist: 'Artist', trackNumber: 2 });
  expect(
    parseLibraryTags(tag(frame('TIT2', [1, 254, 255, 0, 83, 0, 111, 0, 110, 0, 103]))).title
  ).toBe('Song');
  expect(parseLibraryTags(fixture, { artwork: true }).artwork.type).toBe('image/png');
});
it('handles v2.2, v2.4, malformed frames and skips unsynchronized/unsupported tags', () => {
  expect(parseLibraryTags(tag(frame('TALB', [3, ...bytes('Album')], 4), 4)).album).toBe('Album');
  expect(parseLibraryTags(tag([...bytes('TT2'), 0, 0, 5, 0, ...bytes('Song')], 2)).title).toBe(
    'Song'
  );
  const bad = tag(frame('TIT2', [3, ...bytes('Title')]));
  bad[5] = 128;
  expect(parseLibraryTags(bad)).toEqual({});
  expect(parseLibraryTags(bad.slice(0, 7))).toEqual({});
  const broken = tag(frame('TIT2', [3, ...bytes('Title')]));
  broken[14] = 127;
  expect(parseLibraryTags(broken)).toEqual({});
});
it('bounds tag reads to 2 MiB and reads only 10 bytes for untagged audio', async () => {
  const file = new Blob([tag(frame('TIT2', [3, ...bytes('Title')]))]);
  const slice = vi.spyOn(file, 'slice');
  expect((await readLibraryTags(file)).title).toBe('Title');
  expect(slice.mock.calls.every(([a, b]) => b - a <= 2 * 1024 * 1024)).toBe(true);
  const plain = new Blob(['RIFF not ID3 music']);
  const plainSlice = vi.spyOn(plain, 'slice');
  expect(await readLibraryTags(plain)).toEqual({});
  expect(plainSlice).toHaveBeenCalledTimes(1);
});
