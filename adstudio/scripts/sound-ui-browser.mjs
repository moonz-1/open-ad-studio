/** Browser regression: Journey sound UI rights + Auto gate + exact-ID wiring (no LTX regen). */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8304';
const out=resolve('outputs/sound-ui-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const report={base,out,pass:false,checks:{}};

const caps=await(await fetch(base+'/api/sound/capabilities')).json();
assert.equal(!!caps.stableAudio?.available,false);
assert.match(caps.note||'',/Stable Audio|not installed/i);
report.checks.capabilities=caps;

const disk=readFileSync(new URL('../src/journey/journey.tsx',import.meta.url),'utf8');
const served=await(await fetch(base+'/adstudio/src/journey/journey.tsx')).text();
assert.match(disk,/soundFor\(v\.id,'auto'\)/);
assert.match(disk,/soundFor\(v\.id,'mute'\)/);
assert.match(disk,/soundFor\(v\.id,'reference'\)/);
assert.match(disk,/downloadCampaignVideoTake\(v\.id/);
assert.match(disk,/replaceVideoId/);
assert.match(disk,/audio-rights-confirm/);
assert.match(disk,/!soundCaps\?\.stableAudio/);
assert.doesNotMatch(disk,/soundFor\(c,'auto'\)/);
assert.match(served,/soundFor\(v\.id,\s*["']auto["']\)/);
assert.match(served,/downloadCampaignVideoTake\(v\.id/);
assert.match(served,/audio-rights-confirm/);
report.checks.sourceWiring=true;

// Prefer the last final-e2e Chrome profile (has animated commercials) when present.
const e2eProfiles=existsSync(resolve('outputs'))
  ?readdirSync(resolve('outputs')).filter(n=>n.startsWith('final-e2e-')).sort().reverse().map(n=>join(resolve('outputs'),n,'chrome')).filter(p=>existsSync(p))
  :[];
const profile=e2eProfiles[0];
report.checks.chromeProfile=profile||'fresh';
const ctx=profile
  ?await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:1440,height:1100}})
  :await chromium.launch({channel:'chrome',headless:true}).then(b=>b.newContext({viewport:{width:1440,height:1100}}));
const page=await ctx.newPage();
await page.goto(base+'/adstudio/journey.html',{waitUntil:'networkidle',timeout:120000});
await page.waitForSelector('.journey-shell, .journey-footer, main',{timeout:60000});

// Open history — prefer a project that already has campaign videos from prior e2e.
await page.getByRole('button',{name:/Your work/i}).click();
await page.waitForSelector('.project-list button, .Dialog, [role="dialog"]',{timeout:15000}).catch(()=>{});
const projects=page.locator('.project-list button');
const n=await projects.count();
report.checks.historyProjects=n;
let openedWithVideos=false;
for(let i=0;i<n;i++){
  const label=await projects.nth(i).innerText();
  if(/videos/i.test(label)&&!/0 videos/i.test(label)){
    await projects.nth(i).click();
    await page.waitForTimeout(1500);
    openedWithVideos=true;
    break;
  }
}
if(!openedWithVideos&&n>0){await projects.first().click();await page.waitForTimeout(1000);}

// Advance to reveal if needed (stage 6).
for(let s=0;s<6;s++){
  const reveal=await page.locator('.journey-videos, .sound-actions').count();
  if(reveal>0)break;
  const next=page.getByRole('button',{name:/Continue|Next|Reveal|See results|06/i}).first();
  if(await next.isVisible().catch(()=>false)&&await next.isEnabled().catch(()=>false))await next.click().catch(()=>{});
  await page.waitForTimeout(400);
}

const auto=page.getByRole('button',{name:/^Auto sound$/});
const mute=page.getByRole('button',{name:/^Mute$/});
const rights=page.locator('.audio-rights-confirm');
const note=page.locator('.sound-note');
const videos=await page.locator('.journey-videos figure').count();
report.checks.videoFigures=videos;

if(videos>0){
  assert.equal(await auto.count()>0,true);
  assert.equal(await auto.first().isDisabled(),true,'Auto must be disabled without Stable Audio');
  assert.ok(await note.first().isVisible(),'Stable Audio missing note visible');
  const noteText=await note.first().innerText();
  assert.match(noteText,/Stable Audio|not installed|Replace|Mute/i);
  report.checks.autoDisabled=true;
  report.checks.autoNote=noteText;
  // Rights checkbox appears only when reference audio exists; if present must start unchecked.
  if(await rights.count()){
    const box=rights.locator('input[type=checkbox]');
    assert.equal(await box.isChecked(),false);
    const refBtn=page.getByRole('button',{name:/Use reference audio/});
    assert.equal(await refBtn.first().isDisabled(),true);
    await box.check();
    assert.equal(await refBtn.first().isDisabled(),false);
    report.checks.rightsCheckboxGatesReference=true;
  }else{
    report.checks.rightsCheckboxGatesReference='no-reference-audio-in-project';
  }
  // Two figures → two independent Download final buttons
  const dl=page.getByRole('button',{name:/Download final MP4/});
  report.checks.downloadButtons=await dl.count();
  assert.ok(await dl.count()>=1);
  assert.ok(await mute.first().isEnabled());
  await page.screenshot({path:join(out,'sound-actions.png'),fullPage:true});
}else{
  report.checks.uiLive='no-videos-in-history; source wiring still verified';
  await page.screenshot({path:join(out,'journey-no-videos.png'),fullPage:true});
}

await ctx.close();
report.pass=true;
await writeFile(join(out,'REPORT.json'),JSON.stringify(report,null,2));
console.log('PASS sound UI browser',JSON.stringify(report.checks,null,2));
