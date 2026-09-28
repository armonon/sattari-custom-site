import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FilesView from './FilesView';

afterEach(() => vi.unstubAllGlobals());

const props = {
  sessionName: 'Friday set',
  restored: true,
  recordings: [],
  onImportSet: vi.fn(),
  onOpenProject: vi.fn(),
  onSave: vi.fn(),
  onNewProject: vi.fn(),
  onDownloadRecording: vi.fn(),
};

const storage = (usage, quota) =>
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: { estimate: async () => ({ usage, quota }) },
  });

it('shows browser storage use and warns when it is nearly full', async () => {
  storage(9 * 1024 ** 3, 10 * 1024 ** 3);
  render(<FilesView {...props} onCleanUpStorage={vi.fn()} />);
  const panel = screen.getByRole('region', { name: 'Browser storage' });
  expect(await within(panel).findByText('9.0 GB used of 10.0 GB')).toBeTruthy();
  expect(within(panel).getByText(/nearly full/)).toBeTruthy();
});

it('runs one cleanup at a time and refreshes the usage afterwards', async () => {
  const estimate = vi
    .fn()
    .mockResolvedValueOnce({ usage: 800 * 1024 ** 2, quota: 10 * 1024 ** 3 })
    .mockResolvedValue({ usage: 200 * 1024 ** 2, quota: 10 * 1024 ** 3 });
  vi.stubGlobal('navigator', { ...navigator, storage: { estimate } });
  let finish;
  const onCleanUpStorage = vi.fn(() => new Promise((resolve) => (finish = resolve)));
  render(<FilesView {...props} onCleanUpStorage={onCleanUpStorage} />);
  const panel = screen.getByRole('region', { name: 'Browser storage' });
  await within(panel).findByText('800.0 MB used of 10.0 GB');
  fireEvent.click(within(panel).getByRole('button', { name: 'Clean up unused audio' }));
  const busy = within(panel).getByRole('button', { name: 'Checking…' });
  expect(busy.disabled).toBe(true);
  await act(async () => finish(true));
  expect(await within(panel).findByText('200.0 MB used of 10.0 GB')).toBeTruthy();
  expect(onCleanUpStorage).toHaveBeenCalledTimes(1);
});

it('says so when the browser cannot report usage', async () => {
  vi.stubGlobal('navigator', { ...navigator, storage: undefined });
  render(<FilesView {...props} onCleanUpStorage={vi.fn()} />);
  expect(await screen.findByText('Usage unavailable in this browser')).toBeTruthy();
});

it('keeps the last backup downloadable until it is cleared', () => {
  const onDownloadBackup = vi.fn(),
    onClearBackup = vi.fn();
  render(
    <FilesView
      {...props}
      backup={{ file: new Blob([new Uint8Array(3 * 1024 * 1024)]), name: 'friday-set.sattari' }}
      onDownloadBackup={onDownloadBackup}
      onClearBackup={onClearBackup}
    />
  );
  const panel = screen.getByRole('region', { name: 'Last project backup' });
  expect(within(panel).getByText('3.0 MB')).toBeTruthy();
  expect(within(panel).getByText(/friday-set\.sattari stays available/)).toBeTruthy();
  fireEvent.click(within(panel).getByRole('button', { name: 'Download again' }));
  fireEvent.click(within(panel).getByRole('button', { name: 'Clear temporary copy' }));
  expect(onDownloadBackup).toHaveBeenCalledOnce();
  expect(onClearBackup).toHaveBeenCalledOnce();
});
