import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const out=new URL('./',import.meta.url).pathname,browser=await chromium.launch({channel:'chrome'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:950},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto((process.env.TEST_URL||'http://127.0.0.1:4210')+'/studio/keybpm');
 await page.getByLabel('Add tracks',{exact:true}).setInputFiles('/Users/lillypad/Projects/company-launch/content/search-guides/examples/120-bpm-c-major-mix.wav');
 await page.locator('.keybpm-track[data-status="done"]').waitFor({timeout:120000});
 const summary=await page.locator('.keybpm-track').innerText();assert.ok(summary.includes('BPM'));
 await page.locator('audio').evaluate(el=>el.play());await page.waitForFunction(()=>document.querySelector('audio')?.currentTime>0,{},{timeout:10000});await page.locator('audio').evaluate(el=>el.pause());
 const [report]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save report',exact:true}).click()]);await report.saveAs(out+'report.keybpm.json');const data=JSON.parse(readFileSync(await report.path(),'utf8'));assert.equal(data.tracks.length,1);
 const [csv]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export CSV',exact:true}).click()]);await csv.saveAs(out+'results.csv');assert.ok(readFileSync(await csv.path(),'utf8').includes('120-bpm-c-major-mix.wav'));
 await page.getByRole('searchbox').fill('no-such-track');await page.getByText('No tracks match this search.').waitFor();await page.getByRole('searchbox').fill('');
 for(const width of [1440,1024,390,320]){await page.setViewportSize({width,height:950});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+`workspace-${width}.png`,fullPage:true});}
 await page.getByRole('button',{name:'Clear',exact:true}).click();await page.getByLabel('Open analysis report',{exact:true}).setInputFiles(out+'report.keybpm.json');await page.locator('.keybpm-track[data-status="done"]').waitFor();assert.equal(await page.locator('audio').count(),0);assert.ok((await page.locator('.keybpm-track').innerText()).includes('source audio not included'));assert.deepEqual(errors,[]);
 writeFileSync(out+'browser.json',JSON.stringify({analysis:true,playback:true,reportReopen:true,csv:true,search:true,widths:[1440,1024,390,320],pageErrors:errors},null,2));
}finally{await browser.close()}
