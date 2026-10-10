import { describe, expect, it } from 'vitest';
import { recorderMimeType, supportedFormats } from './canvasExport';

describe('supportedFormats', () => {
  it('prefers MP4 and keeps one format per container', () => {
    const formats = supportedFormats(() => true);
    expect(formats.map((format) => format.ext)).toEqual(['mp4', 'webm']);
    expect(formats[0].mimeType).toContain('avc1');
  });

  it('falls back to WebM where MP4 is unsupported (Firefox)', () => {
    const formats = supportedFormats((type) => type.startsWith('video/webm'));
    expect(formats).toHaveLength(1);
    expect(formats[0].mimeType).toBe('video/webm;codecs=vp9');
  });

  it('returns nothing without MediaRecorder support or when the check throws', () => {
    expect(supportedFormats(undefined)).toEqual([]);
    expect(
      supportedFormats(() => {
        throw new Error('nope');
      })
    ).toEqual([]);
  });
});

describe('recorderMimeType', () => {
  const mp4 = supportedFormats(() => true)[0];
  it('names an audio codec when audio is included and supported', () => {
    expect(recorderMimeType(mp4, true, () => true)).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2');
    expect(recorderMimeType(mp4, true, () => false)).toBe(mp4.mimeType);
    expect(recorderMimeType(mp4, false, () => true)).toBe(mp4.mimeType);
  });
});
