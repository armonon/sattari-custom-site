import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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
