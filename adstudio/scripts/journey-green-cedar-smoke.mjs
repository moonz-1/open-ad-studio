/** Browser Journey: Abel Green Cedar product-safe path on live localhost. */
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';

const base=process.env.ADSTUDIO_JOURNEY_URL||'http://127.0.0.1:8310';
const out=resolve('outputs','journey','green-cedar-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(out,{recursive:true});
const source=resolve('outputs/fixtures/abel/green-cedar.png');
const report={out,base,pass:false,steps:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await (await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1050}})).newPage();
const step=async(name,fn)=>{const t=Date.now();await fn();report.steps.push({name,ms:Date.now()-t});await page.screenshot({path:join(out,name+'.png')});};
const click=async loc=>{await loc.click({timeout:60000});};
const saved=()=>page.locator('.journey-footer').getByText('Saved on this browser').waitFor({timeout:120000});
try{
 await step('01-welcome',async()=>{await page.goto(base+'/adstudio/journey.html',{waitUntil:'domcontentloaded'});await click(page.getByTestId('journey-start-static'));});
 await step('02-introduce',async()=>{
  await page.getByLabel('Upload original photographs').setInputFiles(source);
  await saved();
  await page.getByPlaceholder('What should we call your brand?').fill('Abel');
  await page.getByPlaceholder('What should we call your brand?').press('Tab');
  await saved();
  await click(page.getByTestId('journey-begin'));
  await page.getByText('The stars of your campaign.').waitFor({timeout:60000});
 });
 await step('03-discover',async()=>{
  await page.getByLabel('What can you actually see?').fill('One frosted glass Green Cedar perfume bottle with a cream cap.');
  await page.getByLabel('What can you actually see?').press('Tab');
  await saved();
  // Set category packaged-goods for beauty routing
  await page.getByText('Product details & source').click();
  await page.locator('select').first().selectOption('packaged-goods');
  await saved();
  await page.getByRole('checkbox',{name:/permission to use this photograph/i}).check();
  await saved();
  await click(page.getByTestId('journey-develop'));
  await page.locator('.concept-card').first().waitFor({timeout:90000});
 });
 await step('04-direction',async()=>{
  await page.locator('.concept-card').first().click();
  await page.getByTestId('journey-confirm-facts').waitFor();
  assert.equal(await page.getByTestId('journey-confirm-facts').locator('input[type=checkbox]').count(),0,'No facts checkbox');
  await click(page.getByTestId('journey-approve-direction'));
  await page.getByTestId('journey-editions').waitFor({timeout:60000});
 });
 await step('05-editions',async()=>{
  const advanced=page.getByText(/Advanced · generation engine/i);
  if(await advanced.count()){await click(advanced.first());await page.getByTestId('journey-engine').selectOption('product-safe');await saved();}
  assert.equal(await page.getByTestId('journey-approve-editions').locator('input[type=checkbox]').count(),0,'No batch checkbox');
  await click(page.getByTestId('journey-create-ads'));
  await page.getByTestId('journey-reveal').waitFor({timeout:120000});
  await page.locator('.campaign-card.ready').first().waitFor({timeout:120000});
 });
 await step('06-export-reload',async()=>{
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Download PNG/i}).first().click()]);
  const dest=join(out,'advertisement.png');await download.saveAs(dest);
  assert.ok((await readFile(dest)).length>20000);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.getByTestId('journey-reveal').waitFor({timeout:60000});
  await page.locator('.campaign-card.ready').first().waitFor();
 });
 report.pass=true;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 console.log('PASS green-cedar journey',out);
}catch(e){report.error=String(e);report.pass=false;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}
finally{await browser.close();}
