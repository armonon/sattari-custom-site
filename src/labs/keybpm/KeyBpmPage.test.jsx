import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import KeyBpmPage from './KeyBpmPage';
import { createKeyBpmReport } from './keyBpmReport';
const lockerOpen = vi.hoisted(() => ({ current: null }));
const decodeTrack = vi.hoisted(() => vi.fn());
vi.mock('../../utils/stemSeparator', () => ({ decodeTrack, SAMPLE_RATE: 44100 }));
vi.mock('../../utils/seo', () => ({ SEO: () => null }));
vi.mock('../../pwa/SattariAppMetadata', () => ({ default: () => null }));
vi.mock('../../suite/suiteKit', async (importOriginal) => ({
  ...(await importOriginal()),
  useLockerOpen: (_, handler) => {
    lockerOpen.current = handler;
  },
  useSuiteKit: () => {},
}));
let worker;
beforeEach(() => {
  decodeTrack.mockResolvedValue({
    left: new Float32Array(4),
    right: new Float32Array(4),
    channels: 1,
  });
  vi.stubGlobal(
    'Worker',
    class {
      constructor() {
        // Expose the browser-created worker to deliver failure messages in this test.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        worker = this;
      }
      postMessage({ id }) {
        this.id = id;
      }
      terminate() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());
it('reports unavailable analysis as an error instead of a completed measurement', async () => {
  render(
    <MemoryRouter>
      <KeyBpmPage />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText('Add tracks'), {
    target: { files: [new File(['broken'], 'bad-pcm.wav', { type: 'audio/wav' })] },
  });
  await waitFor(() => expect(worker?.id).toBeTruthy());
  worker.onmessage({
    data: { id: worker.id, analysis: { version: 1, status: 'unavailable' }, rough: null },
  });
  await waitFor(() =>
    expect(screen.getByText('Analysis unavailable for this file.')).toBeInTheDocument()
  );
  const row = screen.getByText('bad-pcm.wav').closest('tr');
  expect(row.dataset.status).toBe('error');
  expect(row).not.toHaveTextContent('undefined dB RMS');
});

it('keeps report import and overlapping suite intake atomic within the200-track cap', async () => {
  const when = '2026-10-08T02:00:00.000Z';
  const rows = Array.from({ length: 200 }, (_, i) => ({
    file: { name: `stored-${i}.wav`, size: 1, type: 'audio/wav', lastModified: 1 },
    measuredAt: when,
    result: { file: `stored-${i}.wav`, status: 'error', note: 'Saved failure' },
  }));
  let read;
  render(
    <MemoryRouter>
      <KeyBpmPage />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText('Open analysis report'), {
    target: {
      files: [
        {
          size: 100,
          text: () =>
            new Promise((resolve) => {
              read = resolve;
            }),
        },
      ],
    },
  });
  await act(async () => {
    lockerOpen.current({ blob: new File(['new'], 'new.wav', { type: 'audio/wav' }) });
    read(createKeyBpmReport(rows, when));
  });
  await waitFor(() => expect(screen.queryByText('Checking files…')).not.toBeInTheDocument());
  expect(document.querySelectorAll('tbody tr')).toHaveLength(200);
  expect(screen.getByRole('alert')).toHaveTextContent('200 tracks');
  expect(screen.queryByText('new.wav')).not.toBeInTheDocument();
});

const measured = {
  version: 1,
  status: 'ready',
  duration: 30,
  key: 'A minor',
  keyConfidence: 0.05,
  keyEvidence: 'tentative',
  keyAlternative: 'C major',
  bpm: 140,
  tempoEvidence: 'supported',
  rmsDb: -16,
  peakDb: -1,
};

it('keeps the detection while the musician picks half time, taps, types and resets', async () => {
  render(
    <MemoryRouter>
      <KeyBpmPage />
    </MemoryRouter>
  );
  fireEvent.change(screen.getByLabelText('Add tracks'), {
    target: { files: [new File(['a'], 'groove.wav', { type: 'audio/wav' })] },
  });
  await waitFor(() => expect(worker?.id).toBeTruthy());
  await act(async () =>
    worker.onmessage({ data: { id: worker.id, analysis: measured, rough: null } })
  );
  const row = () => within(screen.getByRole('table')).getByText('groove.wav').closest('tr');
  await waitFor(() => expect(row().dataset.status).toBe('done'));
  expect(row()).toHaveTextContent('140');
  expect(row()).toHaveTextContent('8A');
  fireEvent.click(screen.getByRole('button', { name: 'Adjust key and tempo for groove.wav' }));
  fireEvent.click(screen.getByRole('button', { name: /Half time/ }));
  expect(row()).toHaveTextContent('70');
  expect(row()).toHaveTextContent('half time · detected 140');
  fireEvent.click(screen.getByRole('button', { name: /Use the alternative/ }));
  expect(row()).toHaveTextContent('C major');
  expect(row()).toHaveTextContent('8B');
  expect(row()).toHaveTextContent('yours · detected A minor');
  const typed = screen.getByLabelText('Type BPM');
  fireEvent.change(typed, { target: { value: '0' } });
  expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  expect(typed).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(typed, { target: { value: '93.25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(row()).toHaveTextContent('93.25');
  fireEvent.click(screen.getByRole('button', { name: 'Reset to detected' }));
  expect(row()).toHaveTextContent('140');
  expect(row()).toHaveTextContent('A minor');
  expect(row()).not.toHaveTextContent('detected 140');
});

it('report rows without audio cannot be played or separated, and say why', async () => {
  const when = '2026-10-08T02:00:00.000Z';
  render(
    <MemoryRouter>
      <KeyBpmPage />
    </MemoryRouter>
  );
  const report = createKeyBpmReport(
    [
      {
        file: { name: 'archived.wav', size: 1, type: 'audio/wav', lastModified: 1 },
        measuredAt: when,
        result: {
          file: 'archived.wav',
          status: 'done',
          note: '',
          duration: 10,
          key: 'C major',
          camelot: '8B',
          keyConfidence: 0.3,
          keyEvidence: 'supported',
          alternative: '',
          bpm: 120,
          tempoEvidence: 'supported',
          rmsDb: -20,
          peakDb: -3,
        },
        user: { key: null, bpm: 60, bpmChoice: 'half', editedAt: when },
      },
    ],
    when
  );
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Open analysis report'), {
      target: { files: [{ size: report.length, text: async () => report }] },
    });
  });
  await waitFor(() =>
    expect(within(screen.getByRole('table')).getByText('archived.wav')).toBeInTheDocument()
  );
  expect(screen.getByText('Report · audio not included')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'archived.wav: choose the source file again to listen' })
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Separate stems of archived.wav' })).toBeDisabled();
  // The saved correction is restored and still labelled as the musician's.
  expect(
    within(screen.getByRole('table')).getByText('archived.wav').closest('tr')
  ).toHaveTextContent('half time · detected 120');
});
