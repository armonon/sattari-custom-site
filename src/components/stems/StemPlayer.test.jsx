import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StemPlayer from './StemPlayer';
import { wavBytes } from '../../utils/arrangementExport';
import { parseWav } from '../../utils/stemMix';

const RATE = 44100;
const FRAMES = 4410; // 0.1 s
const LEVEL = { vocals: 0.1, drums: 0.02, bass: 0.004, other: 0.0008 };
const wav = (value, frames = FRAMES) => {
  const data = new Float32Array(frames).fill(value);
  return new Blob(
    [
      wavBytes(
        { numberOfChannels: 2, length: frames, sampleRate: RATE, getChannelData: () => data },
        true
      ),
    ],
    { type: 'audio/wav' }
  );
};
const stems = (frames = FRAMES) =>
  ['vocals', 'drums', 'bass', 'other'].map((id) => ({
    id,
    label: id,
    color: '#fff',
    blob: wav(LEVEL[id], frames),
    url: `blob:${id}`,
    name: `song-${id}.wav`,
    peaks: new Float32Array(16).fill(LEVEL[id]),
  }));

let contexts;
let downloads;
class FakeParam {
  constructor(value = 1) {
    this.value = value;
  }
  setTargetAtTime(value) {
    this.value = value;
  }
}
class FakeContext {
  constructor() {
    this.currentTime = 10;
    this.sources = [];
    this.gains = [];
    this.destination = { id: 'destination' };
    contexts.push(this);
  }
  createGain() {
    const node = { gain: new FakeParam(1), connect: (target) => (node.target = target) };
    node.gain.setValueAtTime = () => {};
    node.gain.exponentialRampToValueAtTime = () => {};
    this.gains.push(node);
    return node;
  }
  createBuffer(channels, length, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return {
      sampleRate,
      length,
      duration: length / sampleRate,
      copyToChannel: (array, index) => data[index].set(array),
      getChannelData: (index) => data[index],
    };
  }
  createBufferSource() {
    const source = {
      connect: (target) => (source.target = target),
      start: (when, offset) => Object.assign(source, { when, offset, started: true }),
      stop: () => (source.stopped = true),
    };
    this.sources.push(source);
    return source;
  }
  createOscillator() {
    const osc = {
      frequency: { value: 0 },
      connect: () => {},
      start: (when) => Object.assign(osc, { when }),
      stop: () => {},
    };
    (this.clicks ||= []).push(osc);
    return osc;
  }
  async decodeAudioData() {
    return this.createBuffer(2, FRAMES, 48000);
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  contexts = [];
  downloads = [];
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  URL.createObjectURL = vi.fn((blob) => {
    downloads.push(blob);
    return `blob:${downloads.length}`;
  });
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setup = async (props = {}) => {
  const onEvent = vi.fn();
  render(
    <StemPlayer
      trackName="Song.wav"
      fileBase="Song"
      stems={stems(props.frames)}
      original={{ blob: new Blob(['original']), peaks: new Float32Array(8) }}
      onEvent={onEvent}
      {...props}
    />
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled());
  return { onEvent, context: contexts[0] };
};
const laneGains = (context) => context.gains.slice(1, 5).map((node) => node.gain.value);

it('starts every lane on one clock and offset, and counts preview once', async () => {
  const { context, onEvent } = await setup();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
  expect(context.sources).toHaveLength(4);
  expect(new Set(context.sources.map((source) => source.when)).size).toBe(1);
  expect(new Set(context.sources.map((source) => source.offset)).size).toBe(1);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
  expect(onEvent.mock.calls.filter(([type]) => type === 'preview')).toHaveLength(1);
});

it('applies practice presets, solo and mute to the same gains the export uses', async () => {
  const { context } = await setup({ initialPreset: 'no-drums' });
  await waitFor(() => expect(laneGains(context)).toEqual([1, 0, 1, 1]));
  expect(screen.getByRole('button', { name: 'Drum practice' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await act(async () =>
    fireEvent.click(screen.getByRole('button', { name: 'Vocal backing track' }))
  );
  expect(laneGains(context)).toEqual([0, 1, 1, 1]);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Solo bass' })));
  expect(laneGains(context)).toEqual([0, 0, 1, 0]);
  expect(screen.getByRole('button', { name: 'Solo bass' })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps the original reference exclusive from the stem mix', async () => {
  const { context } = await setup();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Original song' })));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Original song' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  );
  expect(laneGains(context)).toEqual([0, 0, 0, 0]);
  const original = context.gains[5];
  expect(original.gain.value).toBe(1);
  expect(original.target).toBe(context.destination);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stem mix' })));
  expect(original.gain.value).toBe(0);
  expect(laneGains(context)).toEqual([1, 1, 1, 1]);
});

it('downloads a WAV that matches the selected preview settings', async () => {
  const { onEvent } = await setup({ initialPreset: 'no-bass' });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download my mix' })));
  await waitFor(() => expect(onEvent).toHaveBeenCalledWith('mix_exported', expect.any(Object)));
  const [, result] = onEvent.mock.calls.find(([type]) => type === 'mix_exported');
  expect(result.name).toBe('Song-bassless-mix.wav');
  expect(result.audible).toEqual(['vocals', 'drums', 'other']);
  const parsed = parseWav(await downloads.at(-1).arrayBuffer());
  expect(parsed.sampleRate).toBe(RATE);
  expect(parsed.channels[0]).toHaveLength(FRAMES);
  expect(parsed.channels[1][FRAMES - 1]).toBeCloseTo(LEVEL.vocals + LEVEL.drums + LEVEL.other, 5);
  expect(screen.getByText(/Song-bassless-mix.wav/)).toBeInTheDocument();
});

it('refuses to export when every part is muted', async () => {
  await setup();
  for (const id of ['vocals', 'drums', 'bass', 'other'])
    await act(async () => fireEvent.click(screen.getByRole('button', { name: `Mute ${id}` })));
  expect(screen.getByRole('button', { name: 'Download my mix' })).toBeDisabled();
  expect(screen.getByText('Unmute at least one part to render a mix.')).toBeInTheDocument();
});

it('loops every lane between A and B and clears the loop', async () => {
  const { context } = await setup({ frames: RATE * 2 });
  const position = screen.getByLabelText('Playback position');
  await act(async () => fireEvent.change(position, { target: { value: '0.5' } }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Set A/ })));
  await act(async () => fireEvent.change(position, { target: { value: '0.6' } }));
  // Shorter than the minimum loop length is refused.
  expect(screen.getByRole('button', { name: /^Set B/ })).toBeDisabled();
  await act(async () => fireEvent.change(position, { target: { value: '1.5' } }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Set B/ })));
  expect(screen.getByRole('button', { name: /^Set B/ })).toHaveTextContent('0:01');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
  // Outside the loop, playback starts at A; every lane loops the same region.
  expect(context.sources).toHaveLength(4);
  for (const source of context.sources) {
    expect(source).toMatchObject({ loop: true, loopStart: 0.5, loopEnd: 1.5, offset: 0.5 });
  }
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Clear loop' })));
  const restarted = context.sources.slice(4);
  expect(restarted).toHaveLength(4);
  for (const source of restarted) expect(source.loop).toBeUndefined();
  expect(screen.getByRole('button', { name: /^Set A/ })).toHaveTextContent(/^Set A$/);
});

it('exports only the A–B loop when chosen, aligned to the loop start', async () => {
  const { onEvent } = await setup({ frames: RATE * 2, initialPreset: 'no-drums' });
  const position = screen.getByLabelText('Playback position');
  await act(async () => fireEvent.change(position, { target: { value: '0.5' } }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Set A/ })));
  await act(async () => fireEvent.change(position, { target: { value: '1.5' } }));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Set B/ })));
  await act(async () =>
    fireEvent.change(screen.getByLabelText('Length of the mix'), { target: { value: 'loop' } })
  );
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download my mix' })));
  await waitFor(() => expect(onEvent).toHaveBeenCalledWith('mix_exported', expect.any(Object)));
  const [, result] = onEvent.mock.calls.find(([type]) => type === 'mix_exported');
  expect(result.name).toBe('Song-drumless-loop-0m01s-0m02s.wav');
  expect(result.frames).toBe(RATE);
  const parsed = parseWav(await downloads.at(-1).arrayBuffer());
  expect(parsed.channels[0]).toHaveLength(RATE);
});

describe('practice speed and key', () => {
  beforeEach(async () => {
    const { stretchStems } = await import('../../utils/timeStretch');
    // Run the real stretch synchronously in place of the worker.
    vi.stubGlobal(
      'Worker',
      class {
        postMessage({ stems, alpha }) {
          if (!stems) return; // beat-grid worker: report no grid
          queueMicrotask(() => this.onmessage({ data: { result: stretchStems(stems, alpha) } }));
        }
        terminate() {}
      }
    );
  });

  it('plays stretched stems at the pitch rate, aligned on song time, and exports at the new speed', async () => {
    const { context, onEvent } = await setup({ frames: RATE, initialPreset: 'no-drums' });
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Playback speed'), { target: { value: '0.5' } })
    );
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Transpose up a semitone' }))
    );
    await waitFor(() => expect(screen.getByText(/Practice playback/)).toBeInTheDocument(), {
      timeout: 5000,
    });
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Playback position'), { target: { value: '0.5' } })
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
    const alpha = 2 ** (1 / 12) / 0.5;
    const sources = context.sources.slice(-4);
    for (const source of sources) {
      expect(source.offset).toBeCloseTo(0.5 * alpha, 6);
      expect(source.buffer.length).toBe(Math.round(RATE * alpha));
    }
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    await act(async () => fireEvent.click(screen.getByLabelText(/Use my speed/)));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download my mix' })));
    await waitFor(() => expect(onEvent).toHaveBeenCalledWith('mix_exported', expect.any(Object)));
    const [, result] = onEvent.mock.calls.find(([type]) => type === 'mix_exported');
    expect(result.name).toBe('Song-50pct-up1st-drumless-mix.wav');
    // Half speed doubles the length; the key change does not alter it.
    expect(Math.abs(result.frames - 2 * RATE)).toBeLessThanOrEqual(2);
  });

  it('turns practice off at the original speed and key', async () => {
    const { context } = await setup({ frames: RATE });
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Playback speed'), { target: { value: '0.75' } })
    );
    await waitFor(() => expect(screen.getByText(/Practice playback/)).toBeInTheDocument(), {
      timeout: 5000,
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reset' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
    for (const source of context.sources.slice(-4)) expect(source.buffer.length).toBe(RATE);
  });
});

describe('beat tools', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'Worker',
      class {
        postMessage({ samples }) {
          if (!samples) return;
          const beats = Array.from({ length: 16 }, (_, i) => i * 0.25); // 240 BPM
          queueMicrotask(() =>
            this.onmessage({ data: { grid: { usable: true, beats, bpm: 240 } } })
          );
        }
        terminate() {}
      }
    );
  });

  it('counts in one bar before the music and loops whole bars from the playhead', async () => {
    const { context } = await setup({ frames: RATE * 4 });
    await waitFor(() => expect(screen.getByText(/Beat grid · 240 BPM/)).toBeInTheDocument());
    await act(async () => fireEvent.click(screen.getByLabelText('Count-in (1 bar)')));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
    const clicks = context.clicks.map((osc) => osc.when);
    const start = context.sources[0].when;
    expect(clicks).toHaveLength(4);
    expect(start - clicks[0]).toBeCloseTo(1, 6); // 4 beats at 240 BPM
    expect(clicks[0] < clicks[3] && clicks[3] < start).toBe(true);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Playback position'), { target: { value: '1.6' } })
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: '2 bars' })));
    expect(screen.getByRole('button', { name: /^Set A/ })).toHaveTextContent('0:01');
    expect(
      screen.getByLabelText('Length of the mix').querySelector('[value="loop"]')
    ).toHaveTextContent('0:01–0:03');
  });

  it('snaps A and B to the nearest beat', async () => {
    const { onEvent } = await setup({ frames: RATE * 4 });
    await waitFor(() => expect(screen.getByText(/Beat grid/)).toBeInTheDocument());
    const position = screen.getByLabelText('Playback position');
    await act(async () => fireEvent.change(position, { target: { value: '0.61' } }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Set A/ })));
    await act(async () => fireEvent.change(position, { target: { value: '1.4' } }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Set B/ })));
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Length of the mix'), { target: { value: 'loop' } })
    );
    // 0.61 → 0.5 and 1.4 → 1.5 on the 0.25 s grid: exactly one second.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download my mix' })));
    await waitFor(() => expect(onEvent).toHaveBeenCalledWith('mix_exported', expect.any(Object)));
    const [, result] = onEvent.mock.calls.find(([type]) => type === 'mix_exported');
    expect(result.frames).toBe(RATE);
  });
});

describe('practice memory', () => {
  const saved = () => ({
    v: 1,
    mix: {
      lanes: {
        vocals: { gain: 1, muted: false, solo: false },
        drums: { gain: 1, muted: true, solo: false },
        bass: { gain: 0.5, muted: false, solo: false },
        other: { gain: 1, muted: false, solo: false },
      },
      master: 1,
    },
    speed: 1,
    semitones: 0,
    loop: { a: 0.5, b: 1.5 },
    sections: [
      { id: 'a', name: 'Verse', a: 0.5, b: 1.5 },
      { id: 'b', name: 'Solo', a: 1, b: 1.8 },
      { id: 'gone', name: 'Past the end', a: 5, b: 9 },
    ],
    click: false,
    countIn: false,
    snap: false,
    barOffset: 0,
    headroom: 'prevent-clipping',
  });

  it('restores a saved setup and drops loops that do not fit the audio', async () => {
    const { context } = await setup({ frames: RATE * 2, initialPractice: saved() });
    expect(screen.getByRole('button', { name: 'Mute drums' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(laneGains(context)).toEqual([1, 0, 0.5, 1]);
    expect(screen.getByRole('button', { name: /^Set A/ })).toHaveTextContent('0:00');
    expect(screen.getByLabelText(/Prevent clipping/)).toBeChecked();
    expect(screen.getByLabelText('Name of saved loop 1')).toHaveValue('Verse');
    expect(screen.getByLabelText('Name of saved loop 2')).toHaveValue('Solo');
    expect(screen.queryByLabelText('Name of saved loop 3')).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
    for (const source of context.sources)
      expect(source).toMatchObject({ loop: true, loopStart: 0.5, loopEnd: 1.5, offset: 0.5 });
  });

  it('ignores a damaged saved setup', async () => {
    const { context } = await setup({ initialPractice: { v: 1, mix: 'nope', speed: 'fast' } });
    expect(laneGains(context)).toEqual([1, 1, 1, 1]);
    expect(screen.getByLabelText('Playback speed')).toHaveValue('1');
  });

  it('reports changes, and saves, renames, recalls and removes loops', async () => {
    const onPracticeChange = vi.fn();
    const { context } = await setup({ frames: RATE * 2, onPracticeChange });
    expect(onPracticeChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save this loop' })).toBeDisabled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mute bass' })));
    expect(onPracticeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ v: 1, loop: null, sections: [] })
    );
    expect(onPracticeChange.mock.lastCall[0].mix.lanes.bass.muted).toBe(true);

    const position = screen.getByLabelText('Playback position');
    await act(async () => fireEvent.change(position, { target: { value: '0.5' } }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Set A/ })));
    await act(async () => fireEvent.change(position, { target: { value: '1.5' } }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Set B/ })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save this loop' })));
    // The same loop is not saved twice.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save this loop' })));
    expect(onPracticeChange.mock.lastCall[0].sections).toHaveLength(1);

    const name = screen.getByLabelText('Name of saved loop 1');
    expect(name).toHaveValue('Loop 1');
    await act(async () => {
      fireEvent.change(name, { target: { value: '  Chorus  ' } });
      fireEvent.blur(name);
    });
    expect(onPracticeChange.mock.lastCall[0].sections[0]).toMatchObject({
      name: 'Chorus',
      a: 0.5,
      b: 1.5,
    });

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Clear loop' })));
    expect(onPracticeChange.mock.lastCall[0].loop).toBeNull();
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: /^Loop Chorus, 0:00 to 0:01/ }))
    );
    expect(onPracticeChange.mock.lastCall[0].loop).toEqual({ a: 0.5, b: 1.5 });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Play' })));
    for (const source of context.sources.slice(-4))
      expect(source).toMatchObject({ loop: true, loopStart: 0.5, loopEnd: 1.5, offset: 0.5 });

    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Remove saved loop Chorus' }))
    );
    expect(onPracticeChange.mock.lastCall[0].sections).toEqual([]);
  });

  it('keyboard shortcuts play, loop and recall, but never while typing', async () => {
    const onPracticeChange = vi.fn();
    const { context } = await setup({
      frames: RATE * 2,
      onPracticeChange,
      initialPractice: { ...saved(), loop: null, snap: false },
    });
    const press = (key, target = document.body) =>
      act(async () => fireEvent.keyDown(target, { key, code: key === ' ' ? 'Space' : key }));

    await press(' ');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(context.sources).toHaveLength(4);
    await press(' ');
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();

    await press('2');
    expect(onPracticeChange.mock.lastCall[0].loop).toEqual({ a: 1, b: 1.8 });
    await press('\\');
    expect(onPracticeChange.mock.lastCall[0].loop).toBeNull();

    const position = screen.getByLabelText('Playback position');
    await act(async () => fireEvent.change(position, { target: { value: '0.25' } }));
    await press('[');
    await act(async () => fireEvent.change(position, { target: { value: '1.25' } }));
    await press(']');
    expect(onPracticeChange.mock.lastCall[0].loop).toEqual({ a: 0.25, b: 1.25 });

    // Typing a loop name must not trigger shortcuts.
    const calls = onPracticeChange.mock.calls.length;
    await press('\\', screen.getByLabelText('Name of saved loop 1'));
    await press(' ', screen.getByLabelText('Name of saved loop 1'));
    expect(onPracticeChange.mock.calls.length).toBe(calls);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    // Space on a button keeps its normal meaning (no double toggle).
    await press(' ', screen.getByRole('button', { name: 'Mute drums' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('a preview player has no saved loops or shortcuts', async () => {
    await setup({ previewOnly: true });
    await act(async () => fireEvent.keyDown(document.body, { key: ' ', code: 'Space' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save this loop' })).toBeNull();
  });
});
