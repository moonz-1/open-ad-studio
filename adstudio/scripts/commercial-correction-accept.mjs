// ONE Animate acceptance after commercial-director correction. Reuses saved Journey project; no Klein regen.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile,writeFile,copyFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8304';
const beforeDir=resolve('outputs/realworld-acceptance-2026-10-28T02-16-35');
const beforeMp4=join(beforeDir,'campaign-commercial.mp4');
const outputsDir=resolve('outputs');
const out=resolve('outputs/commercial-correction-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
await mkdir(join(out,'frames'),{recursive:true});
await mkdir(join(out,'screens'),{recursive:true});
assert.ok(existsSync(beforeMp4),'before MP4 missing');
await copyFile(beforeMp4,join(out,'before-commercial.mp4'));
await copyFile(join(beforeDir,'composed-advertisement.png'),join(out,'composed-still.png')).catch(()=>{});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={base,out,before:beforeMp4,pass:false,technicalPass:false,commercialApproval:'PENDING_OWNER',api:[]};

const frames=async(mp4,prefix)=>{
 for(const [name,ss] of [['first','0.08'],['middle','2.0'],['late','4.2'],['final','5.6']]){
  await new Promise((ok)=>{const p=spawn(ffmpeg,['-y','-ss',ss,'-i',mp4,'-vframes','1',join(out,'frames',`${prefix}-${name}.jpg`)],{stdio:'ignore'});p.on('close',()=>ok());});
 }
};
await frames(join(out,'before-commercial.mp4'),'before');
report.beforeSha256=sha(await readFile(join(out,'before-commercial.mp4')));
const startedAt=Date.now();

const newestMp4=async()=>{
 const files=(await readdir(outputsDir)).filter(n=>/^[a-f0-9]{16}\.mp4$/i.test(n));
 let best=null;
 for(const n of files){
  const p=join(outputsDir,n),st=await stat(p);
  if(st.mtimeMs>=startedAt-5000&&st.size>80_000){
   if(!best||st.mtimeMs>best.mtimeMs)best={path:p,url:'/outputs/'+n,bytes:st.size,mtimeMs:st.mtimeMs};
  }
 }
 return best;
};

const profile=join(beforeDir,'chrome');
const ctx=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,acceptDownloads:true,viewport:{width:1440,height:1100},args:['--disable-gpu']});
const page=await ctx.newPage();
page.on('pageerror',e=>report.api.push({pageerror:e.message}));
page.on('response',async r=>{
 const u=r.url();
 if(/\/api\/(shot|upload|reference\/assemble)/.test(u))report.api.push({status:r.status(),method:r.request().method(),url:u.replace(base,'')});
});

try{
 const caps=await(await fetch(base+'/api/capabilities')).json();
 assert.equal(caps.shot,true);assert.equal(caps.ffmpeg?.available,true);
 report.caps={shot:caps.shot,ffmpeg:caps.ffmpeg?.available};

 await page.goto(base+'/adstudio/?t='+Date.now(),{waitUntil:'networkidle',timeout:120000});
 await page.waitForSelector('.journey-shell, .wordmark',{timeout:90000});
 if(await page.getByRole('button',{name:/Make an advertisement|Static advertisement/i}).count()){
  await page.getByRole('button',{name:/Your work/i}).click();
  await page.locator('.project-list button').first().waitFor({timeout:30000});
  const n=await page.locator('.project-list button').count();
  let opened=false;
  for(let i=0;i<n;i++){
   const t=await page.locator('.project-list button').nth(i).innerText();
   if(/No Crumbs/i.test(t)){await page.locator('.project-list button').nth(i).click();opened=true;break;}
  }
  if(!opened)await page.locator('.project-list button').first().click();
  await page.waitForTimeout(2500);
 }
 await page.locator('.campaign-card.ready').first().waitFor({timeout:120000});
 // Ensure still tab so Animate is visible
 await page.getByRole('button',{name:/Campaign still/i}).first().click().catch(()=>{});
 await page.screenshot({path:join(out,'screens','01-ready.png'),fullPage:true});

 const animate=page.getByRole('button',{name:/Animate this ad/}).first();
 assert.ok(await animate.count(),'Animate missing');
 assert.equal(await animate.isEnabled(),true,'Animate disabled');
 const t0=Date.now();
 await animate.click();
 console.log('clicked Animate');

 let after=null;
 const deadline=Date.now()+1_200_000;
 while(Date.now()<deadline){
  const failed=await page.locator('.campaign-card.failed').count();
  if(failed)throw Error('Animate failed UI: '+(await page.locator('.campaign-card.failed').innerText().catch(()=>'')));
  const toast=await page.locator('.operation-toast').innerText().catch(()=>'');
  if(toast)console.log('toast',toast.slice(0,100));
  const pageFail=report.api.find(x=>x.pageerror);
  if(pageFail)throw Error(pageFail.pageerror);
  after=await newestMp4();
  if(after){
   const bytes=await readFile(after.path);
   if(sha(bytes)!==report.beforeSha256){
    await writeFile(join(out,'after-commercial.mp4'),bytes);
    report.after={...after,sha256:sha(bytes),ms:Date.now()-t0};
    break;
   }
  }
  await page.waitForTimeout(3000);
 }
 assert.ok(report.after,'new after MP4 not produced');
 console.log('got after',report.after.url,report.after.bytes);

 await frames(join(out,'after-commercial.mp4'),'after');
 await page.screenshot({path:join(out,'screens','02-after.png'),fullPage:true});
 const cap=await page.locator('.journey-videos figcaption').first().innerText().catch(()=>'');
 report.caption=cap;
 await new Promise((ok)=>{const p=spawn(ffmpeg,['-hide_banner','-i',join(out,'after-commercial.mp4')],{stdio:['ignore','ignore','pipe']});let e='';p.stderr.on('data',d=>e+=d);p.on('close',()=>{report.probe=e.split(/\r?\n/).filter(l=>/Duration|Stream #0:0|Video:/.test(l));ok();});});

 report.technicalPass=true;report.pass=true;
 console.log('PASS commercial correction',out);
}catch(e){
 report.error=String(e);console.error(e);process.exitCode=1;
 await page.screenshot({path:join(out,'screens','failure.png'),fullPage:true}).catch(()=>{});
}finally{
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 await ctx.close();
}
