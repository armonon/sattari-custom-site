import {describe,it,expect} from 'vitest';
import {DEFAULT_SETTINGS,validateSettings,settingsHistory} from './canvasSettings';
describe('Canvas saved visual settings',()=>{
 it('round trips every setting without carrying unexpected properties',()=>{const value={...DEFAULT_SETTINGS,scene:'horizon',colors:['#112233','#445566','#778899'],title:'Night',artist:'Test',loopLength:15,variant:5};expect(validateSettings(JSON.parse(JSON.stringify({...value,extra:'ignore'})))).toEqual(value);});
 it('rejects invalid settings before edits',()=>{for(const patch of [{scene:'fake'},{colors:['red']},{loopLength:0},{reactivity:Infinity},{variant:-1},{sizeId:'4k'},{title:'x'.repeat(41)}])expect(()=>validateSettings({...DEFAULT_SETTINGS,...patch})).toThrow();});
 it('undoes palette as a single edit and clears redo on a new branch',()=>{const first={past:[],present:DEFAULT_SETTINGS,future:[]};const edited=settingsHistory(first,{type:'edit',patch:{paletteId:'aurora',colors:['#030710','#67e8f9','#a78bfa']}});const undone=settingsHistory(edited,{type:'undo'});expect(undone.present).toEqual(DEFAULT_SETTINGS);expect(settingsHistory(undone,{type:'redo'}).present).toEqual(edited.present);expect(settingsHistory(undone,{type:'edit',patch:{title:'New'}}).future).toEqual([]);});
});
