import { describe, expect, it } from 'vitest';
import {
  PERFORMANCE_STAGES,
  PERFORMANCE_SUPPORT,
  RECONSTRUCTION_EVENTS,
  performanceSupportForTake,
  performanceReleaseMatrix,
} from './performanceSupport';
import { REPLAY_METHODS } from './performancePlayer';
import { takeCapabilities } from './takeCapabilities';

const initial = (updates = {}) => ({
  type: 'initialState',
  time: 0,
  args: [
    {
      decks: [
        {
          id: 'A',
          lanes: { vocals: { assetId: 'song-a-vocals' } },
          ...updates,
        },
      ],
    },
  ],
});

describe('canonical five-stage action support', () => {
  it('emits a commit-bound four-state artifact without granting unproven PASS cells', () => {
    const report = performanceReleaseMatrix('candidate-sha');
    expect(report.commit).toBe('candidate-sha');
    expect(report.fullyQualified).toBe(false);
    expect(report.rows.map((row) => row.id)).toEqual(expect.arrayContaining(['pan', 'routing']));
    for (const row of report.rows) {
      expect(Object.keys(row.stages)).toEqual(PERFORMANCE_STAGES);
      for (const value of Object.values(row.stages)) {
        expect(report.states).toContain(value);
        expect(value).not.toBe('PASS');
      }
    }
  });
  it('covers every replay method and reconstruction handler without certifying incomplete stages', () => {
    const known = new Set(PERFORMANCE_SUPPORT.flatMap((item) => item.events));
    for (const event of [...REPLAY_METHODS, ...RECONSTRUCTION_EVENTS])
      if (event !== 'initialState') expect(known.has(event), event).toBe(true);
    expect(new Set(PERFORMANCE_SUPPORT.map((item) => item.id)).size).toBe(
      PERFORMANCE_SUPPORT.length
    );
    for (const item of PERFORMANCE_SUPPORT) {
      expect(Object.keys(item.stages)).toEqual(PERFORMANCE_STAGES);
      expect(item.destination).not.toBe('');
      expect(item.limit).not.toBe('');
      expect(item.qualified).toBe(false);
    }
  });

  it('does not call replayable FX editable arrangement data', () => {
    const result = takeCapabilities({
      assetId: 'print',
      events: [
        initial(),
        { type: 'setDeckFx', args: ['A', { echo: 40 }] },
        { type: 'setDeckFilter', args: ['A', 80] },
        { type: 'setDeckGain', args: ['A', 80] },
      ],
    });
    expect(result.editable).toContain('Combined lane volume automation');
    expect(result.editable.join(' ')).not.toMatch(/FX|filter/);
    expect(result.printed).toContain('Deck / stem FX parameters');
    expect(result.printed).toContain('Deck filter');
  });

  it('identifies opening DSP and embedded lane mutations even without dedicated FX events', () => {
    const result = performanceSupportForTake({
      events: [
        initial({
          eq: { low: 70 },
          keyLock: true,
          playbackRate: 1.2,
          stemFx: { vocals: { send: 40 } },
        }),
        { type: 'setLaneState', args: ['A', 'vocals', { pitch: 2 }] },
      ],
    });
    expect(result.printed).toEqual(
      expect.arrayContaining([
        'Opening deck EQ',
        'Opening key-locked tempo processing',
        'Opening stem effects',
        'Lane pitch / filter / send changes',
      ])
    );
  });

  it('reports mixer sends, returns and deck inserts as printed in Arrange', () => {
    const opening = performanceSupportForTake({
      events: [initial({ sends: { a: 25, b: 0 }, inserts: [{ id: 'fx', type: 'eq' }] })],
    });
    expect(opening.printed).toContain('Opening deck sends and inserts');
    const quiet = performanceSupportForTake({
      events: [initial({ sends: { a: 0, b: 0 }, inserts: [] })],
    });
    expect(quiet.printed).not.toContain('Opening deck sends and inserts');
    const live = takeCapabilities({
      assetId: 'print',
      events: [
        initial(),
        { type: 'setDeckSend', args: ['A', 'a', 40] },
        { type: 'setReturn', args: ['b', { division: '1/8' }] },
      ],
    });
    expect(live.printed).toContain('Mixer sends / returns / channel inserts');
    expect(live.unknown || []).toEqual([]);
  });

  it('ignores disabled actions, flags unknown actions and survives save/reopen', () => {
    const capture = {
      events: [
        initial(),
        { type: 'setDeckFx', disabled: true, args: [] },
        { type: 'futurePluginMutation', args: [] },
      ],
    };
    const result = performanceSupportForTake(capture);
    expect(result.rows).toEqual([]);
    expect(result.unknown).toEqual(['futurePluginMutation']);
    expect(result.printed).toContain('Unclassified action: futurePluginMutation');
    expect(performanceSupportForTake(JSON.parse(JSON.stringify(capture)))).toEqual(result);
    expect(result.qualified).toBe(false);
  });

  it('classifies journaled sync intent instead of reporting unclassified actions', () => {
    const grid = { id: 'B', bpm: 100, beatOffset: 0, syncQuantum: 1, followTempoMap: false };
    const capture = {
      events: [
        initial(),
        { type: 'setProjectTempo', args: [120, 0] },
        { type: 'setDeckSync', args: ['B', true, grid, { ...grid, id: 'A', bpm: 120 }] },
        { type: 'setTempoFollow', args: ['A', [{ time: 0 }, { time: 0.5 }], 120] },
      ],
    };
    const result = performanceSupportForTake(capture);
    expect(result.unknown).toEqual([]);
    expect(result.printed.join(' ')).not.toContain('Unclassified');
    expect(result.rows.map((row) => row.id)).toEqual(['sync']);
    expect(result.editable).toContain('Re-derived clip playback rates');
    expect(takeCapabilities({ assetId: 'print', ...capture }).printed.join(' ')).not.toContain(
      'Unclassified'
    );
  });

  it('does not promise editable source clips when the take has no source snapshot', () => {
    const result = performanceSupportForTake({
      events: [{ type: 'setDeckGain', args: ['A', 100] }],
    });
    expect(result.editable).toEqual([]);
    expect(result.printed).toContain('Performance actions without a source snapshot');
  });
});
