// Bounded LTX-2B animate-from-still: bakery then optional beauty. Reuses /api/shot + /api/export.
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadEnv} from 'vite';
import {Resvg} from '@resvg/resvg-js';
import {assembleCreativePlan,creativeContext,fallbackConcepts} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignMotionPrompt,campaignVideoSize} from '../../shared/lib/campaign-motion.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';

const root=resolve('.'),env=loadEnv('development',root,'');
const base=process.env.OSH_TEST_URL||'http://127.0.0.1:8303';
const comfy=process.env.COMFYUI_URL||env.COMFYUI_URL||'http://127.0.0.1:8188';
const outputs=join(root,'outputs');
const prior=join(outputs,'creative-restage-2026-10-27T17-09-09');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=join(outputs,'campaign-video-'+stamp);
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const ffmpeg=env.FFMPEG_PATH||process.env.FFMPEG_PATH||'ffmpeg';

async function free(){await fetch(comfy+'/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true})}).catch(()=>{});}
async function queueIdle(){const q=await(await fetch(comfy+'/queue')).json();if(q.queue_running?.length||q.queue_pending?.length)throw Error('Comfy queue busy');}
const stats=await(await fetch(comfy+'/system_stats')).json();
const vram=(stats.devices?.[0]?.vram_free||0)/1024**3;
await queueIdle();
if(vram<4){await free();await new Promise(r=>setTimeout(r,2000));}
console.log('VRAM GiB',((await(await fetch(comfy+'/system_stats')).json()).devices[0].vram_free/1024**3).toFixed(2),'→',base);

/** Fit any PNG into 288×512 letterbox without stretch (IHDR for native size). */
function fitVertical(pngBytes){
 const img='data:image/png;base64,'+pngBytes.toString('base64');
 const w=campaignVideoSize.width,h=campaignVideoSize.height;
 const pw=pngBytes.readUInt32BE(16),ph=pngBytes.readUInt32BE(20);
 const scale=Math.min(w/pw,h/ph),dw=Math.round(pw*scale),dh=Math.round(ph*scale);
 const x=Math.round((w-dw)/2),y=Math.round((h-dh)/2);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#0e0f12"/><image href="${img}" x="${x}" y="${y}" width="${dw}" height="${dh}"/></svg>`;
 return Buffer.from(new Resvg(svg).render().asPng());
}

async function post(path,body){
 const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-OSH-Request':randomBytes(16).toString('hex')},body:JSON.stringify(body)});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={raw:text};}
 if(!r.ok)throw Error(path+' '+r.status+' '+text.slice(0,400));
 return data;
}

async function uploadPng(bytes){
 // Client upload uses multipart via OSH.upload — here write directly into outputs with valid name
 const name=randomBytes(8).toString('hex')+'.png';
 await writeFile(join(outputs,name),bytes,{flag:'wx'});
 return '/outputs/'+name;
}

function extractContacts(webmPath,dir){
 for(const [label,t] of [['first','0'],['middle','1.5'],['final','2.9']]){
  const dest=join(dir,label+'.png');
  const r=spawnSync(ffmpeg,['-y','-ss',t,'-i',webmPath,'-frames:v','1',dest],{encoding:'utf8'});
  if(r.status!==0)console.warn('frame',label,r.stderr?.slice(-200));
 }
}

const only=process.env.OSH_VIDEO_CASE; // bakery | beauty
const cases=[
 {id:'bakery',raw:join(prior,'bakery-v2-notray','creative-restage-raw.png'),ad:join(prior,'bakery-v2-notray','advertisement.png'),
  brand:'No Crumbs Bakery',type:'cookies',colors:['#f3ebe1','#321a12','#9a5528'],
  facts:{description:'Exactly four thick chocolate chip cookies on linen over wood.',count:4,arrangement:'Clustered pile, individually visible.',texture:'Golden cracked baked surfaces and chocolate chips.',container:'No foil tray; cookies on linen.',confirmed:true},
  request:'Premium warm bakery editorial. Appetizing cookies as the hero.',tone:'Warm, inviting, tactile.',style:'Warm cream and cocoa bakery editorial.'},
 {id:'beauty',raw:join(prior,'beauty','creative-restage-raw.png'),ad:join(prior,'beauty','advertisement.png'),
  brand:'Field Study',type:'packaged-goods',colors:['#142a35','#dce4e7','#3d6b7a'],
  facts:{description:'One dark glass pump bottle with blank white label on wet stone.',count:1,arrangement:'Single upright bottle.',texture:'Dark glass with soft specular highlights.',container:'Rectangular amber glass bottle with white pump.',confirmed:true},
  request:'Coastal luxury beauty. Mineral stone, turquoise water caustics, refined light.',tone:'Calm, mineral, refined.',style:'Coastal mineral beauty with soft specular light.'},
].filter(c=>!only||c.id===only);

const report={startedAt:new Date().toISOString(),out,base,model:campaignVideoSize.model,mode:'ltx-creative',candidates:[],notes:['Owner approval pending. LTX-2B creative motion; product identity not guaranteed.']};

for(const item of cases){
 const dir=join(out,item.id);await mkdir(dir,{recursive:true});
 await copyFile(item.raw,join(dir,'start-raw.png'));
 await copyFile(item.ad,join(dir,'static-advertisement.png'));
 const fitted=fitVertical(await readFile(item.raw));
 await writeFile(join(dir,'start-288x512.png'),fitted);
 const image=await uploadPng(fitted);
 const brand=newBrand(item.brand);brand.colors=item.colors;brand.dna.tone=item.tone;brand.dna.visualStyle=item.style;
 brand.assets=[{id:'photo',assetId:'photo-asset',name:'product.png',role:'product'}];
 brand.products=[{id:'sku',name:item.brand+' product',description:item.facts.description,sellingPoints:'',imageIds:['photo']}];
 const input={version:1,projectId:'video-'+item.id,brand,source:{id:'photo-asset',name:'product.png',kind:'original',sha256:heroSha(fitted),originalSha256:heroSha(await readFile(item.raw))},facts:item.facts,productType:item.type,productId:'sku',request:item.request,intent:'campaign',format:'feed',seed:61};
 const plan=assembleCreativePlan(input,fallbackConcepts(input,creativeContext(input)),{mode:'deterministic',reason:'video bench',model:'None'},randomBytes(8).toString('hex'));
 const prompt=campaignMotionPrompt(plan);
 console.log('\n===',item.id,'LTX creative ===');
 console.log(prompt.slice(0,200));
 await free();await new Promise(r=>setTimeout(r,1500));await queueIdle();
 const t0=Date.now();
 try{
  const shot=await post('/api/shot',{keys:[{image,t:0}],prompt,duration:campaignVideoSize.duration,seed:61,width:campaignVideoSize.width,height:campaignVideoSize.height,model:campaignVideoSize.model});
  const webmBytes=Buffer.from(await(await fetch(base+shot.url)).arrayBuffer());
  await writeFile(join(dir,'raw-ltx.webm'),webmBytes);
  extractContacts(join(dir,'raw-ltx.webm'),dir);
  let mp4=null;
  try{
   const exported=await post('/api/export',{video:shot.url});
   const mp4Bytes=Buffer.from(await(await fetch(base+exported.url)).arrayBuffer());
   await writeFile(join(dir,'commercial.mp4'),mp4Bytes);
   mp4=join(dir,'commercial.mp4');
  }catch(e){report.notes.push(item.id+' export: '+e.message);}
  report.candidates.push({id:item.id,ok:true,seconds:(Date.now()-t0)/1000,apiSeconds:shot.seconds,frames:shot.frames,fps:shot.fps,duration:shot.duration,url:shot.url,prompt,paths:{webm:join(dir,'raw-ltx.webm'),mp4,start:join(dir,'start-288x512.png'),first:join(dir,'first.png'),middle:join(dir,'middle.png'),final:join(dir,'final.png')},webmSha256:sha(webmBytes)});
  console.log('OK',item.id,shot.seconds+'s api',shot.frames+'f');
 }catch(e){
  report.candidates.push({id:item.id,ok:false,error:String(e.message||e)});
  console.error('FAIL',item.id,e);
 }
}

const html=`<!doctype html><meta charset="utf-8"><title>Campaign video review</title>
<style>body{font:15px/1.45 system-ui;margin:24px;background:#111;color:#eee}img,video{max-width:220px;border:1px solid #333;background:#000}section{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}.note{color:#bbb;max-width:900px}</style>
<h1>Campaign video · LTX-2B from Creative Restage · not owner-approved</h1>
<p class="note">Genuine generative motion via existing /api/shot (shot_ltxv). Inspect first/middle/final for product drift. Prefer commercial.mp4 playback.</p>
${report.candidates.filter(c=>c.ok).map(c=>`<h2>${c.id}</h2><section>
<figure><img src="${c.id}/static-advertisement.png"><figcaption>Static ad</figcaption></figure>
<figure><img src="${c.id}/start-288x512.png"><figcaption>Start frame 288×512</figcaption></figure>
<figure><img src="${c.id}/first.png"><figcaption>First</figcaption></figure>
<figure><img src="${c.id}/middle.png"><figcaption>Middle</figcaption></figure>
<figure><img src="${c.id}/final.png"><figcaption>Final</figcaption></figure>
<figure><video src="${c.id}/commercial.mp4" controls playsinline></video><figcaption>MP4</figcaption></figure>
</section><pre>${c.prompt.replaceAll('<','&lt;')}</pre>`).join('')}
<pre>${JSON.stringify(report,null,2)}</pre>`;
await writeFile(join(out,'comparison.html'),html);
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('EVIDENCE',out);
if(report.candidates.some(c=>!c.ok))process.exitCode=1;
