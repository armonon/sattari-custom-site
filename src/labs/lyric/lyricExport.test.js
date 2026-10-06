import { describe, expect, it } from 'vitest';
import { linesToLrc, linesToSrt, pickRecorderFormat, recorderCandidates } from './lyricExport';

function line(start, end, words) {
  return { id: `line-${start}`, start, end, words: words.map((text) => ({ text })) };
}

describe('linesToLrc', () => {
  it('formats a single line as [mm:ss.xx]text', () => {
    const lines = [line(65.5, 68, ['Hello', 'world'])];
    expect(linesToLrc(lines)).toBe('[01:05.50]Hello world');
  });

  it('formats multiple lines in order, one per row', () => {
    const lines = [line(0, 2, ['First', 'line']), line(2, 4, ['Second', 'line'])];
    expect(linesToLrc(lines)).toBe('[00:00.00]First line\n[00:02.00]Second line');
  });

  it('sorts lines by start time even if given out of order', () => {
    const lines = [line(5, 6, ['later']), line(1, 2, ['earlier'])];
    expect(linesToLrc(lines)).toBe('[00:01.00]earlier\n[00:05.00]later');
  });

  it('returns an empty string for no lines', () => {
    expect(linesToLrc([])).toBe('');
  });
});

describe('linesToSrt', () => {
  it('formats a single cue with a 1-indexed number and HH:MM:SS,mmm timestamps', () => {
    const lines = [line(1.5, 3.25, ['Hello', 'world'])];
    expect(linesToSrt(lines)).toBe('1\n00:00:01,500 --> 00:00:03,250\nHello world\n');
  });

  it('formats multiple cues blank-line separated, 1-indexed in order', () => {
    const lines = [line(0, 1, ['One']), line(1, 2.4, ['Two', 'words'])];
    expect(linesToSrt(lines)).toBe(
      '1\n00:00:00,000 --> 00:00:01,000\nOne\n\n2\n00:00:01,000 --> 00:00:02,400\nTwo words\n'
    );
  });

  it('rolls over hours correctly', () => {
    const lines = [line(3661, 3663, ['hour', 'rollover'])];
    expect(linesToSrt(lines)).toBe('1\n01:01:01,000 --> 01:01:03,000\nhour rollover\n');
  });

  it('returns an empty string for no lines', () => {
    expect(linesToSrt([])).toBe('');
  });
});

describe('recorderCandidates', () => {
  it('lists MP4 variants before WebM variants', () => {
    const ids = recorderCandidates().map((c) => c.id);
    expect(ids.indexOf('mp4-avc')).toBeLessThan(ids.indexOf('webm-vp9'));
  });
});

describe('pickRecorderFormat', () => {
  it('prefers MP4/H.264 with an AAC audio codec when everything is supported', () => {
    const format = pickRecorderFormat(() => true, true);
    expect(format.ext).toBe('mp4');
    expect(format.mimeType).toBe('video/mp4;codecs=avc1.42E01E,mp4a.40.2');
  });

  it('falls back to WebM when only the plain WebM/VP9 type is supported (e.g. Firefox)', () => {
    const format = pickRecorderFormat((type) => type === 'video/webm;codecs=vp9', true);
    expect(format.ext).toBe('webm');
    expect(format.mimeType).toBe('video/webm;codecs=vp9');
  });

  it('does not append an audio codec when audio is not requested', () => {
    const format = pickRecorderFormat(() => true, false);
    expect(format.mimeType).toBe('video/mp4;codecs=avc1.42E01E');
  });

  it('returns null when nothing is supported or the check throws', () => {
    expect(pickRecorderFormat(() => false, true)).toBe(null);
    expect(
      pickRecorderFormat(() => {
        throw new Error('nope');
      }, true)
    ).toBe(null);
    expect(pickRecorderFormat(undefined, true)).toBe(null);
  });
});
