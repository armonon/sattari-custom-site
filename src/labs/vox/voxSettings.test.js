import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS,settingsHistory,validateSettings} from './voxSettings';
describe('Vox settings',()=>{
 it('restores key, correction and harmony through undo and redo',()=>{
 const initial={past:[],present:DEFAULT_SETTINGS,future:[]};
 const edited=settingsHistory(initial,{type:'edit',patch:{strength:.3,harmony:'fifth',keyChoice:{root:9,mode:'minor'}}});
 const undone=settingsHistory(edited,{type:'undo'});expect(undone.present).toEqual(DEFAULT_SETTINGS);
 expect(settingsHistory(undone,{type:'redo'}).present).toEqual(edited.present);
 expect(settingsHistory(undone,{type:'edit',patch:{speedMs:100}}).future).toEqual([]);
 });
 it('validates saved settings before applying them',()=>{
 expect(validateSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))).toEqual(DEFAULT_SETTINGS);
 for(const patch of [{strength:NaN},{strength:2},{harmony:'seventh'},{keyChoice:{root:13,mode:'major'}},{speedMs:-1},{harmonyGain:Infinity}])expect(()=>validateSettings({...DEFAULT_SETTINGS,...patch})).toThrow();
 });
 it('clears history for a new take and bounds memory',()=>{
 let state={past:[],present:DEFAULT_SETTINGS,future:[]};for(let i=0;i<100;i++)state=settingsHistory(state,{type:'edit',patch:{speedMs:i}});
 expect(state.past).toHaveLength(80);expect(settingsHistory(state,{type:'reset',value:DEFAULT_SETTINGS}).past).toEqual([]);
 });
});
