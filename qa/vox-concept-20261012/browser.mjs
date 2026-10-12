import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const out=new URL('./',import.meta.url).pathname,browser=await chromium.launch({channel:'chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));await page.goto((process.env.TEST_URL||'http://127.0.0.1:4210')+'/studio/vox');
 await page.getByLabel('Or drop a vocal',{exact:true}).setInputFiles(out+'voice-fixture.wav');
 const ready=()=>page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Export WAV')&&!b.disabled),{},{timeout:30000});await ready();
 const strength=page.getByRole('slider',{name:/Strength/});await strength.focus();await strength.press('ArrowLeft');assert.equal(await strength.inputValue(),'0.79');await page.getByRole('button',{name:'Undo edit',exact:true}).click();assert.equal(await strength.inputValue(),'0.8');await page.getByRole('button',{name:'Redo edit',exact:true}).click();assert.equal(await strength.inputValue(),'0.79');
 await page.getByRole('radio',{name:'3rd above',exact:true}).check();await ready();
 const [settings]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save settings',exact:true}).click()]);await settings.saveAs(out+'settings.json');assert.equal(JSON.parse(readFileSync(await settings.path(),'utf8')).settings.harmony,'third');
 await page.getByRole('radio',{name:'Off',exact:true}).check();await page.getByLabel('Open Vox settings',{exact:true}).setInputFiles(out+'settings.json');await page.waitForFunction(()=>document.querySelector('input[name="vox-harmony"][value="third"]')?.checked);await ready();
 await page.getByRole('button',{name:'Play tuned',exact:true}).click();await page.getByRole('button',{name:'Stop tuned',exact:true}).waitFor();await page.getByRole('button',{name:'Stop tuned',exact:true}).click();
 const [wav]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export WAV',exact:true}).click()]);await wav.saveAs(out+'tuned.wav');assert.ok(readFileSync(await wav.path()).length>10000);
 for(const width of [1440,1024,390,320]){await page.setViewportSize({width,height:950});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);await page.screenshot({path:out+`workspace-${width}.png`,fullPage:true});}assert.deepEqual(errors,[]);
 writeFileSync(out+'browser.json',JSON.stringify({pitchAnalysis:true,undoRedo:true,settingsSaveReopen:true,harmonyExport:true,playback:true,widths:[1440,1024,390,320],pageErrors:errors},null,2));
}finally{await browser.close()}
