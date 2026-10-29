// Browser E2E: (A) no-ref Animate multi-shot (B) reference-inspired multi-shot. Saves MP4s + screenshots.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8303';
const fixturesRoot=process.env.OSH_FIXTURES_ROOT||resolve('outputs/fixtures');
const source=resolve(fixturesRoot,'outputs/ltx25-benchmark/inputs/cookie.source.jpeg');
const ref=process.env.OSH_REF_VIDEO||resolve('outputs/synthetic-reference/surprise-reveal.mp4');
const out=resolve('outputs/multishot-e2e-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const ctx=await chromium.launchPersistentContext(join(out,'chrome'),{channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await ctx.newPage();
const report={base,out,ref,steps:[],pass:false};
const step=async(name,fn)=>{const t=Date.now();await fn();report.steps.push({name,ms:Date.now()-t});console.log('PASS',name,(Date.now()-t)+'ms');await page.screenshot({path:join(out,name+'.png'),fullPage:true});};
const click=async l=>{await l.waitFor({state:'visible',timeout:30000});for(let i=0;i<240;i++){if(await l.isEnabled()){await l.click();return;}await page.waitForTimeout(250);}throw Error('Disabled: '+await l.innerText());};
const saveVideo=async(name,{preferSrc,minCount=1,timeout=900000}={})=>{
 const started=Date.now();
 let src='';
 while(Date.now()-started<timeout){
  const count=await page.locator('.campaign-video video').count();
  if(count>=minCount){
   src=await page.locator('.campaign-video video').first().getAttribute('src')||'';
   if(src&&(!preferSrc||src!==preferSrc))break;
  }
  await page.waitForTimeout(1000);
 }
 assert.ok(src&&(!preferSrc||src!==preferSrc),`expected new video src (avoided ${preferSrc||'none'})`);
 const r=await page.request.get(base+src);const bytes=Buffer.from(await r.body());
 await writeFile(join(out,name),bytes);
 report[name]={src,bytes:bytes.length,sha256:sha(bytes)};
 await new Promise((ok)=>{const p=spawn(ffmpeg,['-y','-i',join(out,name),'-ss','0.05','-vframes','1',join(out,name+'-first.jpg'),'-ss','1.0','-vframes','1',join(out,name+'-mid.jpg'),'-sseof','-0.15','-vframes','1',join(out,name+'-final.jpg')],{stdio:'ignore'});p.on('close',()=>ok());});
 return src;
};

try{
 await step('01-open',async()=>{await page.goto(base+'/adstudio/',{waitUntil:'domcontentloaded'});await page.locator('.ad-app').waitFor();});
 await step('02-static',async()=>{
  await click(page.getByRole('button',{name:'+ New',exact:true}));
  await page.locator('input[type="file"][accept*="image"]').first().setInputFiles(source);
  await page.getByPlaceholder('Your business name').fill('No Crumbs Bakery');
  await page.locator('label').filter({hasText:/^What.*photograph/}).locator('textarea').fill('Four chocolate chip cookies on walnut with cream linen.');
  await page.locator('.request-input').fill('Warm bakery lifestyle moment for a short commercial.');
  await click(page.getByRole('button',{name:/Develop advertisement/}));
  await page.getByRole('button',{name:/Accept direction/}).waitFor({timeout:220000});
  await click(page.getByRole('button',{name:/Accept direction/}));
  await page.locator('.engine-select select').selectOption('product-safe');
  await click(page.getByRole('button',{name:/Generate ad/}));
  await page.getByRole('button',{name:/Export PNG/}).waitFor({timeout:60000});
  await page.locator('label.fidelity input').check();
 });
 let norefSrc='';
 await step('03-noref-multishot',async()=>{
  await click(page.getByRole('button',{name:/Animate this ad/}));
  await page.locator('.job-status, .campaign-video video').first().waitFor({timeout:20000});
  norefSrc=await saveVideo('noref-commercial.mp4');
  const meta=await page.locator('.campaign-video small').first().innerText();
  report.norefMeta=meta;
  assert.match(meta,/Original|Inspired|shot/i);
 });
 await step('04-upload-ref',async()=>{
  await copyFile(ref,join(out,'reference-used.mp4'));
  await page.getByText(/Have a video you like/).click();
  await page.locator('input[accept*="video"]').setInputFiles(ref);
  await page.locator('.inspiration-report').waitFor({timeout:180000});
  report.inspiration=await page.locator('.inspiration-report').innerText();
  assert.match(report.inspiration,/shot/i);
 });
 await step('05-inspired-multishot',async()=>{
  const before=await page.locator('.campaign-video video').count();
  await click(page.getByRole('button',{name:/Generate inspired commercial/}));
  await page.locator('.job-status').first().waitFor({timeout:20000}).catch(()=>{});
  await saveVideo('inspired-commercial.mp4',{preferSrc:norefSrc,minCount:Math.max(1,before)});
  report.inspiredMeta=await page.locator('.campaign-video small').first().innerText();
  assert.match(report.inspiredMeta,/Inspired|shot/i);
  assert.notEqual(report['inspired-commercial.mp4'].sha256,report['noref-commercial.mp4'].sha256,'inspired must be a new encode');
 });
 await step('06-reload',async()=>{
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.campaign-video video').first().waitFor({timeout:60000});
  report.persisted=await page.locator('.campaign-video video').count();
  assert.ok(report.persisted>=1);
 });
 await step('07-download',async()=>{
  const link=page.locator('.campaign-video a',{hasText:/MP4|WebM/i}).first();
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:60000}),link.click()]);
  const dest=join(out,'download-'+dl.suggestedFilename());
  await dl.saveAs(dest);
  const bytes=await readFile(dest);
  report.download={file:dest,bytes:bytes.length,sha256:sha(bytes)};
  assert.ok(bytes.length>20000);
 });
 report.pass=true;console.log('MULTISHOT E2E PASS',out);
}catch(e){report.pass=false;report.error=String(e);await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await ctx.close();}
