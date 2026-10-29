// Isolated Chromium: product-safe static → Animate this ad → playable video → reload → MP4.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8303';
const fixturesRoot=process.env.OSH_FIXTURES_ROOT||resolve('outputs/fixtures');
const source=resolve(fixturesRoot,'outputs/ltx25-benchmark/inputs/cookie.source.jpeg');
const out=resolve('outputs/animate-browser-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const ctx=await chromium.launchPersistentContext(join(out,'chrome'),{channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await ctx.newPage();
const report={base,out,sourceHash:sha(await readFile(source)),steps:[],pass:false,ownerApproved:false};
const step=async(name,fn)=>{const t=Date.now();await fn();report.steps.push({name,ms:Date.now()-t});console.log('PASS',name);await page.screenshot({path:join(out,name+'.png'),fullPage:true});};
const click=async l=>{await l.waitFor({state:'visible',timeout:30000});for(let i=0;i<200;i++){if(await l.isEnabled()){await l.click();return;}await page.waitForTimeout(250);}throw Error('Disabled: '+await l.innerText());};

try{
 await step('01-open',async()=>{await page.goto(base+'/adstudio/',{waitUntil:'domcontentloaded'});await page.locator('.ad-app').waitFor();});
 await step('02-static-product-safe',async()=>{
  await click(page.getByRole('button',{name:'+ New',exact:true}));
  await page.locator('input[type="file"][accept*="image"]').first().setInputFiles(source);
  await page.getByPlaceholder('Your business name').fill('No Crumbs Bakery');
  await page.locator('label').filter({hasText:/^What.*photograph/}).locator('textarea').fill('Four chocolate chip cookies in a foil tray on wood.');
  await page.locator('.request-input').fill('Warm bakery editorial for a short commercial.');
  await click(page.getByRole('button',{name:/Develop advertisement/}));
  await page.getByRole('button',{name:/Accept direction/}).waitFor({timeout:220000});
  await click(page.getByRole('button',{name:/Accept direction/}));
  await page.locator('.engine-select select').selectOption('product-safe');
  await click(page.getByRole('button',{name:/Generate ad/}));
  await page.getByRole('button',{name:/Export PNG/}).waitFor({timeout:60000});
  await page.locator('label.fidelity input').check();
 });
 await step('03-animate',async()=>{
  const animate=page.getByRole('button',{name:/Animate this ad/});
  await click(animate);
  await page.locator('.campaign-video video, .job-status').first().waitFor({timeout:15000});
  // Wait until a campaign commercial video appears (LTX ~30–90s)
  await page.locator('.campaign-video video').first().waitFor({timeout:700000});
  const src=await page.locator('.campaign-video video').first().getAttribute('src');
  assert.ok(src&&(/\.webm|\.mp4/.test(src)),'playable video src required');
  report.videoSrc=src;
  const meta=await page.locator('.campaign-video small').first().innerText();
  report.videoMeta=meta;
  assert.match(meta,/LTX/i);
 });
 await step('04-reload-persist',async()=>{
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.campaign-video video').first().waitFor({timeout:60000});
  const count=await page.locator('.campaign-video video').count();
  assert.ok(count>=1,'video must survive refresh');
  report.persistedVideos=count;
 });
 await step('05-download-mp4-or-webm',async()=>{
  const mp4=page.locator('.campaign-video a',{hasText:/MP4/i});
  const webm=page.locator('.campaign-video a',{hasText:/WebM/i});
  if(await mp4.count()){
   const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),mp4.first().click()]);
   const dest=join(out,'download.mp4');await dl.saveAs(dest);
   const bytes=await readFile(dest);assert.ok(bytes.length>10000);report.download={kind:'mp4',bytes:bytes.length,sha256:sha(bytes)};
  }else{
   const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),webm.first().click()]);
   const dest=join(out,'download.webm');await dl.saveAs(dest);
   const bytes=await readFile(dest);assert.ok(bytes.length>10000);report.download={kind:'webm',bytes:bytes.length,sha256:sha(bytes),note:'MP4 link absent — FFmpeg export may have failed; WebM is the raw LTX output'};
  }
 });
 report.pass=true;console.log('ANIMATE BROWSER PASS',out);
}catch(e){report.pass=false;report.error=String(e);await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await ctx.close();}
