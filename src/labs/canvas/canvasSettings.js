export const DEFAULT_SETTINGS={scene:'pulse',paletteId:'golden',colors:['#0b0906','#d6b36d','#f7f0e8'],reactivity:.8,loopStart:0,loopLength:8,title:'',artist:'',sizeId:'720',variant:0};
export function validateSettings(s){
 const range=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
 if(!s||!['pulse','chladni','ripple','lattice','horizon'].includes(s.scene)||typeof s.paletteId!=='string'||!Array.isArray(s.colors)||s.colors.length!==3||!s.colors.every(c=>/^#[0-9a-f]{6}$/i.test(c))||!range(s.reactivity,0,1.5)||!range(s.loopStart,0,86400)||![4,6,8,15].includes(s.loopLength)||!['720','1080'].includes(s.sizeId)||!Number.isInteger(s.variant)||!range(s.variant,0,5)||!['title','artist'].every(k=>typeof s[k]==='string'&&s[k].length<=40))throw Error('Invalid Canvas settings. Your scene was not changed.');
 return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(k=>[k,s[k]]));
}
export function settingsHistory(state,action){
 if(action.type==='undo')return state.past.length?{past:state.past.slice(0,-1),present:state.past.at(-1),future:[state.present,...state.future]}:state;
 if(action.type==='redo')return state.future.length?{past:[...state.past,state.present].slice(-80),present:state.future[0],future:state.future.slice(1)}:state;
 if(action.type!=='edit')return state;
 const patch=typeof action.patch==='function'?action.patch(state.present):action.patch;
 const next=validateSettings({...state.present,...patch});
 return JSON.stringify(next)===JSON.stringify(state.present)?state:{past:[...state.past,state.present].slice(-80),present:next,future:[]};
}
