/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { crossfaderGains, masterAssistProfile } from './studioAudioEngine';

describe('crossfaderGains', () => {
  it('fully isolates each side at the endpoints', () => {
    expect(crossfaderGains(0, 'Smooth')).toEqual({ left: 1, right: 0 });
    expect(crossfaderGains(100, 'Linear').left).toBe(0);
    expect(crossfaderGains(100, 'Linear').right).toBe(1);
  });

  it('uses equal-power gain at the smooth midpoint', () => {
    const midpoint = crossfaderGains(50, 'Smooth');
    expect(midpoint.left).toBeCloseTo(Math.SQRT1_2, 5);
    expect(midpoint.right).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it('keeps both decks louder through the sharp transition', () => {
    const smooth = crossfaderGains(50, 'Smooth');
    const sharp = crossfaderGains(50, 'Sharp');
    expect(sharp.left).toBeGreaterThan(smooth.left);
    expect(sharp.right).toBeGreaterThan(smooth.right);
  });
});

describe('masterAssistProfile', () => {
  it('keeps the bypass threshold inside the compressor decibel range', () => {
    const bypass = masterAssistProfile(false);
    expect(bypass.threshold).toBeLessThan(0);
    expect(bypass.ratio).toBe(1);
  });

  it('selects the requested mastering target', () => {
    expect(masterAssistProfile(true, 'Club -9')).toMatchObject({ threshold: -12, ratio: 3.4 });
  });
});
