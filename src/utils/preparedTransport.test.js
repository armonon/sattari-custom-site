import { deferred } from '../test/deferred';
import { it, expect, vi } from 'vitest';
import { preparedTransport, cancelPreparedTransport } from './preparedTransport';
import { WindowedGrainPlayer } from './windowedGrainPlayer';

function fixture() {
  const wait = deferred();
  const deck = {
    lanes: new Map([
      [
        'fullMix',
        {
          duration: 200,
          player: {
            prepareWindow: vi.fn(() => wait.promise),
            loop: false,
          },
        },
      ],
    ]),
  };
  return { wait, deck, engine: {}, apply: vi.fn(() => true) };
}
it('leaves the audible source unchanged until all destination audio is ready', async () => {
  const { wait, deck, engine, apply } = fixture();
  const job = preparedTransport(engine, deck, 150, apply);
  expect(deck.preparing).toBe(true);
  expect(apply).not.toHaveBeenCalled();
  wait.resolve();
  expect(await job).toBe(true);
  expect(apply).toHaveBeenCalledOnce();
  expect(deck.preparing).toBe(false);
});

it.each(['commit', 'cancel', 'reject'])(
  'keeps current read-ahead alive during a cold loop until %s',
  async (outcome) => {
    const currentRead = deferred();
    const destination = deferred();
    const player = Object.create(WindowedGrainPlayer.prototype);
    player.pool = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(currentRead.promise)
        .mockReturnValueOnce(destination.promise),
    };
    player.lastPrefetch = 153;
    const audibleJob = player.prefetchWindow(150, { loop: false });
    const isAudibleCurrent = player.pool.prepare.mock.calls[0][3];
    const deck = { playbackRate: 2, lanes: new Map([['vocals', { duration: 180, player }]]) };
    const apply = vi.fn(() => {
      expect(player.pool.prepare.mock.calls[1][4]()).toBe(true);
      expect(isAudibleCurrent()).toBe(false);
      expect(player.preparing).toBeNull();
      expect(player.lastPrefetch).toBe(-1);
      return true;
    });
    const job = preparedTransport({}, deck, 150, apply, { loop: true, loopStart: 75, loopEnd: 77 });
    expect(isAudibleCurrent()).toBe(true);
    expect(player.preparing).toBe(audibleJob);
    expect(player.pool.prepare).toHaveBeenLastCalledWith(
      undefined,
      150,
      {
        loop: true,
        loopStart: 75,
        loopEnd: 77,
      },
      expect.any(Function),
      expect.any(Function)
    );
    const retainUntil = player.pool.prepare.mock.calls[1][4];
    expect(retainUntil()).toBe(true);
    if (outcome === 'cancel') cancelPreparedTransport(deck);
    if (outcome === 'reject') destination.reject(new Error('Unavailable loop'));
    else destination.resolve();
    expect(await job).toBe(outcome === 'commit');
    expect(retainUntil()).toBe(false);
    expect(isAudibleCurrent()).toBe(outcome !== 'commit');
    expect(apply).toHaveBeenCalledTimes(outcome === 'commit' ? 1 : 0);
    currentRead.resolve();
    await audibleJob;
  }
);
it.each(['cancel', 'dispose', 'replace'])(
  'does not restart after %s during destination decoding',
  async (operation) => {
    const { wait, deck, engine, apply } = fixture();
    const job = preparedTransport(engine, deck, 150, apply);
    if (operation === 'cancel') cancelPreparedTransport(deck);
    if (operation === 'dispose') engine.disposed = true;
    if (operation === 'replace') deck.lanes.clear();
    wait.resolve();
    expect(await job).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(deck.preparing).toBe(false);
  }
);
it('keeps playback intact and exposes a failed cold seek without an unhandled rejection', async () => {
  const { wait, deck, engine, apply } = fixture();
  const job = preparedTransport(engine, deck, 150, apply);
  wait.reject(new Error('Source unavailable'));
  expect(await job).toBe(false);
  expect(deck.transportError).toBe('Source unavailable');
  expect(deck.preparing).toBe(false);
  expect(apply).not.toHaveBeenCalled();
});
it('does not clear a newer pending command when stale preparation rejects', async () => {
  const { wait, deck, engine, apply } = fixture();
  const first = preparedTransport(engine, deck, 100, apply);
  const secondWait = deferred();
  deck.lanes.get('fullMix').player.prepareWindow.mockReturnValue(secondWait.promise);
  const second = preparedTransport(engine, deck, 150, apply);
  wait.reject(new Error('Stale source'));
  expect(await first).toBe(false);
  expect(deck.preparing).toBe(true);
  expect(deck.transportError).toBeUndefined();
  secondWait.resolve();
  expect(await second).toBe(true);
  expect(deck.preparing).toBe(false);
});
it('clears preparation when a removed source rejects without presenting a stale error', async () => {
  const { wait, deck, engine, apply } = fixture();
  const pending = preparedTransport(engine, deck, 100, apply);
  deck.lanes.clear();
  wait.reject(new Error('Removed source'));
  expect(await pending).toBe(false);
  expect(deck.preparing).toBe(false);
  expect(deck.transportError).toBeUndefined();
});
it('only commits the latest of two rapid seeks', async () => {
  const { wait, deck, engine, apply } = fixture();
  const first = preparedTransport(engine, deck, 100, apply);
  const next = vi.fn(() => true);
  const second = preparedTransport(engine, deck, 150, next);
  wait.resolve();
  expect(await first).toBe(false);
  expect(await second).toBe(true);
  expect(apply).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledOnce();
});
it('does not clear a stopped player failure when only preparing a loop change', async () => {
  const { wait, deck, engine, apply } = fixture();
  const player = deck.lanes.get('fullMix').player;
  const failure = new Error('Audio scheduling fell behind');
  player.failure = failure;
  const pending = preparedTransport(engine, deck, 0, apply, {
    loop: true,
    loopStart: 0,
    loopEnd: 1,
  });
  wait.resolve();
  expect(await pending).toBe(true);
  expect(player.failure).toBe(failure);
  expect(deck.transportError).toBe(failure.message);
});
it('clears a previous player failure only when the prepared command restarts playback', async () => {
  const { wait, deck, engine, apply } = fixture();
  const player = deck.lanes.get('fullMix').player;
  player.failure = new Error('Audio scheduling fell behind');
  const pending = preparedTransport(engine, deck, 0, apply, undefined, { restart: true });
  wait.resolve();
  expect(await pending).toBe(true);
  expect(player.failure).toBeNull();
  expect(deck.transportError).toBeNull();
});

it('commits only the final destination across rapid forward/backward and loop seeks', async () => {
  const { deck, engine } = fixture();
  const waits = Array.from({ length: 24 }, () => deferred());
  const positions = Array.from({ length: 24 }, (_, i) => (i % 2 ? 3 + i / 10 : 180 - i));
  const applied = [];
  let call = 0;
  deck.lanes.get('fullMix').player.prepareWindow = vi.fn(() => waits[call++].promise);
  const jobs = positions.map((position, i) =>
    preparedTransport(
      engine,
      deck,
      position,
      () => {
        applied.push(position);
        return true;
      },
      i % 3 ? undefined : { loop: true, loopStart: 2, loopEnd: 190 }
    )
  );
  // New destination finishes first; old decodes finish backwards afterwards.
  for (const wait of [...waits].reverse()) wait.resolve();
  const results = await Promise.all(jobs);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(applied).toEqual([positions.at(-1)]);
});

it('never applies an old seek after a source replacement and new seek, even when old decode finishes last', async () => {
  const { wait, deck, engine, apply } = fixture();
  const old = preparedTransport(engine, deck, 180, apply);
  const replacementWait = deferred();
  deck.lanes.set('fullMix', {
    duration: 200,
    player: { prepareWindow: vi.fn(() => replacementWait.promise), loop: false },
  });
  const newApply = vi.fn(() => true);
  const next = preparedTransport(engine, deck, 5, newApply);
  replacementWait.resolve();
  expect(await next).toBe(true);
  wait.resolve();
  expect(await old).toBe(false);
  expect(apply).not.toHaveBeenCalled();
  expect(newApply).toHaveBeenCalledOnce();
  expect(deck.preparing).toBe(false);
});
