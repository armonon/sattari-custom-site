import { afterEach, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import {
  wavHeader,
  pcm24,
  updateCrc,
  StreamZip,
  createExportSink,
} from './arrangementStreamExport';

afterEach(() => vi.unstubAllGlobals());
describe('bounded export packaging', () => {
  it('uses standard WAV for short exports and exact RF64 sizes beyond 4 GiB', () => {
    const small = new DataView(wavHeader(48000).buffer);
    expect(small.getUint32(40, true)).toBe(288000);
    const frames = 48000 * 3600 * 8,
      large = wavHeader(frames),
      v = new DataView(large.buffer);
    expect(new TextDecoder().decode(large.slice(0, 4))).toBe('RF64');
    expect(v.getBigUint64(28, true)).toBe(BigInt(frames * 6));
    expect(v.getBigUint64(36, true)).toBe(BigInt(frames));
    expect(v.getBigUint64(20, true)).toBe(BigInt(frames * 6 + 72));
  });
  it('encodes interleaved PCM and carries CRC across sections', () => {
    const a = pcm24([new Float32Array([0, -1]), new Float32Array([1, 0])]);
    expect([...a.bytes]).toEqual([0, 0, 0, 255, 255, 127, 0, 0, 128, 0, 0, 0]);
    const bytes = new TextEncoder().encode('123456789');
    expect(
      (updateCrc(updateCrc(0xffffffff, bytes.slice(0, 4)), bytes.slice(4)) ^ 0xffffffff) >>> 0
    ).toBe(0xcbf43926);
    expect(() => pcm24([new Float32Array([1.1])])).toThrow(/clips/);
    expect(() => pcm24([new Float32Array([NaN])])).toThrow(/invalid/);
  });
  it('creates ZIP64 archives that an independent Python ZIP reader validates', async () => {
    const parts = [],
      zip = new StreamZip({ write: async (bytes) => parts.push(bytes) });
    for (const name of ['01-Keys.wav', '02-鼓.wav']) {
      const data = new Uint8Array([...wavHeader(1), 0, 0, 0, 0, 0, 0]);
      await zip.begin(name, data.length);
      await zip.data(data);
      await zip.end();
    }
    await zip.finish();
    const data = Buffer.concat(parts.map((x) => Buffer.from(x)));
    const output = execFileSync(
      '/usr/bin/python3',
      [
        '-c',
        'import sys,io,zipfile; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); assert z.testzip() is None; assert len(z.namelist())==2; assert all(len(z.read(n))==50 for n in z.namelist()); print("valid")',
      ],
      { input: data }
    );
    expect(output.toString().trim()).toBe('valid');
  });
  it('does not truncate large directory offsets to 32 bits', async () => {
    const parts = [],
      zip = new StreamZip({ write: async (bytes) => parts.push(bytes) });
    zip.offset = 2 ** 32 + 123;
    await zip.begin('x', 0);
    await zip.end();
    await zip.finish();
    const central = new DataView(parts[2].buffer);
    expect(central.getBigUint64(46 + 1 + 20, true)).toBe(4294967419n);
  });
  it('fails before allocation when no disk backend can support the export', async () => {
    vi.stubGlobal('navigator', {});
    await expect(createExportSink(512 * 1024 * 1024)).rejects.toThrow(/temporary disk/);
  });
  it('checks quota before creating files and abort removes only its own partial output', async () => {
    const removeEntry = vi.fn(async () => {}),
      abort = vi.fn(async () => {}),
      write = vi.fn(),
      getDirectory = vi.fn();
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ quota: 1, usage: 0 }), getDirectory },
    });
    await expect(createExportSink(100)).rejects.toThrow(/disk space/);
    expect(getDirectory).not.toHaveBeenCalled();
    navigator.storage.estimate = async () => ({ quota: 1e9, usage: 0 });
    getDirectory.mockResolvedValue({
      getDirectoryHandle: async () => ({
        removeEntry,
        getFileHandle: async () => ({ createWritable: async () => ({ abort, write }) }),
      }),
    });
    const sink = await createExportSink(100);
    await sink.write(new Uint8Array(4));
    await sink.abort();
    expect(abort).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledWith(expect.stringMatching(/^export-.*\.wav$/));
  });
});
