import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
