/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analyzedSong = {
  source: 'local-analysis',
  duration: 42,
  durationLabel: '0:42',
  key: 'D minor',
  tonic: 'D',
  mode: 'minor',
  bpm: 108,
  feel: 'Mid-tempo pocket',
  chords: ['Dm', 'A#', 'F', 'C'],
  sections: [
    { name: 'Opening', range: '0:00 - 0:10', width: 25 },
    { name: 'Part A', range: '0:10 - 0:21', width: 25 },
    { name: 'Part B', range: '0:21 - 0:31', width: 25 },
    { name: 'Closing', range: '0:31 - 0:42', width: 25 },
  ],
  waveform: Array.from({ length: 96 }, () => 44),
  level: { rmsDb: -14.2, peakDb: -1.4 },
  confidence: { tempo: 0.82, key: 0.74, chords: 0.7 },
};

// Mock factories run when a module is first imported, which shows whether the
// page loaded the audio code up front or on first use.
const loaded = vi.hoisted(() => ({ analysis: false, store: false }));

vi.mock('../utils/audioAnalysis', () => {
  loaded.analysis = true;
  return {
    analyzeAudioFile: vi.fn(async (_file, onProgress) => {
      onProgress?.({ value: 100, label: 'Lesson ready' });
      return analyzedSong;
    }),
    detectPitch: vi.fn(),
  };
});

vi.mock('../utils/audioProjectStore', () => {
  loaded.store = true;
  return { putAudioAsset: vi.fn(async () => ({ id: 'audio-1' })) };
});

vi.mock('../components/LearnArranger', () => ({
  default: ({ bpm, initialInstrument = 'chords' }) => (
    <div data-testid="practice-arranger">
      Practice arranger: {initialInstrument}, {bpm} BPM
    </div>
  ),
}));

import SattariLearnPage from './SattariLearnPage';

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function renderLearn() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <SattariLearnPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}
function chooseSong(container, name) {
  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: [new File(['audio'], name, { type: 'audio/wav' })] },
  });
}
function microphoneMock() {
  const getUserMedia = vi.fn();
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const context = {
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    sampleRate: 44100,
    createAnalyser: vi.fn(() => ({ getFloatTimeDomainData: vi.fn() })),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  };
  const Context = vi.fn(function () {
    return context;
  });
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 42)
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  return { getUserMedia, stop, stream, context, Context };
}
beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:lesson'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (mediaDevicesDescriptor)
    Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor);
  else delete navigator.mediaDevices;
});

describe('SattariLearnPage', () => {
  it('replaces the starter map with results from the selected audio file', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:lesson'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    const { container } = render(
      <HelmetProvider>
        <MemoryRouter>
          <SattariLearnPage />
        </MemoryRouter>
      </HelmetProvider>
    );
    const file = new File(['audio'], 'lesson.wav', { type: 'audio/wav' });
    const input = container.querySelector('input[type="file"]');

    // The analysis and project-store code (and the Tone.js chunk they share
    // with the Studio) stay out of the page's first load.
    expect(loaded).toEqual({ analysis: false, store: false });

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /analyze & teach/i }));

    await waitFor(() => expect(screen.getByText('D minor')).toBeInTheDocument());
    expect(loaded.analysis).toBe(true);
    expect(loaded.store).toBe(false);
    expect(screen.getAllByText(/108/).length).toBeGreaterThan(0);
    expect(screen.getByText('Local analysis')).toBeInTheDocument();
    expect(screen.queryByText('Demo analysis')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Suggest' }));
    expect(screen.getByText('Practice at 81 BPM')).toBeInTheDocument();
    expect(screen.getByText('D - A# - F - C')).toBeInTheDocument();
  }, 10000);

  it('discards stale results and progress without stopping a newer analysis', async () => {
    const { analyzeAudioFile } = await import('../utils/audioAnalysis');
    const first = deferred(),
      second = deferred();
    analyzeAudioFile
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const { container } = renderLearn();
    chooseSong(container, 'first.wav');
    fireEvent.click(screen.getByRole('button', { name: 'Analyze & teach' }));
    await waitFor(() => expect(analyzeAudioFile.mock.calls.at(-1)[0].name).toBe('first.wav'));
    const [, oldProgress, oldOptions] = analyzeAudioFile.mock.calls.at(-1);
    chooseSong(container, 'second.wav');
    expect(oldOptions.signal.aborted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze & teach' }));
    await waitFor(() => expect(analyzeAudioFile.mock.calls.at(-1)[0].name).toBe('second.wav'));
    await act(async () => {
      oldProgress({ value: 90, label: 'Old song progress' });
      first.resolve(analyzedSong);
    });
    expect(screen.queryByText('D minor')).not.toBeInTheDocument();
    expect(screen.queryByText('Old song progress')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyzing...' })).toBeDisabled();
    await act(async () => second.resolve({ ...analyzedSong, key: 'E minor', tonic: 'E' }));
    expect(screen.getByText('E minor')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('aborts analysis on unmount and ignores late errors', async () => {
    const { analyzeAudioFile } = await import('../utils/audioAnalysis');
    const pending = deferred();
    analyzeAudioFile.mockImplementationOnce(() => pending.promise);
    const { container, unmount } = renderLearn();
    chooseSong(container, 'first.wav');
    fireEvent.click(screen.getByRole('button', { name: 'Analyze & teach' }));
    await waitFor(() => expect(analyzeAudioFile.mock.calls.at(-1)[0].name).toBe('first.wav'));
    const options = analyzeAudioFile.mock.calls.at(-1)[2];
    unmount();
    expect(options.signal.aborted).toBe(true);
    await act(async () => pending.reject(new Error('Old failure')));
    expect(screen.queryByText('Old failure')).not.toBeInTheDocument();
  });

  it('does not send an old asset to Studio when the source changes during saving', async () => {
    const { putAudioAsset } = await import('../utils/audioProjectStore');
    const pending = deferred();
    putAudioAsset.mockImplementationOnce(() => pending.promise);
    const { container } = renderLearn();
    chooseSong(container, 'first.wav');
    fireEvent.click(screen.getByRole('tab', { name: 'Suggest' }));
    fireEvent.click(screen.getByRole('button', { name: /Send this music map/ }));
    await waitFor(() => expect(putAudioAsset).toHaveBeenCalled());
    chooseSong(container, 'second.wav');
    await act(async () => pending.resolve({ id: 'old-asset' }));
    expect(localStorage.getItem('sattari-studio-transfer-v1')).toBeNull();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('stops permission granted after leaving Learn without opening an audio context', async () => {
    const mic = microphoneMock(),
      pending = deferred();
    mic.getUserMedia.mockReturnValue(pending.promise);
    const { unmount } = renderLearn();
    fireEvent.click(screen.getByRole('tab', { name: 'Challenge' }));
    fireEvent.click(screen.getByRole('button', { name: /Microphone\s*Start/ }));
    await waitFor(() => expect(mic.getUserMedia).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => pending.resolve(mic.stream));
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(mic.Context).not.toHaveBeenCalled();
  });

  it('cancels a pending connection without opening a second microphone', async () => {
    const mic = microphoneMock(),
      pending = deferred();
    mic.getUserMedia.mockReturnValue(pending.promise);
    renderLearn();
    fireEvent.click(screen.getByRole('tab', { name: 'Challenge' }));
    fireEvent.click(screen.getByRole('button', { name: /Microphone\s*Start/ }));
    await waitFor(() => expect(mic.getUserMedia).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Microphone\s*Connecting/ }));
    await act(async () => pending.resolve(mic.stream));
    expect(mic.getUserMedia).toHaveBeenCalledTimes(1);
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(mic.Context).not.toHaveBeenCalled();
  });

  it('cleans up an acquired stream if audio setup fails', async () => {
    const mic = microphoneMock();
    mic.getUserMedia.mockResolvedValue(mic.stream);
    mic.context.resume.mockRejectedValue(new Error('Audio unavailable'));
    renderLearn();
    fireEvent.click(screen.getByRole('tab', { name: 'Challenge' }));
    fireEvent.click(screen.getByRole('button', { name: /Microphone\s*Start/ }));
    await screen.findByText('Microphone could not start. Try again.');
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(mic.context.close).toHaveBeenCalledTimes(1);
  });

  it('stops an active microphone and animation on unmount', async () => {
    const mic = microphoneMock();
    mic.getUserMedia.mockResolvedValue(mic.stream);
    const { unmount } = renderLearn();
    fireEvent.click(screen.getByRole('tab', { name: 'Challenge' }));
    fireEvent.click(screen.getByRole('button', { name: /Microphone\s*Start/ }));
    await screen.findByText('Listening for a steady note');
    unmount();
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(mic.context.close).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  });

  it('stops the microphone when leaving the live-feedback tab', async () => {
    const mic = microphoneMock();
    mic.getUserMedia.mockResolvedValue(mic.stream);
    renderLearn();
    fireEvent.click(screen.getByRole('tab', { name: 'Challenge' }));
    fireEvent.click(screen.getByRole('button', { name: /Microphone\s*Start/ }));
    await screen.findByText('Listening for a steady note');
    fireEvent.click(screen.getByRole('tab', { name: 'Practice', exact: true }));
    expect(mic.stop).toHaveBeenCalledTimes(1);
    expect(mic.context.close).toHaveBeenCalledTimes(1);
  });

  it('opens instrument practice, completes honestly, retries, and advances', () => {
    renderLearn();
    fireEvent.click(screen.getByRole('tab', { name: 'Practice', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Bass', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Play the roots' }));
    expect(screen.getByRole('heading', { name: 'Play the roots' })).toHaveFocus();
    expect(screen.getByTestId('practice-arranger')).toHaveTextContent('bass, 96 BPM');
    fireEvent.click(screen.getByRole('button', { name: 'Mark practiced' }));
    expect(screen.queryByTestId('practice-arranger')).not.toBeInTheDocument();
    expect(screen.getByText(/Self-reported practice/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Practice again' }));
    expect(screen.getByTestId('practice-arranger')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark practiced' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next exercise' }));
    expect(screen.getByRole('heading', { name: 'Lead the changes' })).toHaveFocus();
    expect(screen.getByTestId('practice-arranger')).toHaveTextContent('bass, 72 BPM');
    fireEvent.click(screen.getByRole('button', { name: 'All exercises' }));
    expect(screen.getByRole('button', { name: 'Start Play the roots' })).toBeInTheDocument();
  });
});
