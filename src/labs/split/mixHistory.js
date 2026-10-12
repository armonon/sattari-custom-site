export function mixHistory(state, action) {
  if (action.type === 'undo') return state.past.length ? { past: state.past.slice(0, -1), present: state.past.at(-1), future: [state.present, ...state.future] } : state;
  if (action.type === 'redo') return state.future.length ? { past: [...state.past, state.present].slice(-80), present: state.future[0], future: state.future.slice(1) } : state;
  const next = action.value;
  if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
  return { past: [...state.past, state.present].slice(-80), present: next, future: [] };
}
export const initialMix = lanes => Object.fromEntries(lanes.map(lane => [lane.id, { muted: Boolean(lane.muted), solo: false, level: 1 }]));
