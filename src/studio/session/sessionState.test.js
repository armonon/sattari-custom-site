import { describe, expect, it } from 'vitest';
import { emptyArrangement, migrateArrangement } from '../../utils/arrangementModel';
import { initialSessionState, sessionReducer } from './sessionState';
import { snapshotFromManifest, snapshotFromSaved } from './sessionSnapshot';

const apply = (state, snapshot) => {
  const { arrangerSource, ...session } = snapshot;
  return sessionReducer(state, {
    type: 'apply',
    session: {
      ...session,
      arranger: migrateArrangement({ ...arrangerSource, decks: session.decks }),
    },
  });
};

// Every field differs from its initial value, including the unsaved ones.
const usedSession = () => ({
  ...initialSessionState(),
  restored: true,
  sessionName: 'Old set',
  decks: initialSessionState().decks.map((deck) => ({ ...deck, title: 'Old', duration: 30 })),
  pads: initialSessionState().pads.map((pad) => ({ ...pad, gain: 10 })),
  arranger: { ...emptyArrangement(), tracks: [] },
  recordings: [{ id: 'take' }],
  pianoNotes: [{ pitch: 'C4', step: 0 }],
  transfer: { trackName: 'Old' },
  masterBpm: 90,
  projectKey: 'Eb',
  crossfader: 10,
  crossfaderCurve: 'Sharp',
  crossfaderReverse: true,
  masterLevel: 40,
  masterProcessing: { ...initialSessionState().masterProcessing, low: 6 },
  limiter: false,
  aiMaster: true,
  aiMasterMode: 'Club -9',
  masterFx: { x: 90, y: 5 },
  masterDeckId: 'C',
  focusedDeckId: 'D',
});

describe('sessionReducer apply', () => {
  it('turns any session into exactly a first-visit session for New project', () => {
    const next = apply(usedSession(), snapshotFromSaved(null));
    expect(next).toEqual({ ...initialSessionState(), restored: true });
    expect(Object.keys(next).sort()).toEqual(Object.keys(usedSession()).sort());
  });

  it('resets unsaved fields when a project is opened', () => {
    const next = apply(
      usedSession(),
      snapshotFromManifest({ schema: 'SattariStudio.project.v5', decks: [] })
    );
    expect(next).toMatchObject({
      sessionName: 'Imported session',
      crossfaderCurve: 'Smooth',
      crossfaderReverse: false,
      aiMasterMode: 'Streaming -14',
      masterFx: { x: 28, y: 44 },
      masterDeckId: 'A',
      focusedDeckId: 'A',
      transfer: null,
    });
  });
});

describe('sessionReducer set', () => {
  it('keeps the state object when a value is unchanged', () => {
    const state = initialSessionState();
    expect(sessionReducer(state, { type: 'set', key: 'crossfader', value: 50 })).toBe(state);
    expect(
      sessionReducer(state, { type: 'set', key: 'crossfader', value: (value) => value + 1 })
    ).toMatchObject({ crossfader: 51 });
  });
});
