// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearToolHandoff,
  HANDOFF_MAX_AGE_MS,
  offerToolHandoff,
  peekToolHandoff,
  takeToolHandoff,
} from './toolHandoff';

const file = new Blob(['x'], { type: 'audio/wav' });
afterEach(clearToolHandoff);

describe('same-tab tool handoff', () => {
  it('is consumed once, only by its destination', () => {
    offerToolHandoff({
      target: 'keybpm',
      from: 'Stem Separator',
      file,
      kind: 'stem',
      label: 'Bass',
    });
    expect(takeToolHandoff('separator')).toBeNull();
    expect(takeToolHandoff('keybpm')).toMatchObject({ kind: 'stem', label: 'Bass' });
    expect(takeToolHandoff('keybpm')).toBeNull();
  });
  it('expires so a stale transfer is never shown as current', () => {
    offerToolHandoff({ target: 'separator', from: 'Key & BPM', file, kind: 'original' }, 0);
    expect(peekToolHandoff('separator', HANDOFF_MAX_AGE_MS + 1)).toBeNull();
    expect(takeToolHandoff('separator', 1)).toBeNull();
  });
  it('a newer offer replaces an older one', () => {
    offerToolHandoff({ target: 'keybpm', from: 'A', file, kind: 'original', label: 'old' });
    offerToolHandoff({ target: 'keybpm', from: 'A', file, kind: 'mix', label: 'new' });
    expect(takeToolHandoff('keybpm').label).toBe('new');
  });
  it('keeps user choices labelled and drops invalid metadata', () => {
    const offer = offerToolHandoff({
      target: 'separator',
      from: 'Key & BPM',
      file,
      kind: 'original',
      user: { key: 'A minor', bpm: 70 },
      detected: { key: 'A minor', bpm: -1 },
    });
    expect(offer.user).toEqual({ key: 'A minor', bpm: 70 });
    expect(offer.detected).toBeNull();
  });
  it('requires a real file and a known source kind', () => {
    expect(() => offerToolHandoff({ target: 'keybpm', file: null, kind: 'stem' })).toThrow();
    expect(() => offerToolHandoff({ target: 'keybpm', file, kind: 'guess' })).toThrow();
    expect(() => offerToolHandoff({ target: 'elsewhere', file, kind: 'stem' })).toThrow();
  });
});
