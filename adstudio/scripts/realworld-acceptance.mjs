// ONE real Journey acceptance on 8304: Klein Creative Restage → PNG → Animate LTX → MP4.
// Fresh Playwright profile. Real Comfy inference. No mocks. Does not wipe IndexedDB.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile,copyFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8304';
const fixturesRoot=process.env.OSH_FIXTURES_ROOT||resolve('outputs/fixtures');
const source=resolve(fixturesRoot,'outputs/ltx25-benchmark/inputs/cookie.source.jpeg');
const out=resolve('outputs/realworld-acceptance-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
await mkdir(out,{recursive:true});
await mkdir(join(out,'frames'),{recursive:true});
await mkdir(join(out,'screens'),{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={
 base,out,source,branch:'feat/adstudio-final-integration',
 engine:'klein',steps:[],pass:false,
 technicalPass:false,commercialApproval:'PENDING_OWNER',
 storageNote:'Journey (/adstudio/) and Classic (/adstudio/workspace.html) share IndexedDB osh-adstudio-projects on origin http://127.0.0.1:8304. This does NOT migrate data from :8301.',
};
assert.ok(existsSync(source),'authorized cookie.source.jpeg missing');
await copyFile(source,join(out,'cookie.source.jpeg'));
report.sourceSha256=sha(await readFile(source));

const ctx=await chromium.launchPersistentContext(join(out,'chrome'),{
 channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:1440,height:1100},
 args:['--disable-gpu','--disable-dev-shm-usage'],
});
const page=await ctx.newPage();
page.on('pageerror',e=>report.steps.push({pageerror:e.message}));
page.on('console',m=>{if(['error','warning'].includes(m.type()))report.steps.push({console:m.type()+': '+m.text().slice(0,240)});});

const step=async(name,fn)=>{
 const t=Date.now();
 try{await fn();report.steps.push({name,ms:Date.now()-t,ok:true});console.log('PASS',name,(Date.now()-t)+'ms');}
 catch(e){report.steps.push({name,ms:Date.now()-t,ok:false,error:String(e)});throw e;}
 finally{await page.screenshot({path:join(out,'screens',name+'.png'),fullPage:true}).catch(()=>{});}
};
const click=async l=>{
 await l.waitFor({state:'visible',timeout:60000});
 for(let i=0;i<720;i++){if(await l.isEnabled()){await l.click();return;}await page.waitForTimeout(250);}
 throw Error('Disabled: '+(await l.innerText().catch(()=>'(no text)')));
};
const saved=()=>page.locator('.journey-footer').getByText('Saved on this browser').waitFor({timeout:300000});

const dumpOutputsSnapshot=async(label)=>{
 const heroDir=resolve('outputs');
 const snap={label,at:new Date().toISOString(),files:[]};
 for(const sub of ['', 'hero-klein']){
  const dir=sub?join(heroDir,sub):heroDir;
  if(!existsSync(dir))continue;
  for(const name of await readdir(dir)){
   if(!/\.(png|jpg|jpeg|webp|mp4|json)$/i.test(name))continue;
   const p=join(dir,name);
   try{
    const st=await import('node:fs').then(fs=>fs.promises.stat(p));
    if(st.isFile()&&st.mtimeMs>Date.now()-3_600_000)snap.files.push({path:p,bytes:st.size,mtime:st.mtime.toISOString()});
   }catch{}
  }
 }
 await writeFile(join(out,'outputs-snap-'+label+'.json'),JSON.stringify(snap,null,2));
 return snap;
};

try{
 await step('00-readiness',async()=>{
  const caps=await(await fetch(base+'/api/capabilities')).json();
  const hero=await(await fetch(base+'/api/hero/capabilities')).json();
  report.caps={shot:caps.shot,ffmpeg:caps.ffmpeg?.available,comfy:hero.comfyConnected,busy:hero.busy,
   klein:hero.klein,vramFreeBytes:hero.vramFreeBytes};
  assert.equal(caps.shot,true,'LTX/shot not ready');
  assert.equal(caps.ffmpeg?.available,true,'ffmpeg missing');
  assert.equal(hero.comfyConnected,true,'Comfy disconnected');
  assert.equal(hero.busy,false,'Comfy/app busy');
  assert.equal(hero.klein?.available,true,'Klein Creative Restage unavailable: '+(hero.klein?.reason||''));
  await writeFile(join(out,'capabilities.json'),JSON.stringify({caps,hero},null,2));
 });

 await step('01-welcome',async()=>{
  await page.goto(base+'/adstudio/',{waitUntil:'networkidle',timeout:120000});
  await page.waitForSelector('.journey-shell, .wordmark',{timeout:90000});
  assert.match(page.url(),/\/adstudio\/?$/);
  assert.equal(await page.locator('#journey-root').count(),1);
  assert.equal(await page.locator('#adstudio-root').count(),0);
  const start=page.getByRole('button',{name:/Make an advertisement|Static advertisement/i}).first();
  await start.waitFor({timeout:90000});
  await click(start);
  await page.getByText(/Every great ad|Upload original|brand|photograph|website/i).first().waitFor({timeout:60000});
 });

 await step('02-onboard',async()=>{
  await page.getByLabel('Upload original photographs').setInputFiles(source);
  await saved();
  await page.getByPlaceholder('What should we call your brand?').fill('No Crumbs Bakery');
  await click(page.getByRole('button',{name:/Let.s begin/}));
  await page.getByText('The stars of your campaign.').waitFor({timeout:180000});
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
  await page.locator('.concept-card').first().waitFor({timeout:300000});await saved();
  // Capture creative plan text from UI
  const titles=await page.locator('.concept-card h2').allTextContents();
  const ideas=await page.locator('.concept-card p').allTextContents();
  report.concepts=titles.map((t,i)=>({title:t,idea:ideas[i]||''}));
  await page.locator('.concept-card').first().click();
  await page.getByRole('checkbox',{name:/checked these visible facts/}).check();
  await click(page.getByRole('button',{name:/Looks good/}));
  await page.locator('.quantity-control').waitFor({timeout:120000});
  await writeFile(join(out,'creative-plan.json'),JSON.stringify({concepts:report.concepts,selectedIndex:0},null,2));
 });

 await step('05-klein-static',async()=>{
  await click(page.getByText('Advanced · generation engine',{exact:true}));
  const engine=page.getByRole('combobox',{name:/^Engine/});
  await engine.selectOption('klein');
  await saved();
  const note=await page.locator('.engine-note').innerText().catch(()=>'');
  report.engineNote=note;
  await page.getByRole('checkbox',{name:/approve the specific directions/}).check();
  const before=Date.now();
  await click(page.getByRole('button',{name:/^Create \d advertisement/}));
  // Klein GPU job — allow up to 20 minutes, no retries
  await page.locator('.campaign-card.ready').first().waitFor({timeout:1_200_000});
  await saved();
  report.kleinGenerateMs=Date.now()-before;
  await dumpOutputsSnapshot('after-klein');

  // Download composed PNG via UI
  const waiting=page.waitForEvent('download',{timeout:120000});
  await click(page.getByRole('button',{name:'Download PNG ↓',exact:true}).first());
  const download=await waiting;
  const pngPath=join(out,'composed-advertisement.png');
  await download.saveAs(pngPath);
  const png=await readFile(pngPath);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','not a PNG');
  report.composedPng={path:pngPath,bytes:png.length,sha256:sha(png)};

  // Pull newest klein scene raw if present under outputs/
  const snap=JSON.parse(await readFile(join(out,'outputs-snap-after-klein.json'),'utf8'));
  const rawCandidates=snap.files.filter(f=>/hero-klein|scene|restage/i.test(f.path)||/\.png$/i.test(f.path))
   .sort((a,b)=>b.mtime.localeCompare(a.mtime));
  for(const c of rawCandidates.slice(0,8)){
   try{
    const bytes=await readFile(c.path);
    if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')continue;
    const dest=join(out,'raw-'+c.path.split(/[/\\]/).pop());
    await writeFile(dest,bytes);
    report.rawCandidates=(report.rawCandidates||[]).concat({from:c.path,to:dest,sha256:sha(bytes),bytes:bytes.length});
   }catch{}
  }
 });

 let videoSrc='';
 await step('06-animate-ltx',async()=>{
  assert.ok(await page.getByRole('button',{name:/Animate this ad/}).count()>0,'Animate unavailable');
  const before=Date.now();
  await click(page.getByRole('button',{name:/Animate this ad/}).first());
  const started=Date.now();
  let src='';
  while(Date.now()-started<1_500_000){
   const count=await page.locator('.journey-videos video').count();
   if(count>=1){
    src=await page.locator('.journey-videos video').first().getAttribute('src')||'';
    if(src)break;
   }
   // surface failure message if card failed
   const failed=await page.locator('.campaign-card.failed').count();
   if(failed)throw Error('Campaign card failed during Animate: '+(await page.locator('.campaign-card.failed').innerText().catch(()=>'')));
   await page.waitForTimeout(2000);
  }
  assert.ok(src,'LTX video never appeared');
  videoSrc=src;
  report.animateMs=Date.now()-before;
  const r=await page.request.get(base+src);
  const bytes=Buffer.from(await r.body());
  const mp4=join(out,'campaign-commercial.mp4');
  await writeFile(mp4,bytes);
  report.mp4={path:mp4,src,bytes:bytes.length,sha256:sha(bytes)};
  assert.ok(bytes.length>50_000,'MP4 too small');
  await new Promise((ok,err)=>{
   const p=spawn(ffmpeg,['-y','-i',mp4,
    '-ss','0.05','-vframes','1',join(out,'frames','first.jpg'),
    '-ss','1.0','-vframes','1',join(out,'frames','middle.jpg'),
    '-sseof','-0.15','-vframes','1',join(out,'frames','final.jpg'),
   ],{stdio:'ignore'});
   p.on('close',c=>c===0?ok():err(Error('ffmpeg frame extract failed '+c)));
  });
 });

 await step('07-download-playback-reload',async()=>{
  // Prefer explicit Download final MP4 if present
  const dlBtn=page.getByRole('button',{name:/Download final MP4/}).first();
  if(await dlBtn.count()){
   const waiting=page.waitForEvent('download',{timeout:120000});
   await click(dlBtn);
   const d=await waiting;
   const p=join(out,'downloaded-final.mp4');
   await d.saveAs(p);
   report.downloadedMp4={path:p,bytes:(await readFile(p)).length,sha256:sha(await readFile(p))};
  }
  // Playback smoke: play then pause
  await page.locator('.journey-videos video').first().evaluate(v=>{v.muted=true;return v.play().then(()=>new Promise(r=>setTimeout(r,800))).then(()=>{v.pause();return {t:v.currentTime,w:v.videoWidth,h:v.videoHeight};});})
   .then(meta=>{report.playback=meta;});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.campaign-card.ready').first().waitFor({timeout:120000});
  await page.locator('.journey-videos video').first().waitFor({timeout:120000});
  report.reloadVideos=await page.locator('.journey-videos video').count();
  assert.ok(report.reloadVideos>=1,'video missing after reload');
  // Provenance from page text / take model
  const caption=await page.locator('.campaign-card.ready .result-caption').first().innerText().catch(()=>'');
  report.resultCaption=caption;
  await writeFile(join(out,'provenance.json'),JSON.stringify({
   sourceSha256:report.sourceSha256,
   composed:report.composedPng,
   mp4:report.mp4,
   engine:'klein',
   klein:report.caps?.klein,
   resultCaption:caption,
   origin:base,
   storage:'IndexedDB osh-adstudio-projects @ '+base,
  },null,2));
 });

 // Classic share-storage check (same origin, no wipe)
 await step('08-classic-share-storage',async()=>{
  await page.goto(base+'/adstudio/workspace.html',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2500);
  const hasBrand=await page.getByText(/No Crumbs/i).count();
  report.classicSeesJourneyData=hasBrand>0;
  await page.screenshot({path:join(out,'screens','classic-workspace.png'),fullPage:true}).catch(()=>{});
  await page.goto(base+'/adstudio/',{waitUntil:'domcontentloaded'});
  await page.locator('.campaign-card.ready,.journey-footer').first().waitFor({timeout:60000});
 });

 report.technicalPass=true;
 report.pass=true;
 console.log('TECHNICAL PASS',out);
 console.log('PNG',report.composedPng?.path);
 console.log('MP4',report.mp4?.path);
}catch(e){
 report.pass=false;report.technicalPass=false;report.error=String(e);
 console.error('FAIL',e);
 await page.screenshot({path:join(out,'screens','failure.png'),fullPage:true}).catch(()=>{});
 process.exitCode=1;
}finally{
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 await ctx.close();
}
