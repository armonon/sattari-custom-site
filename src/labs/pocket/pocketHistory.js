export function pocketHistory(state, action) {
 if(action.type==='reset')return {past:[],present:action.value,future:[]};
 if(action.type==='undo')return state.past.length?{past:state.past.slice(0,-1),present:state.past.at(-1),future:[state.present,...state.future]}:state;
 if(action.type==='redo')return state.future.length?{past:[...state.past,state.present].slice(-100),present:state.future[0],future:state.future.slice(1)}:state;
 if(action.type!=='edit')return state;
 const next=typeof action.value==='function'?action.value(state.present):action.value;
 return JSON.stringify(next)===JSON.stringify(state.present)?state:{past:[...state.past,state.present].slice(-100),present:next,future:[]};
}
