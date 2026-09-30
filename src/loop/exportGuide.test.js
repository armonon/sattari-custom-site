import { describe, expect, it } from 'vitest';
import { midiGuide, downloadPracticeGuide } from './exportGuide';
import { DEMO } from './music';
import { waitForScores } from './printGuide';

function readEvents(bytes) {
  const view = new DataView(bytes.buffer);
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('MThd');
  expect(view.getUint16(8)).toBe(0);
  expect(view.getUint16(12)).toBe(480);
  expect(view.getUint32(18)).toBe(bytes.length - 22);
  let cursor = 22,
    tick = 0;
  const events = [];
  while (cursor < bytes.length) {
    let delta = 0,
      byte;
    do {
      byte = bytes[cursor++];
      delta = delta * 128 + (byte & 127);
    } while (byte & 128);
    tick += delta;
    const status = bytes[cursor++];
    if (status === 255) {
      cursor++;
      const length = bytes[cursor++];
      cursor += length;
    } else if (status === 192) cursor++;
    else {
      events.push({ tick, status, midi: bytes[cursor++] });
      cursor++;
    }
  }
  return events;
}

describe('portable practice guides', () => {
  it('preserves independent note-off times and simultaneous note-ons in MIDI', () => {
    const events = readEvents(
      midiGuide({
        notes: [],
        polyphonicNotes: [
          { midi: 48, start: 0.5, end: 2 },
          { midi: 52, start: 0.5, end: 1 },
          { midi: 52, start: 1, end: 1.5 },
        ],
      })
    );
    expect(events).toEqual([
      { tick: 480, status: 144, midi: 48 },
      { tick: 480, status: 144, midi: 52 },
      { tick: 960, status: 128, midi: 52 },
      { tick: 960, status: 144, midi: 52 },
      { tick: 1440, status: 128, midi: 52 },
      { tick: 1920, status: 128, midi: 48 },
    ]);
  });
  it('exports chord tones and marks impossible fingerings instead of inventing tabs', () => {
    const text = downloadPracticeGuide({
      ...DEMO,
      polyphonicNotes: [40, 41].map((midi) => ({ midi, start: 0, end: 1 })),
    });
    expect(text).toContain('CHORD CHART');
    expect(text).toContain('CHORD TONES');
    expect(text).toContain('E2 (0.00–1.00s)');
    expect(text).toContain('No playable six-string shape');
  });
});

it('waits for every lazy staff before allowing print', async () => {
  const root = document.createElement('div');
  root.innerHTML = '<div data-score-ready="pending"></div><div data-score-ready="pending"></div>';
  let done = false;
  const result = waitForScores(root, 2).then(() => {
    done = true;
  });
  root.children[0].dataset.scoreReady = 'ready';
  await Promise.resolve();
  expect(done).toBe(false);
  root.children[1].dataset.scoreReady = 'ready';
  await result;
  expect(done).toBe(true);
});

it('reports failed engraving and cancels pending print work', async () => {
  const root = document.createElement('div');
  root.innerHTML = '<div data-score-ready="error"></div>';
  await expect(waitForScores(root, 1)).rejects.toThrow('could not finish');
  root.replaceChildren();
  const controller = new AbortController();
  const result = waitForScores(root, 1, controller.signal);
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: 'AbortError' });
});
