import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const out=new URL('./',import.meta.url).pathname,browser=await chromium.launch({channel:'chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));await page.goto((process.env.TEST_URL||'http://127.0.0.1:4210')+'/studio/canvas');
 await page.getByRole('button',{name:/Horizon Stacked/}).click();await page.getByRole('button',{name:'Undo edit',exact:true}).click();assert.equal(await page.getByRole('button',{name:/Pulse Cover/}).getAttribute('aria-pressed'),'true');await page.getByRole('button',{name:'Redo edit',exact:true}).click();assert.equal(await page.getByRole('button',{name:/Horizon Stacked/}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Aurora',exact:true}).click();await page.getByRole('textbox',{name:'Title',exact:true}).fill('MIDNIGHT');
 const [settings]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save settings',exact:true}).click()]);await settings.saveAs(out+'settings.json');assert.equal(JSON.parse(readFileSync(await settings.path(),'utf8')).settings.title,'MIDNIGHT');
 await page.getByRole('textbox',{name:'Title',exact:true}).fill('Changed');await page.getByLabel('Open Canvas settings',{exact:true}).setInputFiles(out+'settings.json');await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(i=>i.value==='MIDNIGHT'));
 const [png]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Still PNG',exact:true}).click()]);await png.saveAs(out+'still.png');assert.ok(readFileSync(await png.path()).length>10000);
 await page.getByRole('button',{name:'4 s',exact:true}).click();
 const [video]=await Promise.all([page.waitForEvent('download',{timeout:120000}),page.getByRole('button',{name:'Export 4 s loop',exact:true}).click()]);await video.saveAs(out+'loop.'+video.suggestedFilename().split('.').pop());assert.ok(readFileSync(await video.path()).length>10000);
 for(const width of [1440,1024,390,320]){await page.setViewportSize({width,height:950});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);await page.screenshot({path:out+`workspace-${width}.png`,fullPage:true});}assert.deepEqual(errors,[]);
 writeFileSync(out+'browser.json',JSON.stringify({realSceneThumbnails:true,undoRedo:true,settingsSaveReopen:true,png:true,video:true,widths:[1440,1024,390,320],pageErrors:errors},null,2));
}finally{await browser.close()}
