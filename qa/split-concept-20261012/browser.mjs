import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const out=new URL('./',import.meta.url).pathname,browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>{errors.push(String(e));console.log('ERROR',String(e))});
 await page.goto((process.env.SPLIT_URL||'http://127.0.0.1:4210')+'/studio/split');
 await page.getByRole('button',{name:'Try the 8-second demo',exact:true}).click();
 let previous='';for(let n=0;n<180;n++){const status=await page.locator('.alab-workspace').innerText();if(status!==previous){console.log(status.slice(-1000));previous=status;}if(await page.getByRole('button',{name:'Play stems',exact:true}).isEnabled().catch(()=>false))break;if(await page.locator('.alab-error,.alab-bad').count())throw Error(await page.locator('.alab-error,.alab-bad').allTextContents());await page.waitForTimeout(4000);}
 assert.equal(await page.getByRole('button',{name:'Play stems',exact:true}).isEnabled(),true,'separation and preview must finish');
 await page.getByRole('button',{name:'Play stems',exact:true}).click();await page.getByRole('button',{name:'Mute Vocals',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Mute Vocals',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Undo mix edit',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Mute Vocals',exact:true}).getAttribute('aria-pressed'),'false');await page.getByRole('button',{name:'Redo mix edit',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Mute Vocals',exact:true}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Pause stems',exact:true}).click();
 const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download Vocals WAV',exact:true}).click()]);await d.saveAs(out+'vocals.wav');assert.ok(readFileSync(await d.path()).length>10000);
 const [zip]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'All stems (ZIP)',exact:true}).click()]);await zip.saveAs(out+'stems.zip');
 for(const width of [1440,1024,390,320]){await page.setViewportSize({width,height:950});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);await page.screenshot({path:out+`workspace-${width}.png`,fullPage:true});results.push({width,noOverflow:true});}
 await page.reload();await page.getByRole('button',{name:'Play stems',exact:true}).waitFor({timeout:30000});assert.equal(await page.locator('.alab-lane').count(),5);assert.deepEqual(errors,[]);
 writeFileSync(out+'browser.json',JSON.stringify({viewports:results,realSeparation:true,mixUndoRedo:true,wavAndZip:true,recovery:true},null,2));await context.close();
}finally{await browser.close()}
