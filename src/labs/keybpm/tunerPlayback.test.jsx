import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import InstrumentTuner from './InstrumentTuner';

afterEach(() => vi.unstubAllGlobals());

function audioFixture() {
  const contexts = [];
  vi.stubGlobal(
    'AudioContext',
    class {
      currentTime = 0;
      state = 'running';
      destination = {};
      oscillators = [];
      gains = [];
      constructor() {
        contexts.push(this);
      }
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn(async () => {
        this.state = 'closed';
      });
      createOscillator() {
        const oscillator = {
          frequency: { value: 0, setTargetAtTime: vi.fn() },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        this.oscillators.push(oscillator);
        return oscillator;
      }
      createGain() {
        const gain = {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            setTargetAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
        this.gains.push(gain);
        return gain;
      }
    }
  );
  return contexts;
}

const button = (name) => screen.getByRole('button', { name });
const click = (name) => fireEvent.click(button(name));
const select = (name, value) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
function renderTuner() {
  return render(
    <MemoryRouter>
      <InstrumentTuner />
    </MemoryRouter>
  );
}

it('holds an open-string reference until Stop, and retunes the same voice as the player changes settings', () => {
  const contexts = audioFixture();
  renderTuner();
  expect(contexts).toHaveLength(0);
  click('Hear E2');
  const [audio] = contexts;
  const [voice] = audio.oscillators;
  const [envelope] = audio.gains;
  expect(voice.frequency.value).toBeCloseTo(82.4069, 3);
  expect(voice.start).toHaveBeenCalledOnce();
  expect(envelope.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1);
  expect(envelope.gain.linearRampToValueAtTime.mock.calls[0][0]).toBeGreaterThan(0);
  audio.currentTime = 30;
  expect(voice.stop).not.toHaveBeenCalled();
  expect(audio.close).not.toHaveBeenCalled();
  const strings = screen.getByRole('group', { name: 'Choose a string' });
  fireEvent.click(within(strings).getByRole('button', { name: /A2/ }));
  expect(voice.frequency.setTargetAtTime).toHaveBeenLastCalledWith(110, 30, expect.any(Number));
  select('Concert A', '442');
  expect(voice.frequency.setTargetAtTime).toHaveBeenLastCalledWith(110.5, 30, expect.any(Number));
  select('Instrument', 'violin');
  expect(voice.frequency.setTargetAtTime.mock.lastCall[0]).toBeCloseTo(196.888, 2);
  expect(contexts).toHaveLength(1);
  expect(audio.oscillators).toHaveLength(1);
  click('Stop reference sound');
  expect(button('Hear G3')).toBeEnabled();
  expect(voice.stop).toHaveBeenCalledWith(30.025);
  expect(envelope.gain.setTargetAtTime).toHaveBeenCalledWith(0, 30, expect.any(Number));
  act(() => voice.onended());
  expect(audio.close).toHaveBeenCalledOnce();
});

it('keeps individual scale steps and the full scale finite and prevents old callbacks from stopping the next note', () => {
  const contexts = audioFixture();
  renderTuner();
  click('Hear E2');
  click(/C3.*Note 1/i);
  expect(contexts[0].close).toHaveBeenCalledOnce();
  const [step] = contexts[1].oscillators;
  expect(step.stop).toHaveBeenCalledOnce();
  click(/Play C major scale/);
  expect(contexts[1].close).toHaveBeenCalledOnce();
  const scale = contexts[2];
  expect(scale.oscillators).toHaveLength(8);
  scale.oscillators.forEach((voice) => expect(voice.stop).toHaveBeenCalledOnce());
  act(() => step.onended());
  expect(button('Stop scale')).toBeEnabled();
  act(() => scale.oscillators.at(-1).onended());
  expect(scale.close).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Stop scale' })).toBeNull();
});

it('continues the held reference across tab switches and stops on chromatic mode, competing audio, page exit and unmount', () => {
  const contexts = audioFixture();
  const { unmount } = renderTuner();
  click('Hear E2');
  select('Instrument', 'chromatic');
  expect(contexts[0].close).toHaveBeenCalledOnce();
  select('Instrument', 'guitar');
  click('Hear E2');
  act(() => window.dispatchEvent(new Event('sattari:stop-reference')));
  expect(contexts[1].close).toHaveBeenCalledOnce();
  click('Hear E2');
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(contexts[2].close).toHaveBeenCalledOnce();
  click('Hear E2');
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(contexts[3].close).not.toHaveBeenCalled();
  expect(contexts[3].oscillators[0].stop).not.toHaveBeenCalled();
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  hidden.mockRestore();
  expect(button('Stop reference sound')).toBeEnabled();
  unmount();
  expect(contexts[3].close).toHaveBeenCalledOnce();
});

it('stops a finite scale when the tab is hidden', () => {
  const contexts = audioFixture();
  renderTuner();
  click(/Play C major scale/);
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  hidden.mockRestore();
  expect(contexts[0].close).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Stop scale' })).toBeNull();
});

it('cancels a pending resume without interrupting a newer reference or displaying a stale error', async () => {
  const contexts = audioFixture();
  const Context = window.AudioContext;
  let failResume;
  vi.stubGlobal(
    'AudioContext',
    class extends Context {
      constructor() {
        super();
        if (contexts.length === 1) {
          this.state = 'suspended';
          this.resume = () =>
            new Promise((_, reject) => {
              failResume = reject;
            });
        }
      }
    }
  );
  renderTuner();
  click('Hear E2');
  click('Stop reference sound');
  expect(contexts[0].close).toHaveBeenCalledOnce();
  click('Hear E2');
  await act(async () => failResume(new Error('Cancelled')));
  expect(contexts[1].close).not.toHaveBeenCalled();
  expect(button('Stop reference sound')).toBeEnabled();
  expect(screen.queryByRole('alert')).toBeNull();
});
