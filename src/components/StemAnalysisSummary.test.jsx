import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import StemAnalysisSummary from './StemAnalysisSummary';

const analysis = {
  status: 'ready',
  key: 'A minor',
  keyEvidence: 'tentative',
  bpm: 120,
  tempoEvidence: 'supported',
  prominentNotes: ['A', 'C', 'E'],
  duration: 80,
  sampleRate: 44100,
  channels: 2,
  peakDb: -2.3,
  rmsDb: -15.2,
  analyzedSeconds: 60,
  windows: [{}, {}, {}],
};
it('renders estimated song measurements and their limits with accessible details', () => {
  render(<StemAnalysisSummary analysis={analysis} />);
  expect(screen.getByRole('region', { name: 'Song analysis' })).toBeInTheDocument();
  expect(screen.getByText('A minor')).toBeInTheDocument();
  expect(screen.getByText('Tentative')).toBeInTheDocument();
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.getByText('A · C · E')).toBeInTheDocument();
  expect(screen.getByText('60s / 3 sections')).toBeInTheDocument();
  expect(screen.getByText('-15.2 dBFS')).toBeInTheDocument();
});
it('does not show a fake drum key or silence as zero dB', () => {
  render(
    <StemAnalysisSummary
      compact
      label="Drums analysis"
      analysis={{
        ...analysis,
        key: null,
        keyReason: 'percussion',
        bpm: null,
        prominentNotes: [],
        peakDb: null,
        rmsDb: null,
      }}
    />
  );
  expect(screen.getByText('Not assigned')).toBeInTheDocument();
  expect(screen.getAllByText('Silence')).toHaveLength(2);
  expect(screen.getByText('No key assigned to percussion.')).toBeInTheDocument();
});
it('handles missing and unavailable optional metadata', () => {
  const { rerender, container } = render(<StemAnalysisSummary />);
  expect(container).toBeEmptyDOMElement();
  rerender(<StemAnalysisSummary analysis={{ status: 'unavailable' }} />);
  expect(screen.getByText('Song analysis: musical analysis unavailable.')).toBeInTheDocument();
});
