// Vertical slice: synthetic reference → analysis → shot plan → (optional) LTX commercial from existing restage still.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {buildCreativeIntelligence} from '../../shared/lib/creative-intelligence.ts';
import {planFromReference} from '../../shared/lib/reference-video.ts';
import {campaignMotionPrompt,campaignVideoSize} from '../../shared/lib/campaign-motion.ts';

const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8303';
const out=resolve('outputs/reference-inspired-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={base,out,steps:[],pass:false};

const step=async(name,fn)=>{const t=Date.now();const r=await fn();report.steps.push({name,ms:Date.now()-t});console.log('PASS',name);return r;};

function runNode(script,env={}){return new Promise((ok,fail)=>{const p=spawn(process.execPath,[script],{cwd:resolve('.'),env:{...process.env,...env},stdio:['ignore','pipe','pipe']});let o='',e='';p.stdout.on('data',b=>o+=b);p.stderr.on('data',b=>e+=b);p.on('close',c=>c===0?ok(o):fail(Error(e||o||'fail '+script)));});}

await step('00-synthetic-ref',async()=>{
 await runNode('adstudio/scripts/make-synthetic-reference.mjs',{FFMPEG_PATH:process.env.FFMPEG_PATH});
 const src=resolve('outputs/synthetic-reference/surprise-reveal.mp4');
 await copyFile(src,join(out,'surprise-reveal.mp4'));
 report.refBytes=(await stat(src)).size;
});

const uploaded=await step('01-upload-analyze',async()=>{
 const bytes=await readFile(join(out,'surprise-reveal.mp4'));
 const up=await fetch(base+'/api/reference/upload',{method:'POST',headers:{'Content-Type':'video/mp4'},body:bytes});
 const info=await up.json();assert.equal(up.status,200,JSON.stringify(info));
 const an=await fetch(base+'/api/reference/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:info.url,originalUrl:info.originalUrl,bytes:info.bytes,rights:'inspiration-only'})});
 const analysis=await an.json();assert.equal(an.status,200,JSON.stringify(analysis));
 assert.ok(analysis.shots?.length>=2,'expected multiple shots from synthetic cuts');
 assert.ok(analysis.transferablePrinciples?.length>=2);
 await writeFile(join(out,'reference-analysis.json'),JSON.stringify(analysis,null,2));
 report.analysis={id:analysis.id,hook:analysis.creativeMechanism,shots:analysis.shots.length,method:analysis.analysisMethod,warnings:analysis.warnings};
 // copy keyframes
 for(const[i,s] of analysis.shots.entries()){
  for(const[j,url] of (s.keyframeUrls||[]).entries()){
   try{const r=await fetch(base+url);if(r.ok)await writeFile(join(out,`shot${i}-kf${j}.jpg`),Buffer.from(await r.arrayBuffer()));}catch{/* */}
  }
 }
 return {info,analysis};
});

const planned=await step('02-shot-plan',async()=>{
 // Minimal plan mirror for planner (no creative service round-trip)
 const plan={
  version:1,id:'bench',projectId:'bench',created:Date.now(),
  input:{productType:'cookies',request:'Warm sensory bakery launch',seed:61,
   brand:{id:'b',updated:1,dna:{name:'No Crumbs Bakery',tone:'warm craft',visualStyle:'morning bakery light',positioning:'neighborhood bakery'}},
   facts:{description:'Four chocolate chip cookies on walnut with cream linen',arrangement:'cluster',texture:'crumb and chip',container:'none',confirmed:true,count:4},
   source:{id:'s',sha256:'a'.repeat(64),originalSha256:'b'.repeat(64),kind:'original',name:'p.jpg'}},
  concepts:[{id:'c1',title:'Break and share',idea:'Sensory crumb reveal with morning warmth',composition:'hero',environment:'walnut',lighting:'window'}],
  selectedId:'c1',selectionReason:'bench',draft:{modelPrompt:'x'},composition:{headline:'Still warm',body:'',cta:'Visit',size:'story',concept:'spotlight'},
  context:{facts:{},controls:{fidelity:'recognizable',angle:'keep',crop:'keep',background:'new'}},
  provider:{mode:'deterministic',reason:'bench'},layout:{width:1,height:1,photoBox:{x:0,y:0,width:1,height:1},textBounds:[],fit:'contain'},
  exportIntent:'png',warnings:[],reviewRequired:true,generationRun:false
 };
 const intel=buildCreativeIntelligence(plan,uploaded.analysis.creativeMechanism);
 const shotPlan=planFromReference(plan,uploaded.analysis,intel);
 await writeFile(join(out,'campaign-shot-plan.json'),JSON.stringify(shotPlan,null,2));
 await writeFile(join(out,'creative-intelligence.json'),JSON.stringify(intel,null,2));
 report.shotPlan={id:shotPlan.id,hook:shotPlan.creativeHook,shots:shotPlan.shots.map(s=>({purpose:s.purpose,duration:s.duration}))};
 report.intelligence=intel;
 // Also hit API plan endpoint
 const apiPlan=await fetch(base+'/api/reference/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,analysis:uploaded.analysis})});
 const apiBody=await apiPlan.json();assert.equal(apiPlan.status,200,JSON.stringify(apiBody));
 assert.equal(apiBody.productReplacementAvailable,false);
 return {plan,intel,shotPlan};
});

await step('03-inspiration-search-graceful',async()=>{
 const r=await fetch(base+'/api/inspiration/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({intelligence:planned.intel})});
 const body=await r.json();assert.equal(r.status,200);assert.ok('configured' in body);report.inspirationSearch=body;
});

// Prefer an existing restage still if present; else skip GPU to keep slice bounded
const stillCandidates=[
 resolve('outputs/klein-scene-browser-bakery-v2-notray'),
 resolve('outputs/fixtures'),
];
let still=null;
for(const dir of stillCandidates){
 try{
  const {readdirSync}=await import('node:fs');
  const files=readdirSync(dir).filter(f=>/\.(png|jpg|jpeg)$/i.test(f));
  if(files[0]){still=join(dir,files[0]);break;}
 }catch{/* */}
}
// Look for known quality gallery stills
try{
 const {readdirSync,statSync}=await import('node:fs');
 const gallery=resolve('outputs');
 for(const name of readdirSync(gallery)){
  if(/restage|klein-scene|bakery.*png|campaign/i.test(name)){
   const p=join(gallery,name);
   if(statSync(p).isFile()&&/\.png$/i.test(name)){still=p;break;}
   if(statSync(p).isDirectory()){
    const inner=readdirSync(p).find(f=>/\.png$/i.test(f));
    if(inner){still=join(p,inner);break;}
   }
  }
 }
}catch{/* */}

if(still&&process.env.OSH_SKIP_LTX!=='1'){
 await step('04-ltx-inspired',async()=>{
  await copyFile(still,join(out,'hero-still-source'+still.slice(still.lastIndexOf('.'))));
  // Upload still via /api/upload if available — use Form from OSH path: post image as data URL through media is wrong.
  // Use campaign video bench pattern: read as data URL via temporary server file copy into outputs
  const {randomBytes}=await import('node:crypto');
  const {copyFileSync}=await import('node:fs');
  const name=randomBytes(8).toString('hex')+'.png';
  const dest=resolve('outputs',name);
  copyFileSync(still,dest);
  const image='/outputs/'+name;
  const prompt=campaignMotionPrompt(planned.plan,undefined,planned.shotPlan.creativeHook);
  await writeFile(join(out,'motion-prompt.txt'),prompt);
  const shot=await fetch(base+'/api/shot',{method:'POST',headers:{'Content-Type':'application/json','X-OSH-Request':randomBytes(16).toString('hex')},body:JSON.stringify({keys:[{image,t:0}],prompt,duration:campaignVideoSize.duration,seed:61,width:campaignVideoSize.width,height:campaignVideoSize.height,model:campaignVideoSize.model})});
  const body=await shot.json();
  assert.equal(shot.status,200,JSON.stringify(body));
  report.video={url:body.url,seconds:body.seconds,frames:body.frames};
  const webm=await fetch(base+body.url);const webmBytes=Buffer.from(await webm.arrayBuffer());
  await writeFile(join(out,'inspired-raw.webm'),webmBytes);
  let mp4Url=null;
  try{
   const ex=await fetch(base+'/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({video:body.url})});
   const exported=await ex.json();
   if(ex.ok){mp4Url=exported.url;const mp4=await fetch(base+exported.url);await writeFile(join(out,'inspired-commercial.mp4'),Buffer.from(await mp4.arrayBuffer()));}
  }catch{/* */}
  report.mp4=mp4Url;
  // Extract first/mid/final frames
  const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
  const src=mp4Url?join(out,'inspired-commercial.mp4'):join(out,'inspired-raw.webm');
  await new Promise((ok,fail)=>{const p=spawn(ffmpeg,['-y','-i',src,'-vf','select=eq(n\\,0)+eq(n\\,36)+eq(n\\,72)', '-vsync','vfr',join(out,'frame-%02d.jpg')],{stdio:'ignore'});p.on('close',c=>c===0?ok():ok());});
 });
}else{
 report.ltxSkipped=still?'OSH_SKIP_LTX=1':'no hero still found for bounded GPU job';
 console.log('SKIP LTX',report.ltxSkipped);
}

report.pass=true;
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('REFERENCE INSPIRED BENCH PASS',out);
