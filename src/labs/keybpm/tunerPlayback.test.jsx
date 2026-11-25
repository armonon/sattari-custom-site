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
      createPeriodicWave = vi.fn((real, imag, options) => ({ real, imag, options }));
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
          setPeriodicWave: vi.fn(),
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

function nativeAudioFixture() {
  const players = [];
  const blobs = [];
  const release = vi.fn();
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL(blob) {
        blobs.push(blob);
        return `blob:tuner-${blobs.length}`;
      }
      static revokeObjectURL = release;
    }
  );
  vi.stubGlobal(
    'Audio',
    class {
      currentTime = 0;
      paused = true;
      constructor() {
        players.push(this);
      }
      play = vi.fn(async () => {
        this.paused = false;
      });
      pause = vi.fn(() => {
        this.paused = true;
      });
      load = vi.fn();
      removeAttribute = vi.fn();
    }
  );
  return { players, blobs, release };
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

it.each([
  [/E2.*Low E/i, 82.406889],
  [/E4.*High E/i, 329.627557],
])(
  'starts the indicated E directly from its string pad with upper harmonics and headroom',
  (name, hz) => {
    const contexts = audioFixture();
    renderTuner();
    click(name);
    const [audio] = contexts;
    const [oscillator] = audio.oscillators;
    expect(button('Stop reference sound')).toBeEnabled();
    expect(oscillator.frequency.value).toBeCloseTo(hz, 4);
    const { real, imag, options } = oscillator.setPeriodicWave.mock.calls[0][0];
    expect(options.disableNormalization).toBe(true);
    expect(Array.from(real).every((value) => value === 0)).toBe(true);
    expect(imag[0]).toBe(0);
    expect(imag[1]).toBe(Math.max(...imag));
    const peakGain = audio.gains[0].gain.linearRampToValueAtTime.mock.calls[0][0];
    const upperPartials = Array.from(imag).filter((_, n) => n * hz >= 200 && n > 1);
    // RMS of the signal remaining after a simulated ideal 200 Hz bass cut.
    const rms = peakGain * Math.sqrt(upperPartials.reduce((sum, value) => sum + value ** 2, 0) / 2);
    expect(rms).toBeGreaterThan(0.05);
    expect(peakGain * imag.reduce((sum, value) => sum + Math.abs(value), 0)).toBeLessThan(0.45);
    click('Stop reference sound');
  }
);

it('releases the media playback session after Stop and leaves an existing recording session alone', () => {
  const contexts = audioFixture();
  const session = { type: 'auto' };
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session });
  try {
    renderTuner();
    click('Hear E2');
    expect(session.type).toBe('playback');
    click('Stop reference sound');
    act(() => contexts[0].oscillators[0].onended());
    expect(session.type).toBe('auto');
    session.type = 'play-and-record';
    click('Hear E2');
    expect(session.type).toBe('play-and-record');
    click('Stop reference sound');
    act(() => contexts[1].oscillators[0].onended());
    expect(session.type).toBe('play-and-record');
  } finally {
    delete navigator.audioSession;
  }
});

it('offers native media after a blocked Web Audio start and waits for a second gesture', () => {
  vi.useFakeTimers();
  try {
    const contexts = audioFixture();
    const { players, blobs } = nativeAudioFixture();
    const Context = window.AudioContext;
    vi.stubGlobal(
      'AudioContext',
      class extends Context {
        state = 'suspended';
        resume = vi.fn(() => new Promise(() => {}));
      }
    );
    renderTuner();
    click('Hear E2');
    expect(screen.getByText('Starting reference')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4500));
    expect(screen.getByRole('alert')).toHaveTextContent('Audio playback could not start');
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(players).toHaveLength(0);
    click('Hear E2');
    expect(contexts).toHaveLength(1);
    expect(players).toHaveLength(1);
    expect(players[0].loop).toBe(true);
    expect(players[0].play).toHaveBeenCalledOnce();
    expect(blobs[0].type).toBe('audio/wav');
    expect(screen.queryByText('Reference playing')).toBeNull();
    players[0].currentTime = 0.22;
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText('Reference playing')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it('selects the string silently while the microphone is starting or listening', async () => {
  const contexts = audioFixture();
  const Context = window.AudioContext;
  vi.stubGlobal(
    'AudioContext',
    class extends Context {
      sampleRate = 48000;
      createAnalyser = () => ({});
      createMediaStreamSource = () => ({ connect() {}, disconnect() {} });
    }
  );
  let grant;
  const stopTrack = vi.fn();
  const getUserMedia = vi.fn(
    () =>
      new Promise((done) => {
        grant = done;
      })
  );
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  renderTuner();
  click('Start live tuner');
  click(/E4.*High E/i);
  expect(button('Cancel microphone request')).toBeEnabled();
  expect(contexts).toHaveLength(0);
  await act(async () => grant({ getTracks: () => [{ stop: stopTrack }] }));
  click(/E2.*Low E/i);
  expect(button('Stop microphone')).toBeEnabled();
  expect(contexts).toHaveLength(1);
  expect(contexts[0].oscillators).toHaveLength(0);
  expect(button(/E2.*Low E/i)).toHaveAttribute('aria-pressed', 'true');
  expect(stopTrack).not.toHaveBeenCalled();
  click('Stop microphone');
});

it('waits for rendered time, preserves a backgrounded reference, and detects a stalled foreground output', async () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  try {
    const contexts = audioFixture();
    renderTuner();
    click('Hear E2');
    const audio = contexts[0];
    audio.suspend = vi.fn(async () => {});
    expect(audio.state).toBe('running');
    expect(screen.getByText('Starting reference')).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1500));
    expect(screen.queryByText('Reference playing')).toBeNull();
    expect(audio.suspend).toHaveBeenCalledOnce();
    audio.currentTime = 0.15;
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText('Reference playing')).toBeInTheDocument();
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(20000));
    expect(audio.close).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(600));
    expect(audio.close).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('alert')).toHaveTextContent('playback stalled');
    expect(audio.close).toHaveBeenCalledOnce();
    expect(audio.suspend).toHaveBeenCalledOnce();
  } finally {
    hidden.mockRestore();
    vi.useRealTimers();
  }
});

it('classifies music before opening the audio device and restores auto if the constructor fails', () => {
  const session = { type: 'auto' };
  Object.defineProperty(navigator, 'audioSession', { configurable: true, value: session });
  try {
    let openedAs;
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          openedAs = session.type;
          throw new Error('Audio device unavailable');
        }
      }
    );
    renderTuner();
    click('Hear E2');
    expect(openedAs).toBe('playback');
    expect(session.type).toBe('auto');
    expect(screen.getByRole('alert')).toHaveTextContent('Audio device unavailable');
  } finally {
    delete navigator.audioSession;
  }
});

it('fully releases a stopped reference even when the browser never processes its final audio samples', () => {
  vi.useFakeTimers();
  try {
    const contexts = audioFixture();
    renderTuner();
    click('Hear E2');
    click('Stop reference sound');
    act(() => vi.advanceTimersByTime(5000));
    expect(contexts[0].close).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});

it('retunes a single alternate player, revokes old media and releases it on Stop and navigation', async () => {
  const { players, blobs, release } = nativeAudioFixture();
  vi.stubGlobal('AudioContext', undefined);
  const { unmount } = renderTuner();
  click(/E2.*Low E/i);
  expect(screen.getByRole('alert')).toHaveTextContent('Tap the string again');
  expect(players).toHaveLength(0);
  click(/E2.*Low E/i);
  const [media] = players;
  expect(button('Stop reference sound')).toBeEnabled();
  expect(media.src).toBe('blob:tuner-1');
  let rejectPlay;
  media.play.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectPlay = reject;
      })
  );
  click(/E4.*High E/i);
  expect(media.src).toBe('blob:tuner-2');
  expect(release).toHaveBeenCalledWith('blob:tuner-1');
  select('Concert A', '442');
  expect(media.src).toBe('blob:tuner-3');
  await act(async () => rejectPlay(new Error('superseded')));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(button('Stop reference sound')).toBeEnabled();
  expect(players).toHaveLength(1);
  expect(blobs).toHaveLength(3);
  click('Stop reference sound');
  expect(media.pause).toHaveBeenCalledOnce();
  expect(release).toHaveBeenCalledWith('blob:tuner-3');
  click('Hear E4');
  expect(players).toHaveLength(2);
  unmount();
  expect(players[1].pause).toHaveBeenCalledOnce();
  expect(release).toHaveBeenCalledWith('blob:tuner-4');
});
