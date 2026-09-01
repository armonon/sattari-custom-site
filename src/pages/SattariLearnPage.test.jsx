/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('../utils/audioAnalysis', () => ({
  analyzeAudioFile: vi.fn(async (_file, onProgress) => {
    onProgress?.({ value: 100, label: 'Lesson ready' });
    return analyzedSong;
  }),
  detectPitch: vi.fn(),
}));

vi.mock('../utils/audioProjectStore', () => ({
  putAudioAsset: vi.fn(async () => ({ id: 'audio-1' })),
}));

vi.mock('../components/LearnArranger', () => ({
  default: () => <div>Practice arranger</div>,
}));

import SattariLearnPage from './SattariLearnPage';

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

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /analyze & teach/i }));

    await waitFor(() => expect(screen.getByText('D minor')).toBeInTheDocument());
    expect(screen.getAllByText(/108/).length).toBeGreaterThan(0);
    expect(screen.getByText('Local analysis')).toBeInTheDocument();
    expect(screen.queryByText('Demo analysis')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Suggest' }));
    expect(screen.getByText('Practice at 81 BPM')).toBeInTheDocument();
    expect(screen.getByText('D - A# - F - C')).toBeInTheDocument();
  }, 10000);
});
