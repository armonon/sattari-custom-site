import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PocketPage from './PocketPage';
import { DRAFT_KEY, MAX_SAVED, STORAGE_KEY, starterPattern } from './pocketPattern';

vi.mock('../../utils/seo', () => ({ SEO: () => null }));
vi.mock('../../pwa/SattariAppMetadata', () => ({ default: () => null }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const open = () =>
  render(
    <MemoryRouter>
      <PocketPage />
    </MemoryRouter>
  );

describe('Pocket persistence safety', () => {
  it('shows capacity refusal without removing an old beat or changing the edited beat', () => {
    const prior = JSON.stringify(
      Array.from({ length: MAX_SAVED }, (_, i) => ({ ...starterPattern(), name: `Saved ${i}` }))
    );
    localStorage.setItem(STORAGE_KEY, prior);
    open();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New edited beat' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('slots are full');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(prior);
    expect(screen.getByLabelText('Name')).toHaveValue('New edited beat');
    expect(screen.getByRole('button', { name: 'Saved 0 · 92' })).toBeInTheDocument();
  });
  it('leaves corrupt library and draft bytes intact and explains failure after edits', async () => {
    vi.useFakeTimers();
    localStorage.setItem(STORAGE_KEY, '{recoverable old library');
    localStorage.setItem(DRAFT_KEY, '{recoverable old draft');
    open();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Current work' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    await act(async () => vi.advanceTimersByTime(400));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{recoverable old library');
    expect(localStorage.getItem(DRAFT_KEY)).toBe('{recoverable old draft');
    expect(
      screen
        .getAllByRole('alert')
        .map((e) => e.textContent)
        .join(' ')
    ).toMatch(/not been replaced/);
    expect(screen.getByLabelText('Name')).toHaveValue('Current work');
  });
  it('handles failed delete without removing the saved row or original bytes', () => {
    const prior = JSON.stringify([starterPattern()]);
    localStorage.setItem(STORAGE_KEY, prior);
    open();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Starter groove' }));
    expect(screen.getByText(/Could not delete:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Starter groove · 92' })).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(prior);
  });
  it('reports failed draft writes instead of pretending edits are protected', async () => {
    vi.useFakeTimers();
    open();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved draft' } });
    await act(async () => vi.advanceTimersByTime(400));
    expect(screen.getByRole('alert')).toHaveTextContent('Draft not saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Keep this tab open or export your audio');
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
