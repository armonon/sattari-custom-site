import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

async function freshKit() {
  vi.resetModules();
  document.head.querySelectorAll('script').forEach((node) => node.remove());
  delete window.TCC;
  return import('./suiteKit');
}

afterEach(() => {
  vi.useRealTimers();
  delete window.TCC;
});

describe('suite kit integration', () => {
  it('maps studio routes to suite app ids and ignores the rest of the site', async () => {
    const { suiteAppFor } = await freshKit();
    expect(suiteAppFor('/studio')).toBe('stemdeck');
    expect(suiteAppFor('/studio/split/')).toBe('split');
    expect(suiteAppFor('/studio/keybpm')).toBe('key-bpm');
    expect(suiteAppFor('/press')).toBe('press');
    for (const path of ['/', '/shop', '/hub', '/downloads', '/studio/other'])
      expect(suiteAppFor(path)).toBeNull();
  });

  it('adds one deferred script tag with the app id and no floating menu', async () => {
    const { loadSuiteKit, SUITE_SRC } = await freshKit();
    void loadSuiteKit('split');
    void loadSuiteKit('pocket');
    const scripts = document.querySelectorAll(`script[src="${SUITE_SRC}"]`);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].dataset.app).toBe('split');
    expect(scripts[0].dataset.menu).toBe('none');
    expect(scripts[0].defer).toBe(true);
  });

  it('resolves to null (app keeps working) when the script cannot load or never answers', async () => {
    let kit = await freshKit();
    const failing = kit.loadSuiteKit('split');
    document.querySelector(`script[src="${kit.SUITE_SRC}"]`).onerror();
    await expect(failing).resolves.toBeNull();

    vi.useFakeTimers();
    kit = await freshKit();
    const silent = kit.loadSuiteKit('vox');
    vi.advanceTimersByTime(10000);
    await expect(silent).resolves.toBeNull();
  });

  it('offers a downloaded export to the Locker and saves it through TCC.locker', async () => {
    const kit = await freshKit();
    const save = vi.fn(async () => 'id-1');
    const { LockerOffer } = await import('./SuiteUi');
    const ready = kit.loadSuiteKit('pocket');
    window.TCC = { locker: { save } };
    window.dispatchEvent(new Event('tcc:ready'));
    await ready;
    render(
      <MemoryRouter>
        <LockerOffer />
      </MemoryRouter>
    );
    expect(screen.queryByRole('button', { name: /Save to Locker/ })).toBeNull();
    const blob = new Blob(['RIFF'], { type: 'audio/wav' });
    act(() => kit.offerToLocker(blob, 'loop.wav'));
    await act(async () => screen.getByRole('button', { name: /Save to Locker/ }).click());
    expect(save).toHaveBeenCalledWith({
      name: 'loop.wav',
      type: 'audio/wav',
      blob,
      meta: undefined,
    });
    expect(screen.getByText(/Saved to your Locker/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Locker' }).getAttribute('href')).toBe(
      'https://thecreatingco.com/locker/'
    );
  });

  it('turns an opened Locker entry into a File for the normal file path', async () => {
    const { entryFile } = await freshKit();
    const file = entryFile({ name: 'song.mp3', type: 'audio/mpeg', blob: new Blob(['x']) });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('song.mp3');
    expect(file.type).toBe('audio/mpeg');
  });
});
