import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import KeyReadout from './KeyReadout';

const result = {
  file: 'groove.wav',
  status: 'done',
  duration: 180,
  key: 'A minor',
  camelot: '8A',
  keyConfidence: 0.05,
  keyEvidence: 'tentative',
  alternative: 'C major',
  bpm: 120,
  tempoEvidence: 'supported',
  rmsDb: -18,
  peakDb: -1,
  note: '',
};
const row = (user) => ({ id: 'r1', file: new File(['a'], 'groove.wav'), result, user });
const idle = { id: null, playing: false, time: 0, duration: 0 };
let oscillators;
let contexts;

beforeEach(() => {
  oscillators = [];
  contexts = [];
  const param = () => ({
    value: 0,
    setTargetAtTime() {},
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        contexts.push(this);
      }
      state = 'running';
      get currentTime() {
        return performance.now() / 1000;
      }
      destination = {};
      resume() {}
      close = vi.fn(async () => {
        this.state = 'closed';
      });
      createGain() {
        return { gain: param(), connect() {} };
      }
      createBiquadFilter() {
        return { frequency: param(), connect() {} };
      }
      createOscillator() {
        const osc = { frequency: param(), connect() {}, start() {}, stop: vi.fn() };
        oscillators.push(osc);
        return osc;
      }
    }
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const setup = (user = undefined, props = {}) => {
  const onCorrect = vi.fn();
  render(
    <MemoryRouter>
      <KeyReadout
        row={row(user)}
        audition={idle}
        playable
        onToggleAudition={() => {}}
        onSeek={() => {}}
        onCorrect={onCorrect}
        onSeparate={() => {}}
        {...props}
      />
    </MemoryRouter>
  );
  return onCorrect;
};

it('shows the key on the circle of fifths with its second choice and evidence', () => {
  setup();
  expect(screen.getByLabelText('A minor')).toHaveTextContent('Aminor');
  expect(screen.getByRole('img', { name: /A minor, alternative C major/ })).toBeInTheDocument();
  expect(screen.getByText('tentative')).toBeInTheDocument();
  expect(screen.getByText('relative C major')).toBeInTheDocument();
  expect(screen.getByText(/a close call/)).toBeInTheDocument();
});

it('stores a half-time choice and notes as corrections, never changing the detection', () => {
  const onCorrect = setup();
  fireEvent.click(screen.getByRole('button', { name: /60\s*half time/ }));
  expect(onCorrect.mock.calls[0][0]).toMatchObject({ bpm: 60, bpmChoice: 'half' });
  fireEvent.change(screen.getByLabelText('Your notes'), { target: { value: 'Count in 2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(onCorrect.mock.calls[1][0]).toMatchObject({ notes: 'Count in 2', bpm: null });
  expect(result.bpm).toBe(120);
});

it('plays a drone on the tonic and stops it, and the T key taps the tempo', async () => {
  setup();
  const drone = screen.getByRole('button', { name: 'Drone on A' });
  fireEvent.click(drone);
  await waitFor(() => expect(drone).toHaveAttribute('aria-pressed', 'true'));
  expect(oscillators.map((osc) => Math.round(osc.frequency.value))).toEqual([110, 165, 220]);
  fireEvent.click(drone);
  expect(drone).toHaveAttribute('aria-pressed', 'false');
  await waitFor(() => expect(oscillators[0].stop).toHaveBeenCalled());
  const now = vi.spyOn(performance, 'now');
  [0, 500, 1000, 1500].forEach((t) => {
    now.mockReturnValue(t);
    fireEvent.keyDown(window, { key: 't' });
  });
  expect(screen.getByText('120 BPM from 4 taps')).toBeInTheDocument();
  now.mockRestore();
});

it('skips an enharmonic duplicate when offering a second tonic to audition', () => {
  const source = row({ key: 'Bb major' });
  source.result = { ...source.result, key: 'A# major', camelot: '6B', alternative: 'G minor' };
  setup(undefined, { row: source });
  expect(screen.getByRole('button', { name: 'Drone on B♭' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Drone on the second choice (G minor)' })
  ).toBeInTheDocument();
});

it('reports unavailable output and releases a context that rejects resume', async () => {
  setup();
  const button = screen.getByRole('button', { name: 'Drone on A' });
  const Base = window.AudioContext;
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        throw new Error('Device unavailable');
      }
    }
  );
  fireEvent.click(button);
  expect(screen.getByRole('alert')).toHaveTextContent(/check your audio output/i);
  vi.stubGlobal(
    'AudioContext',
    class extends Base {
      state = 'suspended';
      resume() {
        return Promise.reject(new Error('Output denied'));
      }
    }
  );
  fireEvent.click(button);
  await waitFor(() => expect(contexts[0].close).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('alert')).toHaveTextContent(/tap the tone again/i);
  expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(oscillators).toHaveLength(0);
});

it('ignores a late startup failure after a different tone starts, and releases on pagehide', async () => {
  setup();
  let reject;
  const Base = window.AudioContext;
  vi.stubGlobal(
    'AudioContext',
    class extends Base {
      state = 'suspended';
      resume() {
        return new Promise((_, no) => {
          reject = no;
        });
      }
    }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Drone on A' }));
  vi.stubGlobal('AudioContext', Base);
  const alternative = screen.getByRole('button', { name: /Drone on the second choice/ });
  fireEvent.click(alternative);
  await act(async () => {
    reject(new Error('Superseded'));
  });
  await waitFor(() => expect(alternative).toHaveAttribute('aria-pressed', 'true'));
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(contexts[1].close).toHaveBeenCalledTimes(1);
  expect(alternative).toHaveAttribute('aria-pressed', 'false');
});

it('closes the scale context after the last note and disposes a frozen output', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Play the A minor scale' }));
  expect(oscillators).toHaveLength(8);
  act(() => oscillators[7].onended());
  expect(contexts[0].close).toHaveBeenCalledTimes(1);
  vi.useFakeTimers();
  const Base = window.AudioContext;
  vi.stubGlobal(
    'AudioContext',
    class extends Base {
      get currentTime() {
        return 0;
      }
    }
  );
  const button = screen.getByRole('button', { name: 'Drone on A' });
  fireEvent.click(button);
  act(() => vi.advanceTimersByTime(4250));
  expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(contexts[1].close).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('alert')).toHaveTextContent(/check your audio output/i);
});

it('lists the chords and compatible keys, and clicks at the shown tempo', () => {
  setup({ bpm: 60, bpmChoice: 'half', editedAt: '2026-11-26T00:00:00.000Z' });
  const chords = screen.getByRole('list', { name: 'Chords in A minor' });
  expect(chords).toHaveTextContent('Ami');
  expect(chords.querySelectorAll('li')).toHaveLength(7);
  expect(screen.getByRole('list', { name: 'Compatible keys' })).toHaveTextContent('C major · 8B');
  const click = screen.getByRole('button', { name: 'Click at 60 BPM' });
  const before = oscillators.length;
  fireEvent.click(click);
  expect(screen.getByRole('button', { name: 'Stop the click' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(oscillators.length).toBeGreaterThan(before);
  fireEvent.click(screen.getByRole('button', { name: 'Stop the click' }));
  expect(screen.getByRole('button', { name: 'Click at 60 BPM' })).toBeInTheDocument();
});

it('copies the shown result as one line', async () => {
  const writeText = vi.fn().mockResolvedValue();
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Copy result' }));
  expect(writeText).toHaveBeenCalledWith('A minor · 8A · 120 BPM');
  expect(await screen.findByText('Copied')).toBeInTheDocument();
});
