/** Consolidated release acceptance for /adstudio/ Journey default. Never clears storage. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8304';
const out=resolve('outputs/release-acceptance-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const report={base,out,pass:false,checks:{},failed:[],screenshots:[]};
const check=async(name,fn)=>{try{await fn();report.checks[name]='PASS';console.log('PASS',name);}catch(e){report.checks[name]='FAIL';report.failed.push({name,error:String(e.message||e)});console.error('FAIL',name,e.message||e);}};
const snap=async(page,name)=>{const path=join(out,name+'.png');await page.screenshot({path,fullPage:true});report.screenshots.push(name+'.png');};

const e2eProfiles=(await readdir(resolve('outputs')).catch(()=>[])).filter(n=>n.startsWith('final-e2e-')).sort().reverse()
  .map(n=>join(resolve('outputs'),n,'chrome')).filter(p=>existsSync(p));
const profile=e2eProfiles[0];
report.chromeProfile=profile||'fresh';

await check('00-capabilities',async()=>{
  const caps=await(await fetch(base+'/api/capabilities')).json();
  const sound=await(await fetch(base+'/api/sound/capabilities')).json();
  const hero=await(await fetch(base+'/api/hero/capabilities')).json().catch(()=>({}));
  report.caps={shot:!!caps.shot,ffmpeg:!!caps.ffmpeg?.available,comfy:!!hero.comfyConnected,stableAudio:!!sound.stableAudio?.available,soundNote:sound.note};
  assert.equal(!!caps.ffmpeg?.available,true);
  assert.equal(!!sound.stableAudio?.available,false);
});

const ctx=profile
  ?await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:1440,height:1100}})
  :await chromium.launch({channel:'chrome',headless:true}).then(b=>b.newContext({acceptDownloads:true,viewport:{width:1440,height:1100}}));
const page=await ctx.newPage();
page.on('pageerror',e=>report.failed.push({name:'pageerror',error:e.message}));

await check('01-default-entrypoint',async()=>{
  const r=await page.goto(base+'/adstudio/',{waitUntil:'networkidle',timeout:120000});
  assert.ok(r&&r.ok());
  await page.waitForSelector('.journey-shell, .wordmark',{timeout:60000});
  assert.match(page.url(),/\/adstudio\/?$/);
  assert.equal(await page.locator('#journey-root').count(),1);
  assert.equal(await page.locator('#adstudio-root').count(),0);
  await snap(page,'01-default-journey');
});

await check('02-legacy-fallback-link',async()=>{
  const link=page.locator('a.legacy-link');
  assert.equal(await link.count(),1);
  assert.match(await link.getAttribute('href')||'',/workspace\.html/);
});

await check('03-ltx-gate',async()=>{
  // Welcome may already be past stage 1 if recovered project; open Your work / start if needed.
  const offlinePill=page.locator('.format-card.video-card[aria-disabled="true"] .pill, .format-card .pill');
  const videoBtn=page.getByRole('button',{name:/Create a short film|Short video|MOTION/i});
  if(report.caps.comfy&&report.caps.shot){
    // Online: motion card should be an enabled button when on welcome.
    if(await page.getByRole('button',{name:/Make an advertisement|Static advertisement/i}).count()){
      assert.equal(await page.locator('.format-card.video-card[aria-disabled="true"]').count(),0);
      assert.ok(await videoBtn.first().isEnabled());
    }
    report.ltxGate='online-enabled-or-past-welcome';
  }else{
    if(await page.locator('.format-card.video-card[aria-disabled="true"]').count()){
      assert.match(await page.locator('.format-card.video-card[aria-disabled="true"]').innerText(),/offline|Comfy|LTX|FFmpeg|unavailable/i);
    }
    report.ltxGate='offline-disabled';
  }
});

await check('04-project-recovery',async()=>{
  await page.getByRole('button',{name:/Your work/i}).click();
  await page.waitForSelector('.project-list button',{timeout:15000});
  const n=await page.locator('.project-list button').count();
  report.historyProjects=n;
  assert.ok(n>=1,'Existing IndexedDB projects must remain accessible');
  // Prefer a project that lists videos.
  let opened=false;
  for(let i=0;i<n;i++){
    const t=await page.locator('.project-list button').nth(i).innerText();
    if(/videos/i.test(t)&&!/0 videos/i.test(t)){
      await page.locator('.project-list button').nth(i).click();
      opened=true;break;
    }
  }
  if(!opened)await page.locator('.project-list button').first().click();
  await page.waitForTimeout(1500);
  // Advance toward Reveal if needed without regenerating.
  for(let i=0;i<8;i++){
    if(await page.locator('.campaign-gallery, .journey-videos, .media-tabs').count())break;
    const reveal=page.getByRole('button',{name:/Reveal|06/i});
    if(await reveal.count()&&await reveal.first().isEnabled().catch(()=>false)){await reveal.first().click().catch(()=>{});}
    else{
      const next=page.locator('.journey-header nav button:not([disabled])').last();
      if(await next.count())await next.click().catch(()=>{});
    }
    await page.waitForTimeout(600);
  }
  await snap(page,'04-recovered-project');
});

await check('05-video-viewer-and-targeting',async()=>{
  const figures=page.locator('.journey-videos figure');
  const tabs=page.locator('.media-tabs button');
  report.videoFigures=await figures.count();
  report.mediaTabs=await tabs.count();
  assert.ok(await figures.count()>=1||await tabs.count()>=2,'Need at least one commercial video in results');
  if(await tabs.count()>=2){
    await tabs.nth(1).click();
    await page.waitForSelector('video.campaign-player',{timeout:15000});
    const src=await page.locator('video.campaign-player').first().getAttribute('src');
    assert.ok(src&&/^\/outputs\//.test(src),'featured player must load /outputs media');
    report.featuredVideoSrc=src;
    // Exact targeting: each film figure owns its soundtrack panel + download (may be inside <details>).
    const panels=page.locator('.sound-panel');
    assert.ok(await panels.count()>=1);
    await panels.first().locator('summary').click();
    const downloads=page.locator('.sound-actions button',{hasText:/Download final MP4/i});
    assert.ok(await downloads.count()>=1,'each video take exposes Download final MP4');
    report.downloadButtons=await downloads.count();
    // Second film tab must retarget the player to a different take when available.
    if(await tabs.count()>=3){
      await tabs.nth(2).click();
      await page.waitForTimeout(400);
      const src2=await page.locator('video.campaign-player').first().getAttribute('src');
      report.secondFilmSrc=src2;
      assert.ok(src2&&src2!==src,'Film 02 must select a different video take than Film 01');
    }
  }
  await snap(page,'05-video-results');
});

await check('06-sound-controls',async()=>{
  const panels=page.locator('.sound-panel');
  assert.ok(await panels.count()>=2,'each commercial video has its own soundtrack panel');
  // Open both panels without toggling closed (check 05 may already have opened the first).
  await page.evaluate(()=>{document.querySelectorAll('.sound-panel').forEach(d=>{d.open=true;});});
  const auto=page.locator('.sound-actions button',{hasText:/^Auto sound$/});
  const mute=page.locator('.sound-actions button',{hasText:/^Mute$/});
  const replace=page.locator('.sound-actions button',{hasText:/Replace soundtrack/});
  const dl=page.locator('.sound-actions button',{hasText:/Download final MP4/});
  assert.ok(await auto.count()>=2);
  assert.ok(await mute.count()>=2);
  assert.ok(await dl.count()>=2);
  for(let i=0;i<await auto.count();i++)assert.equal(await auto.nth(i).isDisabled(),true,'Auto gated per video');
  assert.ok(await page.locator('.sound-note').first().isVisible());
  assert.equal(await mute.first().isDisabled(),false);
  assert.equal(await replace.first().isDisabled(),false);
  assert.equal(await dl.first().isDisabled(),false);
  if(await page.locator('.audio-rights-confirm').count()){
    assert.equal(await page.locator('.audio-rights-confirm input[type=checkbox]').isChecked(),false);
  }
  await snap(page,'06-sound-controls');
});

await check('07-classic-workspace-same-origin',async()=>{
  const ws=await ctx.newPage();
  await ws.goto(base+'/adstudio/workspace.html',{waitUntil:'networkidle',timeout:120000});
  await ws.waitForSelector('#adstudio-root, .ad-app, .boot',{timeout:60000});
  assert.equal(await ws.locator('#adstudio-root').count(),1);
  // Same IndexedDB: history / projects should be reachable without wipe.
  const projects=await ws.evaluate(async()=>new Promise((ok,fail)=>{
    const req=indexedDB.open('osh-adstudio-projects');
    req.onerror=()=>fail(req.error);
    req.onsuccess=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('projects')){ok({count:0});db.close();return;}
      const tx=db.transaction('projects','readonly');
      const g=tx.objectStore('projects').getAll();
      g.onsuccess=()=>{ok({count:(g.result||[]).length,ids:(g.result||[]).slice(0,5).map(p=>p.id)});db.close();};
      g.onerror=()=>fail(g.error);
    };
  }));
  report.indexedDbProjects=projects;
  assert.ok(projects.count>=1,'Classic workspace must see the same IndexedDB projects');
  await snap(ws,'07-classic-workspace');
  await ws.close();
});

await check('08-mobile-label-readability',async()=>{
  const mobile=await ctx.newPage();
  await mobile.setViewportSize({width:390,height:844});
  await mobile.goto(base+'/adstudio/',{waitUntil:'networkidle',timeout:120000});
  await mobile.waitForSelector('.journey-shell',{timeout:60000});
  const sizes=await mobile.evaluate(()=>{
    const pick=(sel)=>[...document.querySelectorAll(sel)].slice(0,6).map(el=>{
      const cs=getComputedStyle(el);return {sel,text:(el.textContent||'').trim().slice(0,40),fontSize:parseFloat(cs.fontSize)};
    });
    return [...pick('.eyebrow'),...pick('.media-caption'),...pick('.welcome-note'),...pick('.legacy-link'),...pick('.sound-note')];
  });
  report.mobileLabelSizes=sizes;
  for(const row of sizes){
    if(!row.text)continue;
    assert.ok(row.fontSize>=10,`${row.sel} too small: ${row.fontSize}px (${row.text})`);
  }
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await snap(mobile,'08-mobile-welcome');
  await mobile.close();
});

await check('09-journey-alias',async()=>{
  const p2=await ctx.newPage();
  await p2.goto(base+'/adstudio/journey.html',{waitUntil:'networkidle',timeout:120000});
  await p2.waitForSelector('.journey-shell',{timeout:60000});
  assert.equal(await p2.locator('#journey-root').count(),1);
  await p2.close();
});

await ctx.close();
report.pass=report.failed.filter(f=>f.name!=='pageerror').length===0;
await writeFile(join(out,'REPORT.json'),JSON.stringify(report,null,2));
console.log(report.pass?'RELEASE ACCEPTANCE PASS':'RELEASE ACCEPTANCE FAIL',out);
console.log(JSON.stringify({pass:report.pass,checks:report.checks,failed:report.failed,screenshots:report.screenshots},null,2));
if(!report.pass)process.exit(1);
