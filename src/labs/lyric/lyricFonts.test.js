import { describe, expect, it } from 'vitest';
import { fontFamilyStack, safeFontFamilyName } from './lyricFonts';

describe('safeFontFamilyName', () => {
  it('strips the extension and sanitizes special characters', () => {
    expect(safeFontFamilyName('Glyph Studio Export.woff2')).toBe('lyric-font-Glyph-Studio-Export');
  });

  it('falls back to "custom" for an empty or missing filename', () => {
    expect(safeFontFamilyName('')).toBe('lyric-font-custom');
    expect(safeFontFamilyName(undefined)).toBe('lyric-font-custom');
  });

  it('trims leading/trailing dashes left over from sanitizing', () => {
    expect(safeFontFamilyName('__My Font__.ttf')).toBe('lyric-font-My-Font');
  });
});

describe('fontFamilyStack', () => {
  it('puts the custom family first, ahead of the fallback stack', () => {
    const stack = fontFamilyStack('lyric-font-My-Font');
    expect(stack.startsWith('"lyric-font-My-Font"')).toBe(true);
    expect(stack).toContain('system-ui');
  });

  it('is just the fallback stack when no custom family is given', () => {
    expect(fontFamilyStack(null)).not.toContain('lyric-font');
    expect(fontFamilyStack(undefined)).toContain('system-ui');
  });
});
