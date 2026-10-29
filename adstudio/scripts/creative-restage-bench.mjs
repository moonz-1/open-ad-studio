// Bounded Creative Restage candidates only (2 jobs). No hybrid cutout path.
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,copyFile,access} from 'node:fs/promises';
import {constants as fsConstants} from 'node:fs';
import {join,resolve} from 'node:path';
import {loadEnv} from 'vite';
import {Comfy} from '@comfyorg/sdk';
import {assembleCreativePlan,creativeContext,fallbackConcepts} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignDesign,adScenePrompt,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {newStaticDesign} from '../../shared/lib/static-ad.ts';
import {renderKleinScene} from '../../shared/runtime/klein-scene.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';

const root=resolve('.'),env=loadEnv('development',root,'');
process.env.COMFYUI_URL=env.COMFYUI_URL||'http://127.0.0.1:8188';
process.env.COMFY_BASE_URL=env.COMFY_BASE_URL||'http://127.0.0.1:8189';
const modelsDir=process.env.ADSTUDIO_KLEIN_MODELS_DIR||env.ADSTUDIO_KLEIN_MODELS_DIR;
const outputsRoot=join(root,'outputs');
const prior=join(outputsRoot,'campaign-quality-2026-10-27T16-33-25');
const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=join(outputsRoot,'creative-restage-'+stamp);
await mkdir(out,{recursive:true});
const native=async p=>{const r=await fetch((process.env.COMFYUI_URL||'http://127.0.0.1:8188')+p);if(!r.ok)throw Error(p+' '+r.status);return r.json();};
const free=async()=>{await fetch((process.env.COMFYUI_URL||'http://127.0.0.1:8188')+'/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true})}).catch(()=>{});};
await free();await new Promise(r=>setTimeout(r,1500));
const stats=await native('/system_stats'),queue=await native('/queue');
const vram=(stats.devices?.[0]?.vram_free||0)/1024**3;
if(queue.queue_running?.length||queue.queue_pending?.length)throw Error('Comfy queue busy — aborting.');
if(vram<6)throw Error('Need ≥6 GiB free VRAM for restage, have '+vram.toFixed(2));
console.log('GPU free GiB',vram.toFixed(2),'queue idle → Creative Restage bench');

const cases=[
 {id:'bakery',brandName:'No Crumbs Bakery',productType:'cookies',sourcePng:join(prior,'bakery','original.png'),sourceJpg:join(prior,'bakery','original-source.jpg'),previous:join(prior,'bakery','advertisement.png'),
  colors:['#f3ebe1','#321a12','#9a5528'],facts:{description:'Four chocolate chip cookies closely overlapped in a rectangular foil tray. Preserve baked surfaces, visible chocolate chips and cookie shapes.',count:4,arrangement:'Four cookies packed together, all individually visible.',texture:'Golden cracked baked surfaces and uneven chocolate chips.',container:'Disposable aluminum foil loaf tray (may be minimized for premium styling).',confirmed:true},
  request:'Premium warm bakery editorial. Appetizing cookies as the hero. Rich materials, soft window light. Creative restage — foil tray need not dominate.',headline:'Fresh from the oven.',cta:'Order today'},
 {id:'beauty',brandName:'Field Study',productType:'packaged-goods',sourcePng:join(prior,'beauty','original.png'),sourceJpg:join(prior,'beauty','original-source.jpg'),previous:join(prior,'beauty','advertisement.png'),
  colors:['#142a35','#dce4e7','#3d6b7a'],facts:{description:'One dark glass pump bottle with a blank white label on stone.',count:1,arrangement:'Single upright bottle.',texture:'Dark glass with soft specular highlights.',container:'Rectangular amber glass bottle with white pump.',confirmed:true},
  request:'Coastal luxury beauty. Mineral stone, turquoise water caustics, refined light. Bottle physically in the set with matching glass reflections.',headline:'Still, in motion.',cta:'Discover'},
];

const c=new Comfy();
const report={startedAt:new Date().toISOString(),out,modelsDir,vramFreeGiB:vram,method:'klein-scene Creative Restage',candidates:[],notes:['Owner approval pending. Not product-safe.']};

for(const item of cases){
 const dir=join(out,item.id);await mkdir(dir,{recursive:true});
 let pngPath=item.sourcePng;try{await access(pngPath,fsConstants.R_OK);}catch{throw Error('missing '+pngPath);}
 await copyFile(pngPath,join(dir,'original.png'));
 await copyFile(item.previous,join(dir,'previous-hybrid.png'));
 try{await copyFile(item.sourceJpg,join(dir,'original-source.jpg'));}catch{}
 const pngBytes=await readFile(pngPath);
 const name=randomBytes(8).toString('hex')+'.png';
 await writeFile(join(outputsRoot,name),pngBytes);
 const image='/outputs/'+name;

 const brand=newBrand(item.brandName);brand.colors=item.colors;
 brand.dna.tone=item.id==='bakery'?'Warm, inviting, tactile.':'Calm, mineral, refined.';
 brand.dna.visualStyle=item.id==='bakery'?'Warm cream and cocoa bakery editorial.':'Coastal mineral beauty with soft specular light.';
 brand.assets=[{id:'photo',assetId:'photo-asset',name:'product.png',role:'product'}];
 brand.products=[{id:'sku',name:item.brandName+' product',description:item.facts.description,sellingPoints:'',imageIds:['photo']}];
 const input={version:1,projectId:'restage-'+item.id,brand,source:{id:'photo-asset',name:'product.png',kind:'original',sha256:heroSha(pngBytes),originalSha256:heroSha(await readFile(item.sourceJpg))},facts:item.facts,productType:item.productType,productId:'sku',request:item.request,intent:'campaign',format:'feed',seed:47};
 const plan=assembleCreativePlan(input,fallbackConcepts(input,creativeContext(input)),{mode:'deterministic',reason:'restage bench',model:'None'},randomBytes(8).toString('hex'));
 const prompt=adScenePrompt(plan);
 console.log('\n===',item.id,'Creative Restage ===');
 console.log('prompt:',prompt.slice(0,240).replace(/\n/g,' | '));
 try{
  await free();await new Promise(r=>setTimeout(r,1200));
  const scene=await renderKleinScene(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,prompt,47,image,sceneDirection(plan).archetype,process.env.COMFYUI_URL||'http://127.0.0.1:8188',AbortSignal.timeout(600000),m=>console.log('  ',m));
  const sceneBytes=await readFile(join(outputsRoot,scene.url.slice(9)));
  await writeFile(join(dir,'creative-restage-raw.png'),sceneBytes);
  const draft=newStaticDesign(brand,'sku');
  const design=campaignDesign({...draft.design,headline:item.headline,body:'',cta:item.cta,website:item.brandName.toLowerCase().replace(/\s+/g,'')+'.example',photoConfirmed:true},scene.archetype,'scene');
  const photoData='data:image/png;base64,'+sceneBytes.toString('base64');
  const {Resvg}=await import('@resvg/resvg-js');
  const {campaignSVG}=await import('../../shared/lib/campaign-ad.ts');
  const svg=campaignSVG(design,{photo:photoData},1080,1350).svg;
  const ad=Buffer.from(new Resvg(svg).render().asPng());
  await writeFile(join(dir,'advertisement.png'),ad);
  report.candidates.push({id:item.id,ok:true,mode:scene.model,seconds:scene.seconds,jobId:scene.jobId,sceneSha256:scene.sha256,warning:scene.warning,fidelityMode:'creative-restage',prompt,paths:{advertisement:join(dir,'advertisement.png'),raw:join(dir,'creative-restage-raw.png'),previous:join(dir,'previous-hybrid.png')}});
  console.log('OK',item.id,scene.model,scene.seconds,'s');
 }catch(e){
  report.candidates.push({id:item.id,ok:false,error:String(e.message||e)});
  console.error('FAIL',item.id,e);
 }
 await free();
}

const html=`<!doctype html><meta charset="utf-8"><title>Creative Restage review</title>
<style>body{font:15px/1.45 system-ui;margin:24px;background:#111;color:#eee}img{max-width:260px;height:auto;border:1px solid #333}section{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:28px}figure{margin:0}h2{margin:20px 0 8px}.note{color:#bbb;max-width:920px}</style>
<h1>Creative Restage candidates · not owner-approved</h1>
<p class="note">Original → previous hybrid/harmonize ad → Creative Restage raw → lettered export. Klein ReferenceLatent only. Packaging fidelity not guaranteed.</p>
${report.candidates.filter(x=>x.ok).map(x=>`<h2>${x.id} · ${x.mode} · ${x.seconds}s</h2><section>
<figure><img src="${x.id}/original.png"><figcaption>Original</figcaption></figure>
<figure><img src="${x.id}/previous-hybrid.png"><figcaption>Previous hybrid</figcaption></figure>
<figure><img src="${x.id}/creative-restage-raw.png"><figcaption>Creative Restage raw</figcaption></figure>
<figure><img src="${x.id}/advertisement.png"><figcaption>Lettered export</figcaption></figure>
</section>`).join('')}
<pre>${JSON.stringify(report,null,2)}</pre>`;
await writeFile(join(out,'comparison.html'),html);
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('EVIDENCE',out);
if(report.candidates.some(x=>!x.ok))process.exitCode=1;
