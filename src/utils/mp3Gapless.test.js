import { Blob } from 'node:buffer';
import { expect, it } from 'vitest';
import { mp3Gapless } from './mp3Gapless';

function fixture({ id3 = false, mono = true, version = 3, encoder = 'Lavc' } = {}) {
  const offset = id3 ? 138 : 0;
  const bytes = new Uint8Array(offset + 256);
  const put = (at, value) => bytes.set(new TextEncoder().encode(value), at);
  if (id3) {
    put(0, 'ID3');
    bytes[3] = 4;
    bytes[8] = 1;
  }
  bytes.set([255, 0xe3 | (version << 3), 0x94, mono ? 0xc0 : 0], offset);
  const xing = offset + 4 + (version === 3 ? (mono ? 17 : 32) : mono ? 9 : 17);
  put(xing, 'Info');
  bytes[xing + 7] = 15;
  const tag = xing + 8 + 4 + 4 + 100 + 4;
  put(tag, encoder);
  bytes.set([0x24, 0x02, 0x40], tag + 21); // 576 encoder delay + 576 padding
  return new Blob([bytes]);
}
it('reads delay without decoding MP3, including stereo, MPEG2 and large ID3 offsets', async () => {
  for (const options of [{}, { id3: true }, { mono: false }, { version: 2 }, { encoder: 'LAME' }])
    expect(await mp3Gapless(fixture(options))).toEqual({ startFrames: 1105, trimFrames: 1152 });
});
it('does not invent padding for unknown tags or non-MP3 sources', async () => {
  expect(await mp3Gapless(fixture({ encoder: 'Fake' }))).toBeNull();
  expect(await mp3Gapless(new Blob(['not MP3']))).toBeNull();
});
