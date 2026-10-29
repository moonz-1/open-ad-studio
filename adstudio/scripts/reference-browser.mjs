// Browser: result stage → upload synthetic inspiration → see analysis → Generate inspired commercial.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8303';
const fixturesRoot=process.env.OSH_FIXTURES_ROOT||resolve('outputs/fixtures');
const source=resolve(fixturesRoot,'outputs/ltx25-benchmark/inputs/cookie.source.jpeg');
const ref=resolve('outputs/synthetic-reference/surprise-reveal.mp4');
const out=resolve('outputs/reference-browser-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const ctx=await chromium.launchPersistentContext(join(out,'chrome'),{channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await ctx.newPage();
const report={base,out,sourceHash:sha(await readFile(source)),refHash:sha(await readFile(ref)),steps:[],pass:false};
const step=async(name,fn)=>{const t=Date.now();await fn();report.steps.push({name,ms:Date.now()-t});console.log('PASS',name);await page.screenshot({path:join(out,name+'.png'),fullPage:true});};
const click=async l=>{await l.waitFor({state:'visible',timeout:30000});for(let i=0;i<200;i++){if(await l.isEnabled()){await l.click();return;}await page.waitForTimeout(250);}throw Error('Disabled: '+await l.innerText());};

try{
 await step('01-open',async()=>{await page.goto(base+'/adstudio/',{waitUntil:'domcontentloaded'});await page.locator('.ad-app').waitFor();});
 await step('02-static',async()=>{
  await click(page.getByRole('button',{name:'+ New',exact:true}));
  await page.locator('input[type="file"][accept*="image"]').first().setInputFiles(source);
  await page.getByPlaceholder('Your business name').fill('No Crumbs Bakery');
  await page.locator('label').filter({hasText:/^What.*photograph/}).locator('textarea').fill('Four chocolate chip cookies on walnut.');
  await page.locator('.request-input').fill('Warm bakery commercial with a reveal.');
  await click(page.getByRole('button',{name:/Develop advertisement/}));
  await page.getByRole('button',{name:/Accept direction/}).waitFor({timeout:220000});
  await click(page.getByRole('button',{name:/Accept direction/}));
  await page.locator('.engine-select select').selectOption('product-safe');
  await click(page.getByRole('button',{name:/Generate ad/}));
  await page.getByRole('button',{name:/Export PNG/}).waitFor({timeout:60000});
  await page.locator('label.fidelity input').check();
 });
 await step('03-upload-inspiration',async()=>{
  await page.getByText(/Have a video you like/).click();
  await page.locator('input[accept*="video"]').setInputFiles(ref);
  await page.locator('.inspiration-report').waitFor({timeout:180000});
  const text=await page.locator('.inspiration-report').innerText();
  report.inspirationText=text;
  assert.match(text,/shots/i);
 });
 await step('04-inspired-commercial',async()=>{
  await click(page.getByRole('button',{name:/Generate inspired commercial/}));
  await page.locator('.campaign-video video').first().waitFor({timeout:700000});
  const meta=await page.locator('.campaign-video small').first().innerText();
  report.videoMeta=meta;
  assert.match(meta,/Inspired|LTX/i);
 });
 await step('05-reload',async()=>{
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.campaign-video video').first().waitFor({timeout:60000});
  assert.ok(await page.locator('.campaign-video video').count()>=1);
 });
 report.pass=true;console.log('REFERENCE BROWSER PASS',out);
}catch(e){report.pass=false;report.error=String(e);await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));await ctx.close();}
