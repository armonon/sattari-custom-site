import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useArrangementOperations } from './useArrangementOperations';

const players = vi.hoisted(() => []);
const failures = vi.hoisted(() => ({ prepare: null }));
vi.mock('../../utils/performancePlayer', () => ({
  PerformancePlayer: class {
    constructor(owner, callbacks) {
      Object.assign(this, callbacks);
      this.prepare = vi.fn(async () => {
        if (failures.prepare) throw failures.prepare;
      });
      this.play = vi.fn(async () => {});
      this.stop = vi.fn(async () => {});
      this.dispose = vi.fn();
      players.push(this);
    }
  },
}));
vi.mock('./projectEdits', async (original) => ({
  ...(await original()),
  printedPerformanceTracks: vi.fn(() => [{ id: 'printed' }]),
}));

beforeEach(() => {
  players.length = 0;
  failures.prepare = null;
});

function setup() {
  const flags = {
    working: { current: false },
    cancelled: { current: false },
    mounted: { current: true },
  };
  const deps = {
    history: { project: { tracks: [] } },
    playback: {
      pause: vi.fn(),
      position: { current: 0 },
      getArrangementEngine: vi.fn(),
      settings: { current: {} },
    },
    flags,
    ready: true,
    busy: false,
    bpm: 120,
    getEngine: vi.fn(() => ({})),
    onBusy: vi.fn(),
    setBusy: vi.fn(),
    setMessage: vi.fn(),
    // Mirrors the editor: edits are refused while an operation is working.
    edit: vi.fn(() => !flags.working.current),
    exportSettings: {},
  };
  const hook = renderHook(() => useArrangementOperations(deps));
  return { ...deps, hook };
}

it('holds the arranger busy for the whole replay, then prints the take', async () => {
  const { hook, onBusy, edit, playback, flags } = setup();
  await act(() => hook.result.current.replay({ id: 'take-1', duration: 4 }, true));
  expect(playback.pause).toHaveBeenCalled();
  expect(onBusy).toHaveBeenLastCalledWith(true);
  expect(flags.working.current).toBe(true);
  expect(hook.result.current.activeReplay).toBe('take-1');

  act(() => players[0].onFinish({ sources: { tracks: [{}] }, lateEvents: 0, maxLateness: 0 }));
  expect(onBusy).toHaveBeenLastCalledWith(false);
  expect(flags.working.current).toBe(false);
  expect(edit).toHaveBeenCalledOnce();
  expect(edit.mock.results[0].value).toBe(true);
  expect(hook.result.current.activeReplay).toBe(null);
});

it('does not start a second replay while one is running', async () => {
  const { hook } = setup();
  await act(() => hook.result.current.replay({ id: 'take-1', duration: 4 }));
  await act(() => hook.result.current.replay({ id: 'take-2', duration: 4 }));
  expect(players).toHaveLength(1);
});

it('silences a replay when the project is replaced, and never prints it into the new one', async () => {
  const { hook, onBusy, edit, setMessage } = setup();
  await act(() => hook.result.current.replay({ id: 'take-1', duration: 4 }, true));
  act(() => hook.result.current.cancelReplay());
  expect(players[0].dispose).toHaveBeenCalled();
  expect(onBusy).toHaveBeenLastCalledWith(false);
  setMessage.mockClear();
  act(() => players[0].onFinish({ sources: { tracks: [{}] } }));
  expect(edit).not.toHaveBeenCalled();
  expect(setMessage).not.toHaveBeenCalled();
});

it('releases the arranger when a replay cannot be prepared', async () => {
  const { hook, onBusy, setMessage, flags } = setup();
  failures.prepare = new Error('Source audio is missing.');
  await act(() => hook.result.current.replay({ id: 'take-1', duration: 4 }));
  expect(flags.working.current).toBe(false);
  expect(onBusy).toHaveBeenLastCalledWith(false);
  expect(setMessage).toHaveBeenLastCalledWith('Source audio is missing.');
});
