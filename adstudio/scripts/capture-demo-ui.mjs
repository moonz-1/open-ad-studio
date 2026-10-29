/**
 * Capture RC Journey UI screenshots into the demo package (read-only; no RC edits).
 * Default base: http://127.0.0.1:8341
 */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const base=process.env.OSH_DEMO_URL||'http://127.0.0.1:8341';
const out=process.argv[2]||'C:<home>/open-ad-studio-demo-output/public-demo/2026-10-29T20-21-57/05-ui-screenshots';
await mkdir(out,{recursive:true});

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
const page=await context.newPage();
const shots=[];

async function shot(name,note){
  const file=`${String(shots.length+1).padStart(2,'0')}-${name}.png`;
  await page.screenshot({path:join(out,file),fullPage:false});
  shots.push({file,note,url:page.url()});
  console.log('shot',file,note);
}

try{
  await page.goto(base+'/adstudio/journey.html',{waitUntil:'networkidle',timeout:60000});
  await page.waitForTimeout(1500);
  await shot('journey-create','Step 01 Create — modality choice');

  const adBtn=page.getByRole('button',{name:/Create an advertisement/i});
  if(await adBtn.count()){
    await adBtn.first().click();
    await page.waitForTimeout(1200);
    await shot('journey-after-create','After choosing advertisement');
  }

  // Advance through enabled steps if possible
  for(const label of ['Introduce','Discover','Direction','Editions','Reveal']){
    const step=page.getByRole('button',{name:new RegExp(label,'i')});
    if(await step.count()&&!(await step.first().isDisabled())){
      await step.first().click();
      await page.waitForTimeout(1000);
      await shot(`journey-${label.toLowerCase()}`,`Step — ${label}`);
    }
  }

  // Classic workspace
  const classic=page.getByRole('link',{name:/Classic workspace/i});
  if(await classic.count()){
    await classic.first().click();
    await page.waitForTimeout(1500);
    await shot('classic-workspace','Classic workspace entry');
  }

  // Projects / Your work if dialog
  await page.goto(base+'/adstudio/',{waitUntil:'networkidle',timeout:60000}).catch(()=>{});
  await page.waitForTimeout(1000);
  await shot('adstudio-index','Ad Studio index / landing');

  await page.goto(base+'/adstudio/journey.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(800);
  const work=page.getByRole('button',{name:/Your work/i});
  if(await work.count()){
    await work.first().click();
    await page.waitForTimeout(1000);
    await shot('your-work','Your work / project persistence panel');
  }
}catch(e){
  console.error('capture-error',e.message);
  await shot('error-state',String(e.message));
}

await writeFile(join(out,'SHOTS.json'),JSON.stringify({base,shots,note:'RC UI captured read-only. Not a live generation recording.'},null,2));
await writeFile(join(out,'README.txt'),[
  'UI screenshots from the release candidate Journey (read-only).',
  `Base URL: ${base}`,
  'These demonstrate real application chrome — not mocked.',
  'Do not imply that Generate/FLUX ran during this capture.',
  ''
].join('\n'));
await browser.close();
console.log(JSON.stringify({out,count:shots.length},null,2));
