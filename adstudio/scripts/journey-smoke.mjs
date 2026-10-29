// FAST Journey UI smoke: deterministic creative direction, product-safe export.
// Requires ADSTUDIO_CREATIVE_DETERMINISTIC=1 on the Journey server (no Qwen TextGenerate).
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const base=process.env.ADSTUDIO_JOURNEY_URL||'http://127.0.0.1:8302';
const out=resolve('outputs','journey','smoke-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(out,{recursive:true});
const report={out,base,pass:false,steps:[],friction:[],errors:[]};
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=resolve('outputs/fixtures/ltx25-benchmark/inputs/cookie.source.jpeg');
report.sourceSha256=sha(await readFile(source));

const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1050}});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
const step=async(name,fn)=>{const t=Date.now();await fn();report.steps.push({name,ms:Date.now()-t});await page.screenshot({path:join(out,name+'.png')});};
const click=async loc=>{await loc.click({timeout:60000});await page.waitForTimeout(100);};
const saved=()=>page.locator('.journey-footer').getByText('Saved on this browser').waitFor({timeout:120000});

try{
 await step('01-welcome',async()=>{
  await page.goto(base+'/adstudio/journey.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.getByTestId('journey-start-static').waitFor({timeout:30000});
  await click(page.getByTestId('journey-start-static'));
 });

 await step('02-introduce',async()=>{
  await page.getByLabel('Upload original photographs').setInputFiles(source);
  await saved();
  await page.getByPlaceholder('What should we call your brand?').fill('No Crumbs Bakery');
  await page.getByPlaceholder('What should we call your brand?').press('Tab');
  await saved();
  await click(page.getByTestId('journey-begin'));
  await page.getByText('The stars of your campaign.').waitFor({timeout:60000});
 });

 await step('03-discover',async()=>{
  await page.getByLabel('What can you actually see?').fill('Four chocolate chip cookies in a rectangular foil tray.');
  await page.getByLabel('What can you actually see?').press('Tab');
  await saved();
  await click(page.locator('label.check').filter({hasText:/permission to use this photograph/i}));
  await page.locator('.source-card.is-ready').first().waitFor({timeout:60000});
  await saved();
  await click(page.getByTestId('journey-develop'));
  // Deterministic planning should return concept cards quickly (no Comfy TextGenerate).
  await page.locator('.concept-card').first().waitFor({timeout:90000});
 });

 await step('04-direction',async()=>{
  await page.locator('.concept-card').first().click();
  await page.getByTestId('journey-confirm-facts').waitFor({state:'visible'});
  const approve=page.getByTestId('journey-approve-direction');
  await approve.waitFor({state:'visible'});
  for(let i=0;i<50&&await approve.isDisabled();i++)await page.waitForTimeout(100);
  if(await approve.isDisabled()){
   const gate=await page.locator('#direction-gate').textContent().catch(()=>'');
   throw Error('Approve direction stayed disabled: '+gate);
  }
  page.once('dialog',d=>d.dismiss().catch(()=>{}));
  await click(approve);
  // Surface app toast / banner if preflight blocks stage advance
  const banner=page.getByText(/Something blocked the last step/i);
  await Promise.race([
   page.getByTestId('journey-editions').waitFor({timeout:60000}),
   banner.waitFor({timeout:60000}).then(async()=>{throw Error(await banner.textContent()||'preflight blocked');})
  ]);
  await page.getByTestId('journey-quantity').waitFor();
 });

 await step('05-editions',async()=>{
  // Force product-safe first (no GPU / no Comfy probe on create).
  const advanced=page.getByText(/Advanced · generation engine/i);
  if(await advanced.count()){
   await click(advanced.first());
   await page.getByTestId('journey-engine').selectOption('product-safe');
   await saved();
  }
  await page.getByTestId('journey-approve-editions').waitFor({state:'visible'});
  const create=page.getByTestId('journey-create-ads');
  for(let i=0;i<50&&await create.isDisabled();i++)await page.waitForTimeout(100);
  if(await create.isDisabled()){
   const gate=await page.locator('#editions-gate').textContent().catch(()=>'');
   throw Error('Create ads stayed disabled: '+gate);
  }
  await click(create);
  const banner=page.getByText(/Something blocked the last step/i);
  await Promise.race([
   page.getByTestId('journey-reveal').waitFor({timeout:120000}),
   banner.waitFor({timeout:120000}).then(async()=>{throw Error(await banner.textContent()||'create blocked');})
  ]);
  await page.locator('.campaign-card.ready').first().waitFor({timeout:120000});
 });

 await step('06-export-edit',async()=>{
  const waiting=page.waitForEvent('download',{timeout:60000});
  await click(page.getByRole('button',{name:'Download PNG ↓',exact:true}).first());
  const dl=await waiting;
  const file=join(out,'advertisement.png');
  await dl.saveAs(file);
  const bytes=await readFile(file);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  report.downloadSha256=sha(bytes);

  await click(page.getByRole('button',{name:'Edit copy',exact:true}).first());
  await page.getByLabel('Headline',{exact:true}).fill('Leave Nothing Behind');
  await page.getByRole('checkbox',{name:/compared the product/i}).check();
  const edited=page.waitForEvent('download',{timeout:60000});
  await click(page.getByRole('button',{name:'Save & download PNG ↓',exact:true}));
  await (await edited).saveAs(join(out,'advertisement-edited.png'));
  await click(page.getByRole('button',{name:'Close preview'}));
 });

 await step('07-persist',async()=>{
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.campaign-card.ready').first().waitFor({timeout:60000});
  report.pass=true;
 });

 console.log('PASS Journey smoke',out);
}catch(e){
 report.pass=false;
 report.error=String(e);
 report.friction.push('Failed at smoke navigation — see screenshots in '+out);
 await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});
 console.error(e);
 process.exitCode=1;
}finally{
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 await context.close();
 await browser.close();
}
