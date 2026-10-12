import {useEffect,useRef} from 'react';
import {drawFrame,SCENES} from './canvasScenes';
import {demoView,featuresAt} from './canvasFeatures';
function SceneThumbnail({scene,colors}){
 const ref=useRef(null);
 useEffect(()=>{const ctx=ref.current?.getContext('2d');if(!ctx)return;const view=demoView(8);drawFrame(ctx,{scene,t:2,view,f:featuresAt(view,2),colors,cover:null,react:.8,title:'',artist:'',variant:0});},[scene,colors]);
 return <canvas ref={ref} width={180} height={120} aria-hidden="true"/>;
}
export default function SceneBrowser({scene,colors,onChange,disabled}){
 return <aside className="lab-panel canvas-scenes" aria-label="Scene browser"><h2>Scenes</h2>{SCENES.map(item=><button type="button" key={item.id} aria-pressed={scene===item.id} disabled={disabled} onClick={()=>onChange(item.id)} title={item.detail}><SceneThumbnail scene={item.id} colors={colors}/><span>{item.label}</span><small>{item.detail}</small></button>)}</aside>;
}
