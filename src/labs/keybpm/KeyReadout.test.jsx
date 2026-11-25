import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

beforeEach(() => {
  oscillators = [];
  const param = () => ({
    value: 0,
    setTargetAtTime() {},
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  vi.stubGlobal(
    'AudioContext',
    class {
      currentTime = 0;
      destination = {};
      resume() {}
      close() {
        return Promise.resolve();
      }
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
  vi.unstubAllGlobals();
});

const setup = (user = undefined, props = {}) => {
  const onCorrect = vi.fn();
  render(
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

it('plays a drone on the tonic and stops it, and the T key taps the tempo', () => {
  setup();
  const drone = screen.getByRole('button', { name: 'Drone on A' });
  fireEvent.click(drone);
  expect(drone).toHaveAttribute('aria-pressed', 'true');
  expect(oscillators.map((osc) => Math.round(osc.frequency.value))).toEqual([110, 165, 220]);
  fireEvent.click(drone);
  expect(drone).toHaveAttribute('aria-pressed', 'false');
  expect(oscillators[0].stop).toHaveBeenCalled();
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
