import { emptyArrangement } from '../../utils/arrangementModel';
import { DEFAULT_MASTER_PROCESSING } from '../../utils/masterOutput';
import { normalizeMixer } from '../mixer/mixerReturns';
import { createEmptyDecks, createPads } from './sessionModel';

/**
 * Every session-scoped field, persisted or not. Applying a session starts
 * from these defaults, so no field can leak from the session it replaces.
 */
export function initialSessionState() {
  return {
    restored: false,
    sessionName: 'Untitled session',
    decks: createEmptyDecks(),
    pads: createPads(),
    arranger: emptyArrangement(),
    recordings: [],
    pianoNotes: [],
    transfer: null,
    masterBpm: 120,
    projectKey: 'Off',
    crossfader: 50,
    crossfaderCurve: 'Smooth',
    crossfaderReverse: false,
    masterLevel: 100,
    masterProcessing: { ...DEFAULT_MASTER_PROCESSING },
    mixer: normalizeMixer(),
    limiter: true,
    aiMaster: false,
    aiMasterMode: 'Streaming -14',
    masterFx: { x: 28, y: 44 },
    masterDeckId: 'A',
    focusedDeckId: 'A',
  };
}

const resolve = (value, current) => (typeof value === 'function' ? value(current) : value);

// Updaters run inside this reducer, so they must stay free of engine calls:
// StrictMode invokes reducers twice.
export function sessionReducer(state, action) {
  switch (action.type) {
    case 'apply':
      return { ...initialSessionState(), ...action.session, restored: true };
    case 'set': {
      const value = resolve(action.value, state[action.key]);
      return Object.is(value, state[action.key]) ? state : { ...state, [action.key]: value };
    }
    case 'updateDeck':
      return {
        ...state,
        decks: state.decks.map((deck) =>
          deck.id === action.deckId ? { ...deck, ...resolve(action.updates, deck) } : deck
        ),
      };
    default:
      throw new Error(`Unknown session action: ${action.type}`);
  }
}

/** Stable setters with the same value-or-updater contract as useState. */
export function createSessionActions(dispatch) {
  const set = (key) => (value) => dispatch({ type: 'set', key, value });
  return {
    apply: (session) => dispatch({ type: 'apply', session }),
    updateDeck: (deckId, updates) => dispatch({ type: 'updateDeck', deckId, updates }),
    setSessionName: set('sessionName'),
    setDecks: set('decks'),
    setPads: set('pads'),
    setArranger: set('arranger'),
    setRecordings: set('recordings'),
    setTransfer: set('transfer'),
    setMasterBpm: set('masterBpm'),
    setProjectKey: set('projectKey'),
    setCrossfader: set('crossfader'),
    setCrossfaderCurve: set('crossfaderCurve'),
    setCrossfaderReverse: set('crossfaderReverse'),
    setMasterLevel: set('masterLevel'),
    setMasterProcessing: set('masterProcessing'),
    setMixer: set('mixer'),
    setLimiter: set('limiter'),
    setAiMaster: set('aiMaster'),
    setAiMasterMode: set('aiMasterMode'),
    setMasterFx: set('masterFx'),
    setMasterDeckId: set('masterDeckId'),
    setFocusedDeckId: set('focusedDeckId'),
  };
}
