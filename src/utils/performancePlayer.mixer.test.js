import { expect, it, vi } from 'vitest';

const engines = vi.hoisted(() => []);
vi.mock('./audioProjectStore', () => ({ getAudioAsset: vi.fn() }));
// A recording engine stand-in: every engine call is recorded in order.
vi.mock('./studioAudioEngine', async (original) => ({
  ...(await original()),
  StudioAudioEngine: class {
    constructor() {
      this.calls = [];
      this.decks = new Map();
      this.padPlayers = new Map();
      this.output = { connect: vi.fn() };
      this.getAudioContext = () => ({ rawContext: { currentTime: 0, sampleRate: 48000 } });
      engines.push(this);
      return new Proxy(this, {
        get: (target, key) => {
          if (key in target || typeof key !== 'string' || key === 'then') return target[key];
          return (...args) => {
            target.calls.push([key, ...args]);
            if (key === 'ensureDeck') target.decks.set(args[0], { lanes: new Map() });
            return true;
          };
        },
      });
    }
  },
}));

import { PerformancePlayer, replayScheduling } from './performancePlayer';
import { newEffect } from './arrangementEffects';

it('restores returns, deck inserts and audible sends before a replay starts', async () => {
  const effect = newEffect('heat');
  const capture = {
    duration: 10,
    events: [
      {
        time: 0,
        type: 'initialState',
        args: [
          {
            dspVersion: 2,
            returns: { a: { size: 80 }, b: { division: '1/8' } },
            decks: [{ id: 'A', inserts: [effect], sends: { a: 30, b: 0 } }],
          },
        ],
      },
    ],
  };
  const player = new PerformancePlayer({ decks: new Map(), output: {} });
  await player.prepare(capture);
  const calls = engines.at(-1).calls;
  const names = calls.map(([name]) => name);
  expect(calls).toContainEqual(['setReturn', 'a', { size: 80 }]);
  expect(calls).toContainEqual(['setReturn', 'b', { division: '1/8' }]);
  expect(calls).toContainEqual(['setDeckInserts', 'A', [effect]]);
  expect(calls).toContainEqual(['setDeckSend', 'A', 'a', 30]);
  expect(calls).not.toContainEqual(['setDeckSend', 'A', 'b', 0]);
  // Returns exist before the first deck can send into them.
  expect(names.indexOf('setReturn')).toBeLessThan(names.indexOf('setDeckSend'));
  expect(names.indexOf('ensureDeck')).toBeLessThan(names.indexOf('setDeckInserts'));
});

it('queues send and return changes at their journaled time; insert rebuilds stay dispatched', () => {
  const initial = { decks: [{ id: 'A' }] };
  const send = { type: 'setDeckSend', args: ['A', 'a', 40] };
  const change = { type: 'setReturn', args: ['b', { division: '1/8' }] };
  const inserts = { type: 'setDeckInserts', args: ['A', [newEffect('eq')]] };
  const plan = replayScheduling({ initial, events: [send, change, inserts] });
  expect(plan.scheduled).toEqual([send, change]);
  expect(plan.dispatched).toEqual([inserts]);
  const times = [];
  const engine = {
    performanceParameterTime: null,
    setDeckSend: vi.fn(function () {
      times.push(this.performanceParameterTime);
    }),
    setReturn: vi.fn(function () {
      times.push(this.performanceParameterTime);
    }),
  };
  PerformancePlayer.prototype.scheduleControl.call({ engine }, send, 12.5);
  PerformancePlayer.prototype.scheduleControl.call({ engine }, change, 13);
  expect(engine.setDeckSend).toHaveBeenCalledWith('A', 'a', 40);
  expect(engine.setReturn).toHaveBeenCalledWith('b', { division: '1/8' });
  expect(times).toEqual([12.5, 13]);
  expect(engine.performanceParameterTime).toBeNull();
});

it('skips a damaged send instead of scheduling it', () => {
  const engine = { setDeckSend: vi.fn() };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  PerformancePlayer.prototype.scheduleControl.call(
    { engine },
    { type: 'setDeckSend', args: ['A', 'a', null] },
    4
  );
  expect(engine.setDeckSend).not.toHaveBeenCalled();
});
