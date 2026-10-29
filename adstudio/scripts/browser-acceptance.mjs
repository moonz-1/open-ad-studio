// Isolated Chromium profile browser acceptance for Ad Studio product-safe path.
// Does not touch the owner's IndexedDB profile.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8301';
const out=resolve('outputs/adstudio-browser-acceptance-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const require=createRequire(import.meta.url);
function loadPlaywright(){try{return require('playwright');}catch{return null;}}
let playwright=loadPlaywright();
if(!playwright){
 console.log('Installing playwright@1.55.0 for isolated acceptance…');
 execFileSync('npm',['install','--no-save','--no-package-lock','playwright@1.55.0'],{cwd:resolve('.'),stdio:'inherit',shell:true});
 execFileSync(process.execPath,[join('node_modules','playwright','cli.js'),'install','chromium'],{cwd:resolve('.'),stdio:'inherit'});
 playwright=loadPlaywright();
}
assert.ok(playwright,'playwright required');

const {chromium}=playwright;
const browser=await chromium.launchPersistentContext(join(out,'chrome-profile'),{headless:true,acceptDownloads:true,viewport:{width:1440,height:1100}});
const page=await browser.newPage();
const downloads=[];
page.on('download',async d=>{const target=join(out,'download-'+downloads.length+'-'+d.suggestedFilename());await d.saveAs(target);downloads.push({name:d.suggestedFilename(),path:target,bytes:(await readFile(target)).length,sha256:sha(await readFile(target))});});

const report={startedAt:new Date().toISOString(),base,out,steps:[],downloads,pass:false};
const step=async(name,fn)=>{const started=Date.now();try{await fn();report.steps.push({name,ok:true,ms:Date.now()-started});console.log('OK',name);}catch(e){report.steps.push({name,ok:false,ms:Date.now()-started,error:String(e)});throw e;}};

try{
 await step('open-app',async()=>{
  await page.goto(base+'/adstudio/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('.ad-app, .drop-zone, .journey').first().waitFor({timeout:30000});
  await page.screenshot({path:join(out,'01-open.png'),fullPage:true});
  const footer=await page.locator('footer.app-footer').innerText();
  assert.match(footer,/compose-v2|adstudio/i);
 });

 await step('new-project',async()=>{
  await page.getByRole('button',{name:'+ New'}).click();
  await page.waitForTimeout(600);
 });

 await step('upload-photo',async()=>{
  await page.locator('input[type="file"][accept*="image"]').first().setInputFiles(resolve('outputs/ltx25-benchmark/inputs/cookie.png'));
  await page.getByText(/What’s in your photograph|What.?s in your photograph/i).waitFor({timeout:20000});
  await page.screenshot({path:join(out,'02-product.png'),fullPage:true});
 });

 await step('brand-and-facts',async()=>{
  const brand=page.getByPlaceholder('Your business name');
  if(await brand.count())await brand.fill('No Crumbs Bakery');
  await page.locator('label',{hasText:/photograph/i}).locator('textarea').fill('Four chocolate chip cookies packed in a foil loaf tin on a wooden table.');
  await page.screenshot({path:join(out,'03-facts.png'),fullPage:true});
 });

 await step('develop-direction',async()=>{
  const develop=page.getByRole('button',{name:/Develop advertisement/i});
  await expectEnabled(develop);
  await develop.click();
  await page.getByRole('button',{name:/Accept direction|Generate ad/i}).first().waitFor({timeout:45000});
  await page.screenshot({path:join(out,'04-direction.png'),fullPage:true});
 });

 await step('accept-and-generate',async()=>{
  const accept=page.getByRole('button',{name:/Accept direction/i});
  if(await accept.count()){await expectEnabled(accept);await accept.click();await page.waitForTimeout(800);}
  const engine=page.locator('label.engine-select select, .engine-select select').first();
  await engine.selectOption({value:'product-safe'});
  const generate=page.getByRole('button',{name:/Generate ad/i});
  await expectEnabled(generate);
  await generate.click();
  await page.getByText(/Make it ready to share|Your next ad/i).first().waitFor({timeout:60000});
  await page.screenshot({path:join(out,'05-result.png'),fullPage:true});
  assert.ok(await page.locator('.visual-stage img, .stage-title').count()>0);
 });

 await step('edit-and-export',async()=>{
  await page.locator('label',{hasText:'Headline'}).locator('input').fill('Warm cookies, ready now.');
  await page.locator('label.fidelity input[type="checkbox"]').check();
  const exportBtn=page.getByRole('button',{name:/Export PNG/i});
  await expectEnabled(exportBtn);
  await exportBtn.click();
  await page.waitForTimeout(3000);
  assert.ok(downloads.length>=1,'Browser must download advertisement.png');
  const bytes=await readFile(downloads[0].path);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.ok(bytes.length>80_000,'Downloaded ad must be a real composition');
  await page.screenshot({path:join(out,'06-exported.png'),fullPage:true});
 });

 await step('refresh-preserves',async()=>{
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.ad-app').waitFor({timeout:30000});
  await page.waitForTimeout(1200);
  await page.screenshot({path:join(out,'07-refresh.png'),fullPage:true});
  const keepers=await page.getByText(/Saved advertisements|Advertisement preview|Warm cookies|Product-safe/i).count();
  assert.ok(keepers>0,'Refresh should keep generated work');
 });

 report.pass=true;
}catch(e){
 report.error=String(e);
 console.error(e);
 process.exitCode=1;
}finally{
 report.finishedAt=new Date().toISOString();
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 await browser.close().catch(()=>{});
 console.log(report.pass?'BROWSER ACCEPTANCE PASS':'BROWSER ACCEPTANCE FAIL',out);
}

async function expectEnabled(locator){
 await locator.waitFor({state:'visible',timeout:20000});
 for(let i=0;i<40;i++){if(await locator.isEnabled())return;await page.waitForTimeout(250);}
 throw Error('Control stayed disabled: '+(await locator.innerText().catch(()=>'unknown')));
}
