/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LearnArranger from './LearnArranger';

// Set when the mock is first imported (Tone.js must not load with the page), and
// records the AudioContexts the arranger's Tone contexts are built on.
const tone = vi.hoisted(() => ({ loaded: false, wrapped: [], resume: null }));

vi.mock('tone', () => {
  tone.loaded = true;
  class ToneNode {
    constructor(options = {}) {
      this.context = options.context;
      this.volume = { value: 0 };
      this.gain = { value: 0, rampTo() {} };
    }
    connect() {
      return this;
    }
    toDestination() {
      return this;
    }
    start() {
      return this;
    }
    triggerAttackRelease() {}
    dispose() {}
  }
  class Context {
    constructor(rawContext) {
      this.rawContext = rawContext;
      tone.wrapped.push(rawContext);
      this.transport = {
        bpm: { value: 0, rampTo() {} },
        state: 'stopped',
        position: 0,
        cancel() {},
        clear() {},
        pause() {},
        scheduleOnce: () => 1,
        start() {
          this.state = 'started';
        },
        stop() {
          this.state = 'stopped';
        },
      };
      this.draw = { schedule() {} };
    }
    resume() {
      return tone.resume ? tone.resume() : Promise.resolve();
    }
    dispose() {}
  }
  return {
    Context,
    Gain: ToneNode,
    MembraneSynth: ToneNode,
    MetalSynth: ToneNode,
    MonoSynth: ToneNode,
    NoiseSynth: ToneNode,
    PolySynth: ToneNode,
    Sequence: ToneNode,
    Synth: ToneNode,
    // The Studio's shared context: the arranger must never touch it.
    getContext: () => {
      throw new Error('Tone’s global context was used');
    },
  };
});

afterEach(() => {
  tone.resume = null;
  vi.unstubAllGlobals();
});

describe('LearnArranger', () => {
  it('publishes chord, bass, and drum edits as a Studio-ready arrangement', async () => {
    const onArrangementChange = vi.fn();

    render(
      <LearnArranger
        bpm={96}
        initialChords={['Am7', 'Fmaj7', 'C', 'G']}
        onArrangementChange={onArrangementChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Chord for bar 1'), { target: { value: 'E7' } });
    fireEvent.change(screen.getByLabelText('Line'), { target: { value: 'octaves' } });
    fireEvent.click(screen.getByRole('button', { name: 'Disable Kick step 1' }));
    // Rendering and editing need no audio; Tone.js is fetched later (when the
    // page is idle, or on the first touch or play).
    expect(tone.loaded).toBe(false);

    await waitFor(() => {
      const latestArrangement = onArrangementChange.mock.calls.at(-1)[0];
      expect(latestArrangement.progression[0]).toBe('E7');
      expect(latestArrangement.bassPattern).toBe('octaves');
      expect(latestArrangement.drumPattern.kick[0]).toBe(false);
      expect(latestArrangement.schema).toBe('SattariLearn.practiceArrangement.v1');
    });
  }, 10000);

  it('unlocks audio inside the tap on play, then builds on that context once Tone loads', async () => {
    const contexts = [];
    class FakeAudioContext {
      state = 'suspended';
      resume = vi.fn(() => {
        this.state = 'running';
        return Promise.resolve();
      });
      close = vi.fn(() => Promise.resolve());
      constructor() {
        contexts.push(this);
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);

    const { unmount } = render(<LearnArranger bpm={96} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play arrangement' }));

    // Synchronously, within the tap: iOS allows audio to start only here.
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resume).toHaveBeenCalledTimes(1);

    expect(await screen.findByRole('button', { name: 'Pause arrangement' })).toBeInTheDocument();
    expect(tone.wrapped).toEqual([contexts[0]]);

    // A second tap reuses the running context.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Pause arrangement' }));
    });
    expect(contexts).toHaveLength(1);

    unmount();
    expect(contexts[0].close).toHaveBeenCalled();
  }, 10000);

  it('opens the requested practice instrument', () => {
    render(<LearnArranger initialInstrument="bass" />);
    expect(screen.getByRole('tab', { name: 'Bass', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(document.querySelectorAll('.instrument-bass button').length).toBeGreaterThan(0);
  });

  it('does not restart an arrangement after leaving while audio resume is pending', async () => {
    let finish;
    tone.resume = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const close = vi.fn(async () => {});
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';
        close = close;
      }
    );
    const { unmount } = render(<LearnArranger />);
    fireEvent.click(screen.getByRole('button', { name: 'Play arrangement' }));
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    unmount();
    await act(async () => finish());
    expect(close).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Pause arrangement' })).not.toBeInTheDocument();
  });
});
