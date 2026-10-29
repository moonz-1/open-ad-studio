// Isolated 8304 acceptance: Journey static PNG → Animate multi-shot → reference-inspired MP4.
// Does not touch 8301/8302/8303. No storage wipe; uses a fresh Playwright profile.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8304';
const fixturesRoot=process.env.OSH_FIXTURES_ROOT||resolve('outputs/fixtures');
const source=resolve(fixturesRoot,'outputs/ltx25-benchmark/inputs/cookie.source.jpeg');
const ref=process.env.OSH_REF_VIDEO||resolve('outputs/fixtures/synthetic-reference/surprise-reveal.mp4');
const out=resolve('outputs/final-e2e-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={base,out,source,ref,steps:[],pass:false,ownerApproved:false};
const ctx=await chromium.launchPersistentContext(join(out,'chrome'),{channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await ctx.newPage();
page.on('pageerror',e=>report.steps.push({pageerror:e.message}));
const step=async(name,fn)=>{const t=Date.now();await fn();report.steps.push({name,ms:Date.now()-t});console.log('PASS',name,(Date.now()-t)+'ms');await page.screenshot({path:join(out,name+'.png'),fullPage:true}).catch(()=>{});};
const click=async l=>{await l.waitFor({state:'visible',timeout:60000});for(let i=0;i<480;i++){if(await l.isEnabled()){await l.click();return;}await page.waitForTimeout(250);}throw Error('Disabled: '+(await l.innerText().catch(()=>'(no text)')));};
const saved=()=>page.locator('.journey-footer').getByText('Saved on this browser').waitFor({timeout:240000});
const saveVideo=async(name,{preferSrc,minCount=1,timeout=900000}={})=>{
 const started=Date.now();let src='';
 while(Date.now()-started<timeout){
  const count=await page.locator('.journey-videos video').count();
  if(count>=minCount){
   src=await page.locator('.journey-videos video').first().getAttribute('src')||'';
   if(src&&(!preferSrc||src!==preferSrc))break;
  }
  await page.waitForTimeout(1000);
 }
 assert.ok(src&&(!preferSrc||src!==preferSrc),`expected new video src (avoided ${preferSrc||'none'})`);
 const r=await page.request.get(base+src);const bytes=Buffer.from(await r.body());
 await writeFile(join(out,name),bytes);
 report[name]={src,bytes:bytes.length,sha256:sha(bytes)};
 await new Promise(ok=>{const p=spawn(ffmpeg,['-y','-i',join(out,name),'-ss','0.05','-vframes','1',join(out,name+'-first.jpg'),'-ss','1.0','-vframes','1',join(out,name+'-mid.jpg')],{stdio:'ignore'});p.on('close',()=>ok());});
 return src;
};

try{
 await step('00-caps',async()=>{
  const caps=await(await fetch(base+'/api/capabilities')).json();
  const hero=await(await fetch(base+'/api/hero/capabilities')).json();
  report.caps={shot:caps.shot,ffmpeg:caps.ffmpeg?.available,comfy:hero.comfyConnected};
  assert.equal(caps.shot,true);assert.equal(caps.ffmpeg?.available,true);assert.equal(hero.comfyConnected,true);
 });
 await step('01-welcome',async()=>{
  await page.goto(base+'/adstudio/journey.html',{waitUntil:'domcontentloaded'});
  await page.getByText('worth stopping for.').waitFor();
  await click(page.getByRole('button',{name:/Static advertisement/}));
  await page.getByText('Every great ad').waitFor();
 });
 await step('02-introduce',async()=>{
  report.sourceSha256=sha(await readFile(source));
  await page.getByLabel('Upload original photographs').setInputFiles(source);
  await saved();
  await page.getByPlaceholder('What should we call your brand?').fill('No Crumbs Bakery');
  await click(page.getByRole('button',{name:/Let.s begin/}));
  await page.getByText('The stars of your campaign.').waitFor({timeout:120000});
 });
 await step('03-discover',async()=>{
  await page.getByLabel('What can you actually see?').fill('Four chocolate chip cookies closely overlapping in a rectangular foil tray.');
  await page.getByLabel('What can you actually see?').press('Tab');await saved();
  await click(page.getByRole('checkbox',{name:/correct product/}));await saved();
  await click(page.getByText('Product details & source',{exact:true}));
  await page.getByRole('combobox',{name:/^Product category/}).selectOption('cookies');await saved();
  await page.getByLabel('Visible count').fill('4');await page.getByLabel('Visible count').press('Tab');await saved();
 });
 await step('04-direction',async()=>{
  await click(page.getByRole('button',{name:/Find the creative direction/}));
  await page.locator('.concept-card').first().waitFor({timeout:240000});await saved();
  await page.getByRole('checkbox',{name:/checked these visible facts/}).check();
  await click(page.getByRole('button',{name:/Looks good/}));
  await page.locator('.quantity-control').waitFor();
 });
 await step('05-static-png',async()=>{
  await click(page.getByText('Advanced · generation engine',{exact:true}));
  await page.getByRole('combobox',{name:/^Engine/}).selectOption('product-safe');await saved();
  await page.getByRole('checkbox',{name:/approve the specific directions/}).check();
  await click(page.getByRole('button',{name:/^Create \d advertisement/}));
  await page.locator('.campaign-card.ready').first().waitFor({timeout:180000});await saved();
  const waiting=page.waitForEvent('download');
  await click(page.getByRole('button',{name:'Download PNG ↓',exact:true}).first());
  const download=await waiting;const file=join(out,'static-advertisement.png');await download.saveAs(file);
  const bytes=await readFile(file);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  report.staticPng={bytes:bytes.length,sha256:sha(bytes)};
 });
 let noref='';
 await step('06-animate',async()=>{
  assert.equal(await page.getByRole('button',{name:/Animate this ad/}).count()>0,true);
  await click(page.getByRole('button',{name:/Animate this ad/}).first());
  noref=await saveVideo('noref-commercial.mp4');
  assert.match(await page.locator('.journey-videos figcaption').first().innerText(),/shot|Original|Inspired/i);
 });
 await step('07-reference',async()=>{
  await copyFile(ref,join(out,'reference-used.mp4'));
  await page.locator('input[accept*="video"]').setInputFiles(ref);
  await page.locator('.inspiration-meta').waitFor({timeout:180000});
  report.inspiration=await page.locator('.inspiration-meta').innerText();
  assert.match(report.inspiration,/shot/i);
 });
 await step('08-inspired',async()=>{
  const before=await page.locator('.journey-videos video').count();
  await click(page.getByRole('button',{name:/Inspired commercial/}).first());
  await saveVideo('inspired-commercial.mp4',{preferSrc:noref,minCount:Math.max(1,before)});
  assert.match(await page.locator('.journey-videos figcaption').first().innerText(),/Inspired|shot/i);
 });
 await step('09-reload',async()=>{
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.campaign-card.ready').first().waitFor({timeout:60000});
  await page.locator('.journey-videos video').first().waitFor({timeout:60000});
  const count=await page.locator('.journey-videos video').count();
  assert.ok(count>=2,'videos recover after reload');
  report.reloadVideos=count;
 });
 report.pass=true;console.log('PASS final integration E2E',out);
}catch(e){
 report.pass=false;report.error=String(e);console.error(e);process.exitCode=1;
 await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});
}finally{
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 await ctx.close();
}
