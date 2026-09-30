import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ImportSetup from './ImportSetup';
import AnalysisReview from './AnalysisReview';
import RecordingSource from './RecordingSource';
import { DEMO } from './music';

it('explains full-band preparation before explicitly starting it', () => {
  const importer = { selectedFile: new File(['audio'], 'My song.wav'), importSong: vi.fn() };
  render(<ImportSetup importer={importer} onChooseFile={vi.fn()} />);
  expect(importer.importSong).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('radio', { name: /A full-band song/ }));
  expect(screen.getByRole('status')).toHaveTextContent('172 MB');
  fireEvent.click(screen.getByRole('button', { name: 'Build my practice guide' }));
  expect(importer.importSong).toHaveBeenCalledWith(importer.selectedFile, {
    preparation: 'instruments',
  });
});

it('reports instrumental and model limitations and allows a manual key correction', () => {
  const onKeyChange = vi.fn();
  render(
    <AnalysisReview
      lesson={{
        ...DEMO,
        quality: { method: 'crepe-tiny', preparation: 'instruments', coverage: 0.5 },
        keyAnalysis: {
          key: 'E minor',
          evidence: 'tentative',
          alternative: { key: 'G major' },
          possibleModulation: true,
        },
      }}
      onKeyChange={onKeyChange}
      onReview={vi.fn()}
    />
  );
  expect(screen.getByText(/reduced vocals, bass and drums/)).toBeInTheDocument();
  expect(screen.getByText(/key may change during/)).toBeInTheDocument();
  expect(screen.getByText(/Strummed chords are not converted/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Key for your guide' }), {
    target: { value: 'G major' },
  });
  expect(onKeyChange).toHaveBeenCalledWith('G major');
});

it('labels A/B listening as original and instruments, not guitar isolation', () => {
  const onChange = vi.fn();
  render(<RecordingSource source="instruments" onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Instruments' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Original song' }));
  expect(onChange).toHaveBeenCalledWith('original');
});
