// ONE identity-conditioning Creative Restage: cleaner product-focused reference,
// same staggered three-product Dynamics plan as the accepted composition run.
// Does not change Dynamics/UI/workflow pins. Recovers Comfy output if SDK poll times out.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {access,copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {Comfy} from '@comfyorg/sdk';
import {assembleCreativePlan,creativeContext,conceptsFromArguments,refinePlanComposition} from '../../shared/lib/creative-engine.ts';
import {newBrand} from '../../shared/lib/brand.ts';
import {adScenePrompt,sceneDirection} from '../../shared/lib/ad-scene.ts';
import {campaignExecutionStrategy} from '../../shared/lib/campaign-presentation.ts';
import {renderKleinScene} from '../../shared/runtime/klein-scene.ts';
import {heroSha} from '../../shared/runtime/hero-ad.ts';
import {startComfyProxy} from '../../shared/runtime/proxy.ts';
import {releaseKleinCache} from '../../shared/runtime/klein-background.ts';

const stamp=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
const out=resolve('outputs','creative-acceptance',stamp,'identity-restage');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=JSON.parse(await readFile(resolve('outputs/runtime-config.json'),'utf8').catch(()=>'{}'));
const modelsDir=process.env.ADSTUDIO_KLEIN_MODELS_DIR||process.env.COMFYUI_MODELS_DIR||runtime.modelsDir;
if(!modelsDir)throw Error('Configure modelsDir.');
const comfyUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188';
const proxyUrl=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
process.env.COMFYUI_URL=comfyUrl;process.env.COMFY_BASE_URL=proxyUrl;

const sourceFull=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const productRef=resolve('outputs/creative-acceptance/2026-10-28-readiness/cookie-identity-focused.png');
const priorPlanPath=resolve('outputs/creative-acceptance/2026-10-28T18-56-28/composition-restage/plan.json');
const priorOut=resolve('outputs/creative-acceptance/2026-10-28T18-56-28/composition-restage/creative-restage.png');
await access(sourceFull);await access(productRef);await access(priorPlanPath);await access(priorOut);
const sourceBytes=await readFile(sourceFull),refBytes=await readFile(productRef),priorPlan=JSON.parse(await readFile(priorPlanPath,'utf8'));
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6');
assert.equal(sha(refBytes),'c971f6d0f46d90b81199fda3ce186fe9d07d468074a35869c8cde1d982a86f98');
await copyFile(sourceFull,join(out,'source-full.png'));
await copyFile(productRef,join(out,'product-reference.png'));
await copyFile(priorOut,join(out,'prior-composition-restage.png'));
await writeFile(join(out,'prior-reference-note.json'),JSON.stringify({
  priorReference:'outputs/creative-acceptance/2026-10-28-readiness/cookie-identity-reference.png',
  priorReferenceSha256:'e3bfe9e0613c335d8955ca513575e30223e000856365202926fac6fdfbbb9297',
  priorReferenceIssue:'Wide 1488x424 triptych with foil separators; at Klein 0.33MP scale ≈1076x307 — thickness cues starved. Foil + overlap diluted product geometry.',
  newReference:'cookie-identity-focused.png',
  newReferenceSha256:sha(refBytes),
  newReferencePrep:'Single near-square interior crop from authorized source (product-filled, foil walls clipped), cocoa matte letterbox only if needed. Maximizes product pixels under Klein 0.33MP. No invented product pixels. Not app-hardcoded cookie logic.',
  kleinLimits:'Pinned klein4b_scene: ImageScaleToTotalPixels 0.33MP → VAEEncode → ReferenceLatent on pos+neg, CFG 1, 4-step Euler distilled. Contract: product details can be redrawn. No identity lock / IP-Adapter strength.'
},null,2));

const native=async p=>(await fetch(comfyUrl+p,{signal:AbortSignal.timeout(8000)})).json();
const free=async()=>{await fetch(comfyUrl+'/free',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true}),signal:AbortSignal.timeout(5000)}).catch(()=>{});};
await free();await new Promise(r=>setTimeout(r,1500));
const queue=await native('/queue');assert.equal((queue.queue_running?.length||0)+(queue.queue_pending?.length||0),0);
const stats=await native('/system_stats'),d=stats.devices?.[0];
const reclaim=((d?.vram_free||0)+Math.max(0,(d?.torch_vram_total||0)-(d?.torch_vram_free||0)))/1024**3;
const ram=(stats.system?.ram_free||0)/1024**3;
assert.ok(reclaim>=6,`Need ≥6 GiB reclaimable, have ${reclaim.toFixed(2)}`);
assert.ok(ram>=6,`Need ≥6 GiB RAM, have ${ram.toFixed(2)}`);

const brand=newBrand('No Crumbs Bakery');
brand.dna.description='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
brand.dna.tone='Warm, inviting and indulgent.';
brand.dna.visualStyle='Deep cocoa, warm cream, directional window light, tactile walnut and appetizing editorial photography.';
brand.colors=['#3b2117','#f3dfbc','#9a5528'];
brand.overrides=['name','description','tone','visualStyle'];
brand.assets=[{id:'photo',assetId:'cookie-identity-focused',name:'cookie-identity-focused.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick irregular chocolate chip cookie.',sellingPoints:'Shareable',imageIds:['photo']}];

const input={
 version:1,projectId:'identity-restage-cookie',brand,
 source:{id:'cookie-identity-focused',name:'cookie-identity-focused.png',kind:'original',sha256:heroSha(refBytes),originalSha256:heroSha(sourceBytes),width:0,height:0},
 facts:{
  description:'Thick irregular mounded chocolate chip cookies with deep cracked golden crusts, uneven edges and large dark chocolate chunks — not flat round stock cookies.',
  count:3,
  arrangement:'Three thick cookies in a dynamic overlapping diagonal that shows height and irregular edges.',
  texture:'Golden cracked crust, porous crumb, mounded bakery height, uneven chocolate chunks.',
  container:'None — foil tray is packaging only and must not appear.',
  confirmed:true
 },
 productType:'cookies',productId:'cookie',
 request:'Artisanal bakery campaign: recognizable thick cracked cookies arranged dynamically to show texture and indulgence, without foil packaging. Leave copy space.',
 intent:'campaign',format:'feed',seed:73,
 constraints:{exactCount:false,arrangement:'roughly',angle:'moderate',crop:'moderate',background:'replace',fidelity:'medium',creativity:'high'}
};

const ctx=creativeContext(input);
const quote='No Crumbs Bakery sells thick chocolate chip cookies meant for sharing.';
const flat={arguments:[
 {title:'Thickness on display',idea:'Make the mounded cracked cookies the reason to lean in, arranged so height and irregular edges stay obvious.',objective:'consideration',audienceHypothesis:'Hosts may want cookies that look substantial enough to share as a real bakery object.',tension:'Flat stock cookies erase the thick irregular character that makes these cookies recognizable.',businessFit:quote,feeling:'Warm appetite from reading real bakery height and cracks.',memory:'Deep cracks and uneven chunks on thick cookies against calm walnut.',focus:'Three thick chocolate chip cookies with cracked golden crusts and uneven chunks.',opening:'Establish diagonal thickness before the set settles into editorial calm.',payoff:'Hold the clustered cookies with open space for brand lettering.',proofId:'brand-description',proofQuote:quote},
 {title:'Texture invitation',idea:'Lead with cracked crust and chunky chocolate so the batch feels handmade-thick without inventing fillings.',objective:'consideration',audienceHypothesis:'Buyers may trust irregular bakery texture more than a polished generic cookie.',tension:'Smooth studio cookies hide the cracked surfaces that identify this product.',businessFit:quote,feeling:'Quiet curiosity about the tactile surface.',memory:'Cracked crust and uneven chunks remain the recognition cue.',focus:'Golden cracked crust and large dark chocolate chunks on thick cookies.',opening:'Graze light across crust cracks before revealing the full cluster.',payoff:'Resolve on the three-cookie arrangement at recognition scale.',proofId:'brand-description',proofQuote:quote},
 {title:'Table indulgence',idea:'Stage a ready sharing cluster without takeaway foil so the cookies feel already at the table.',objective:'consideration',audienceHypothesis:'People setting a table may respond to food that already looks ready to serve.',tension:'Foil packaging signals transport; a plated cluster signals arrival.',businessFit:quote,feeling:'Ease of offering something ready and warm.',memory:'Thick cookies on walnut with soft window light, no foil tray.',focus:'Three thick chocolate chip cookies without packaging.',opening:'Introduce warm window light and walnut before the cluster lands as hero.',payoff:'Leave calm negative space for typography beside the cookies.',proofId:'brand-description',proofQuote:quote}
]};
const concepts=conceptsFromArguments(flat,input,ctx);
let plan=assembleCreativePlan(input,concepts,{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'Identity-conditioning Creative Restage; composition held constant.',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy','dynamics']}},randomBytes(8).toString('hex').slice(0,16));
plan=refinePlanComposition(plan,'Arrange the products diagonally. Leave more negative space for copy.',randomBytes(8).toString('hex').slice(0,16));
// Lock spatial Dynamics to the previously accepted composition plan (identity-only experiment).
plan={...plan,dynamics:priorPlan.dynamics,selectedId:priorPlan.selectedId};
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
assert.equal(plan.dynamics.product.count,3);
assert.match(plan.dynamics.product.arrangement,/diagonal/i);
const prompt=adScenePrompt(plan);
await writeFile(join(out,'plan.json'),JSON.stringify({selectedId:plan.selectedId,title:priorPlan.title,dynamics:plan.dynamics,execution:campaignExecutionStrategy(plan),prompt,archetype:sceneDirection(plan).archetype,controls:plan.context.controls,productReferenceSha256:sha(refBytes),sourceFullSha256:sha(sourceBytes),compositionLockedFrom:priorPlanPath},null,2));

const uploadName=randomBytes(8).toString('hex')+'.png';
const outputsRoot=resolve('outputs');
await writeFile(join(outputsRoot,uploadName),refBytes);
await startComfyProxy(resolve('.'),{COMFYUI_URL:comfyUrl,COMFY_BASE_URL:proxyUrl});
const c=new Comfy();
console.log('Starting ONE identity-conditioning Creative Restage… reclaim',reclaim.toFixed(2));
const started=Date.now();
let scene,jobId='';
try{
 scene=await renderKleinScene(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,prompt,73,'/outputs/'+uploadName,sceneDirection(plan).archetype,comfyUrl,AbortSignal.timeout(900000),m=>console.log(' ',m));
 jobId=scene.jobId;
}catch(error){
 jobId=error.jobId||jobId;
 console.error('SDK path failed:',error.message,'jobId',jobId);
 if(!jobId)throw error;
 // Recover finished Comfy output after headers timeout (same as prior acceptance).
 for(let i=0;i<90;i++){
  const q=await native('/queue');
  if(!(q.queue_running?.length||q.queue_pending?.length))break;
  await new Promise(r=>setTimeout(r,2000));
 }
 const hist=await native('/history/'+jobId);
 const entry=hist?.[jobId];
 const img=entry?.outputs?.['13']?.images?.[0];
 if(!img?.filename)throw error;
 const view=new URL('/view',comfyUrl);
 view.searchParams.set('filename',img.filename);
 if(img.subfolder)view.searchParams.set('subfolder',img.subfolder);
 view.searchParams.set('type',img.type||'output');
 const bytes=Buffer.from(await (await fetch(view,{signal:AbortSignal.timeout(30000)})).arrayBuffer());
 const provenanceId=(img.filename.match(/klein-scene-([a-f0-9]+)/)||[])[1]||randomBytes(8).toString('hex');
 await writeFile(join(outputsRoot,provenanceId+'.png'),bytes,{flag:'wx'}).catch(async()=>{await writeFile(join(outputsRoot,provenanceId+'-recovered.png'),bytes);});
 scene={url:'/outputs/'+provenanceId+'.png',sha256:heroSha(bytes),width:768,height:960,seconds:(Date.now()-started)/1000,model:'klein-scene',jobId,provenanceId,prompt,seed:73,sourceSha256:sha(refBytes),archetype:sceneDirection(plan).archetype,fidelityMode:'creative-restage',warning:'Recovered from Comfy history after SDK timeout. Creative Restage · compare with original.',recovered:true};
 console.log('Recovered from Comfy history',img.filename);
}
assert.equal(scene.model,'klein-scene');
assert.equal(scene.fidelityMode,'creative-restage');
const scenePath=join(outputsRoot,scene.url.slice(9));
let sceneBytes;try{sceneBytes=await readFile(scenePath);}catch{sceneBytes=await readFile(join(outputsRoot,scene.provenanceId+'-recovered.png'));}
await writeFile(join(out,'creative-restage.png'),sceneBytes);
const report={stamp,elapsedMs:Date.now()-started,reclaimGiB:+reclaim.toFixed(2),scene:{model:scene.model,fidelityMode:scene.fidelityMode,jobId:scene.jobId,provenanceId:scene.provenanceId,seconds:scene.seconds,sha256:scene.sha256||sha(sceneBytes),width:scene.width,height:scene.height,sourceSha256:scene.sourceSha256,recovered:!!scene.recovered,warning:scene.warning},productReferenceSha256:sha(refBytes),priorCompositionSha256:'ffad2b65a9203b8b9e05774314779d7bbf50f532ca1fef6d1ef8362234bec644',dynamics:plan.dynamics,prompt,note:'Owner visual identity review required. Not a commercial PASS. Composition held from prior Dynamics plan.'};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'comparison.html'),`<!doctype html><meta charset="utf-8"><title>Identity restage</title>
<style>body{font:16px/1.4 Georgia,serif;background:#141210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}img{width:100%;max-height:720px;object-fit:contain;background:#222}</style>
<h1>Identity conditioning restage · ${stamp}</h1>
<p>job <code>${scene.jobId}</code> · composition locked · seed 73</p>
<main>
<figure><img src="source-full.png"/><figcaption>Authorized full source</figcaption></figure>
<figure><img src="product-reference.png"/><figcaption>New product-focused reference</figcaption></figure>
<figure><img src="prior-composition-restage.png"/><figcaption>Prior Dynamics restage (ffad2b65)</figcaption></figure>
<figure><img src="creative-restage.png"/><figcaption>New identity restage</figcaption></figure>
</main>`);
await releaseKleinCache(scene.jobId,comfyUrl).catch(()=>{});
console.log('RAW',join(out,'creative-restage.png'));
console.log('JOB',scene.jobId);
console.log('SHA',report.scene.sha256);
process.exit(0);
