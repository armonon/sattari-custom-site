export const DEFAULT_SETTINGS = {keyChoice:{root:0,mode:'major'},strength:.8,speedMs:40,harmony:'none',harmonyGain:.6};
export function validateSettings(value){
 const range=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
 if(!value||!value.keyChoice||!Number.isInteger(value.keyChoice.root)||!range(value.keyChoice.root,0,11)||!['major','minor','chromatic'].includes(value.keyChoice.mode)||!range(value.strength,0,1)||!range(value.speedMs,0,200)||!['none','third','fifth'].includes(value.harmony)||!range(value.harmonyGain,0,1))throw Error('Invalid Vox settings. Your take was not changed.');
 return {keyChoice:{root:value.keyChoice.root,mode:value.keyChoice.mode},strength:value.strength,speedMs:value.speedMs,harmony:value.harmony,harmonyGain:value.harmonyGain};
}
export function settingsHistory(state,action){
 if(action.type==='reset')return {past:[],present:validateSettings(action.value),future:[]};
 if(action.type==='undo')return state.past.length?{past:state.past.slice(0,-1),present:state.past.at(-1),future:[state.present,...state.future]}:state;
 if(action.type==='redo')return state.future.length?{past:[...state.past,state.present].slice(-80),present:state.future[0],future:state.future.slice(1)}:state;
 if(action.type!=='edit')return state;
 const next=validateSettings({...state.present,...action.patch});
 return JSON.stringify(next)===JSON.stringify(state.present)?state:{past:[...state.past,state.present].slice(-80),present:next,future:[]};
}
