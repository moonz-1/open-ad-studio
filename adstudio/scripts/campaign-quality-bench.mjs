// Bounded real-GPU quality candidates. Uses local Comfy only. Does not touch 8301/8302.
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {access} from 'node:fs/promises';
import {loadEnv} from 'vite';
import {constants as fsConstants} from 'node:fs';
import {Comfy} from '@comfyorg/sdk';
import {assembleCreativePlan,creativeContext,fallbackConcepts} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {campaignSVG} from '../../shared/lib/campaign-ad.ts';
import {campaignDesign} from '../../shared/lib/ad-scene.ts';
import {newStaticDesign} from '../../shared/lib/static-ad.ts';
import {renderProductCampaign} from '../../shared/runtime/product-campaign.ts';
import {renderKleinScene} from '../../shared/runtime/klein-scene.ts';
import {adScenePrompt,adCampaignPrompt,adHarmonizePrompt,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';

const root=resolve('.'),mainOutputs=resolve('outputs/fixtures');
const env={...loadEnv('development',root,''),...process.env};
process.env.COMFY_BASE_URL=env.COMFY_BASE_URL||'http://127.0.0.1:8189';
process.env.COMFYUI_URL=env.COMFYUI_URL||'http://127.0.0.1:8188';
const modelsDir=env.ADSTUDIO_KLEIN_MODELS_DIR||env.COMFYUI_MODELS_DIR;
if(!modelsDir)throw Error('Set ADSTUDIO_KLEIN_MODELS_DIR');
const out=resolve('outputs/campaign-quality-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19));
await mkdir(out,{recursive:true});await mkdir(join(out,'raw'),{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const native=async p=>(await fetch((env.COMFYUI_URL||'http://127.0.0.1:8188')+p,{signal:AbortSignal.timeout(5000)})).json();
const queue=await native('/queue');if(queue.queue_running?.length||queue.queue_pending?.length)throw Error('ComfyUI queue busy — not starting quality jobs.');
const stats=await native('/system_stats');
const free=((stats.devices?.[0]?.vram_free)||0)/1024**3;
console.log('GPU free GiB',free.toFixed(2),'queue idle');
if(free<3.5)throw Error('Insufficient free VRAM for Klein quality bench');

const cases=[{
 id:'bakery',
 sourcePng:resolve('outputs/_bakery-1088.png'),
 sourceFallback:join(mainOutputs,'ltx25-benchmark','inputs','cookie.png'),
 sourceJpg:join(mainOutputs,'generative-ads-browser-2026-10-27T15-21-52-289Z','bakery-original.jpg'),
 rejected:join(mainOutputs,'generative-ads-browser-2026-10-27T15-21-52-289Z','bakery-ai-assisted.png'),
 brandName:'No Crumbs Bakery',
 productType:'cookies',
 colors:['#f3ebe1','#321a12','#9a5528'],
 facts:{description:'Four chocolate chip cookies packed in a foil loaf tin on wood.',count:4,arrangement:'Single row in a rectangular foil tray.',texture:'Golden browned tops with visible chocolate chunks.',container:'Disposable aluminum foil loaf tray.',confirmed:true},
 request:'Premium warm bakery editorial. Appetizing cookies, rich materials, soft window light.',
 headline:'Fresh from the oven.',
 cta:'Order today',
},{
 id:'beauty',
 sourcePng:resolve('outputs/_beauty-1080.png'),
 sourceFallback:resolve('outputs/_beauty-original.png'),
 sourceJpg:join(mainOutputs,'generative-ads-browser-2026-10-27T15-21-52-289Z','beauty-original.jpg'),
 rejected:join(mainOutputs,'generative-ads-browser-2026-10-27T15-21-52-289Z','beauty-ai-assisted.png'),
 brandName:'Field Study',
 productType:'packaged-goods',
 colors:['#142a35','#dce4e7','#3d6b7a'],
 facts:{description:'One dark glass pump bottle with a blank white label on stone.',count:1,arrangement:'Single upright bottle.',texture:'Dark glass with soft specular highlights.',container:'Rectangular amber glass bottle with white pump.',confirmed:true},
 request:'Coastal luxury beauty. Mineral stone, turquoise water caustics, refined light.',
 headline:'Still, in motion.',
 cta:'Discover',
}];

const c=new Comfy();
const report={startedAt:new Date().toISOString(),out,modelsDir,vramFreeGiB:free,candidates:[],notes:[]};

for(const item of cases){
 const dir=join(out,item.id);await mkdir(dir,{recursive:true});
 let pngPath=item.sourcePng;try{await access(pngPath,fsConstants.R_OK);}catch{pngPath=item.sourceFallback;}
 await copyFile(pngPath,join(dir,'original.png'));
 await copyFile(item.rejected,join(dir,'rejected-previous.png'));
 try{await copyFile(item.sourceJpg,join(dir,'original-source.jpg'));}catch{}
 const pngBytes=await readFile(pngPath);if(pngBytes.length>8*1024*1024)throw Error(item.id+' PNG exceeds 8MB source limit');
 const name=randomBytes(8).toString('hex')+'.png';
 const outputsRoot=resolve('outputs');await mkdir(outputsRoot,{recursive:true});
 await writeFile(join(outputsRoot,name),pngBytes);
 const image='/outputs/'+name;

 const brand=newBrand(item.brandName);brand.colors=item.colors;brand.dna.tone=item.id==='bakery'?'Warm, inviting, tactile.':'Calm, mineral, refined.';brand.dna.visualStyle=item.id==='bakery'?'Warm cream and cocoa bakery editorial.':'Coastal mineral beauty with soft specular light.';
 brand.assets=[{id:'photo',assetId:'photo-asset',name:'product.png',role:'product'}];
 brand.products=[{id:'sku',name:item.brandName+' product',description:item.facts.description,sellingPoints:'',imageIds:['photo']}];
 const input={version:1,projectId:'quality-'+item.id,brand,source:{id:'photo-asset',name:'product.png',kind:'original',sha256:heroSha(pngBytes),originalSha256:heroSha(await readFile(item.sourceJpg))},facts:item.facts,productType:item.productType,productId:'sku',request:item.request,intent:'campaign',format:'feed',seed:42};
 const ctx=creativeContext(input),concepts=fallbackConcepts(input,ctx),plan=assembleCreativePlan(input,concepts,{mode:'deterministic',reason:'quality bench',model:'None'},randomBytes(8).toString('hex'));

 console.log('\n===',item.id,'product-fidelity / hybrid campaign ===');
 console.log('env prompt preview:',adCampaignPrompt(plan).slice(0,180).replace(/\n/g,' | '));
 const start=Date.now();
 let scene;
 try{
  scene=await renderProductCampaign(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,plan,image,env.COMFYUI_URL||'http://127.0.0.1:8188',AbortSignal.timeout(600000),m=>console.log('  ',m));
 }catch(e){
  report.candidates.push({id:item.id,mode:'hybrid',ok:false,error:String(e.message||e)});
  console.error('FAIL hybrid',e);
  continue;
 }
 const sceneBytes=await readFile(join(outputsRoot,scene.url.slice(9)));
 await writeFile(join(dir,'scene-'+scene.model+'.png'),sceneBytes);
 if(scene.background)await copyFile(join(outputsRoot,scene.background.url.slice(9)),join(dir,'raw-environment.png'));
 if(scene.cutout)await copyFile(join(outputsRoot,scene.cutout.url.slice(9)),join(dir,'cutout.png'));
 if(scene.preHarmonize)await copyFile(join(outputsRoot,scene.preHarmonize.url.slice(9)),join(dir,'pre-harmonize.png'));

 const draft=newStaticDesign(brand,'sku');
 const design=campaignDesign({...draft.design,headline:item.headline,body:'',cta:item.cta,website:item.brandName.toLowerCase().replace(/\s+/g,'')+'.example',photoConfirmed:true},scene.archetype,'scene');
 const photoData='data:image/png;base64,'+sceneBytes.toString('base64');
 const {Resvg}=await import('@resvg/resvg-js');
 const svg=campaignSVG(design,{photo:photoData},1080,1350).svg;
 const adBytes=Buffer.from(new Resvg(svg).render().asPng());
 await writeFile(join(dir,'advertisement.png'),adBytes);

 let restage=null;
 if(process.env.OSH_QUALITY_RESTAGE==='1'){
  console.log('===',item.id,'creative restage ===');
  try{
   await new Promise(r=>setTimeout(r,2000));
   await fetch((env.COMFYUI_URL||'http://127.0.0.1:8188')+'/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true})});
   await new Promise(r=>setTimeout(r,4000));
   restage=await renderKleinScene(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,adScenePrompt(plan),43,image,sceneDirection(plan).archetype,env.COMFYUI_URL||'http://127.0.0.1:8188',AbortSignal.timeout(600000),m=>console.log('  ',m));
   await copyFile(join(outputsRoot,restage.url.slice(9)),join(dir,'creative-restage-raw.png'));
  }catch(e){
   console.error('Restage failed/skipped',e.message||e);
   report.notes.push(item.id+': creative restage '+String(e.message||e));
  }
 }

 report.candidates.push({
  id:item.id,ok:true,mode:scene.model,seconds:(Date.now()-start)/1000,jobId:scene.jobId,
  sceneSha256:scene.sha256,warning:scene.warning,fidelityMode:scene.fidelityMode,
  paths:{advertisement:join(dir,'advertisement.png'),scene:join(dir,'scene-'+scene.model+'.png'),rejected:join(dir,'rejected-previous.png'),restage:restage?join(dir,'creative-restage-raw.png'):null},
  prompts:{campaign:adCampaignPrompt(plan),harmonize:adHarmonizePrompt(plan),restage:adScenePrompt(plan)},
 });
 console.log('OK',item.id,scene.model,(Date.now()-start)/1000,'s');
}

const gallery=`<!doctype html><meta charset="utf-8"><title>Campaign quality candidates</title>
<style>body{font:15px/1.45 system-ui;margin:24px;background:#111;color:#eee}img{max-width:280px;height:auto;border:1px solid #333}section{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:32px}figure{margin:0}h2{margin:24px 0 8px}.note{color:#bbb;max-width:900px}</style>
<h1>Campaign quality candidates · not owner-approved</h1>
<p class="note">Compare rejected cutout ads with new hybrid/restage candidates. Klein reference editing is used for harmonize and creative restage. Product fidelity is requested, not guaranteed.</p>
${report.candidates.filter(c=>c.ok).map(c=>`<h2>${c.id} · ${c.mode}</h2><section>
<figure><img src="${c.id}/rejected-previous.png"><figcaption>Rejected previous</figcaption></figure>
<figure><img src="${c.id}/pre-harmonize.png" onerror="this.parentNode.style.display='none'"><figcaption>Pre-harmonize fidelity composite</figcaption></figure>
<figure><img src="${c.id}/scene-${c.mode}.png"><figcaption>New scene (${c.mode})</figcaption></figure>
<figure><img src="${c.id}/advertisement.png"><figcaption>Lettering export</figcaption></figure>
<figure><img src="${c.id}/creative-restage-raw.png" onerror="this.parentNode.style.display='none'"><figcaption>Creative restage raw</figcaption></figure>
</section>`).join('')}
<pre>${JSON.stringify(report,null,2)}</pre>`;
await writeFile(join(out,'comparison.html'),gallery);
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
console.log('\nEVIDENCE',out);
if(report.candidates.some(c=>!c.ok))process.exitCode=1;
