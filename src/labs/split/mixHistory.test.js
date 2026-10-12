import {describe,it,expect} from 'vitest';
import {mixHistory,initialMix} from './mixHistory';
describe('Split mix history',()=>{it('restores mute/solo/level and original defaults',()=>{const present=initialMix([{id:'vocals'},{id:'original',muted:true}]);const initial={past:[],present,future:[]};const edit=mixHistory(initial,{type:'edit',value:{...present,vocals:{muted:true,solo:true,level:.3}}});expect(mixHistory(edit,{type:'undo'}).present).toEqual(present);expect(mixHistory(mixHistory(edit,{type:'undo'}),{type:'redo'})).toEqual(edit);expect(present.original.muted).toBe(true);});});
