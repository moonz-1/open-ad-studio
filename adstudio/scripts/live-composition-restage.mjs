// ONE dynamics-driven Creative Restage: structured composition plan → Klein scene.
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
const out=resolve('outputs','creative-acceptance',stamp,'composition-restage');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const runtime=JSON.parse(await readFile(resolve('outputs/runtime-config.json'),'utf8').catch(()=>'{}'));
const modelsDir=process.env.ADSTUDIO_KLEIN_MODELS_DIR||process.env.COMFYUI_MODELS_DIR||runtime.modelsDir;
if(!modelsDir)throw Error('Configure modelsDir.');
const comfyUrl=process.env.COMFYUI_URL||'http://127.0.0.1:8188';
const proxyUrl=process.env.COMFY_BASE_URL||'http://127.0.0.1:8189';
process.env.COMFYUI_URL=comfyUrl;process.env.COMFY_BASE_URL=proxyUrl;

const sourceFull=resolve('outputs/creative-acceptance/2026-10-28-readiness/previous-cookie-source.png');
const productRef=resolve('outputs/creative-acceptance/2026-10-28-readiness/cookie-identity-reference.png');
await access(sourceFull);await access(productRef);
const sourceBytes=await readFile(sourceFull),refBytes=await readFile(productRef);
assert.equal(sha(sourceBytes),'209a46b99271245e4dee4c3865b84664097081d44c4a7b211e5b11bb7ba9e3b6');
await copyFile(sourceFull,join(out,'source-full.png'));
await copyFile(productRef,join(out,'product-reference.png'));

const native=async p=>(await fetch(comfyUrl+p,{signal:AbortSignal.timeout(5000)})).json();
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
brand.assets=[{id:'photo',assetId:'cookie-identity-ref',name:'cookie-identity-reference.png',role:'product',productId:'cookie'}];
brand.products=[{id:'cookie',name:'Chocolate chip cookie',description:'Thick irregular chocolate chip cookie.',sellingPoints:'Shareable',imageIds:['photo']}];

const input={
 version:1,projectId:'composition-restage-cookie',brand,
 source:{id:'cookie-identity-ref',name:'cookie-identity-reference.png',kind:'original',sha256:heroSha(refBytes),originalSha256:heroSha(sourceBytes),width:0,height:0},
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
let plan=assembleCreativePlan(input,concepts,{planningVersion:2,mode:'local-ai',model:'authored-validated-argument',reason:'Composition-dynamics Creative Restage proof.',contribution:{format:'advertising-arguments-v1',modelFields:['title','idea','strategy'],appFields:['composition','camera','environment','lighting','copy','dynamics']}},randomBytes(8).toString('hex').slice(0,16));
plan=refinePlanComposition(plan,'Arrange the products diagonally. Leave more negative space for copy.',randomBytes(8).toString('hex').slice(0,16));
assert.equal(campaignExecutionStrategy(plan),'creative-restage');
assert.match(plan.dynamics.product.arrangement,/diagonal|stack|Cluster/i);
const prompt=adScenePrompt(plan);
await writeFile(join(out,'plan.json'),JSON.stringify({selectedId:plan.selectedId,title:plan.concepts.find(c=>c.id===plan.selectedId).title,dynamics:plan.dynamics,execution:campaignExecutionStrategy(plan),prompt,archetype:sceneDirection(plan).archetype,controls:plan.context.controls,productReferenceSha256:sha(refBytes),sourceFullSha256:sha(sourceBytes)},null,2));

const uploadName=randomBytes(8).toString('hex')+'.png';
const outputsRoot=resolve('outputs');
await writeFile(join(outputsRoot,uploadName),refBytes);
await startComfyProxy(resolve('.'),{COMFYUI_URL:comfyUrl,COMFY_BASE_URL:proxyUrl});
const c=new Comfy();
console.log('Starting ONE composition-dynamics Creative Restage… reclaim',reclaim.toFixed(2));
const started=Date.now();
const scene=await renderKleinScene(outputsRoot,modelsDir,await native('/system_stats'),await native('/queue'),c,prompt,73,'/outputs/'+uploadName,sceneDirection(plan).archetype,comfyUrl,AbortSignal.timeout(600000),m=>console.log(' ',m));
assert.equal(scene.model,'klein-scene');
assert.equal(scene.fidelityMode,'creative-restage');
const sceneBytes=await readFile(join(outputsRoot,scene.url.slice(9)));
await writeFile(join(out,'creative-restage.png'),sceneBytes);
const report={stamp,elapsedMs:Date.now()-started,reclaimGiB:+reclaim.toFixed(2),scene:{model:scene.model,fidelityMode:scene.fidelityMode,jobId:scene.jobId,provenanceId:scene.provenanceId,seconds:scene.seconds,sha256:scene.sha256,width:scene.width,height:scene.height,sourceSha256:scene.sourceSha256,warning:scene.warning},dynamics:plan.dynamics,prompt,note:'Owner visual review required. Not a commercial PASS.'};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
await writeFile(join(out,'comparison.html'),`<!doctype html><meta charset="utf-8"><title>Composition restage</title>
<style>body{font:16px/1.4 Georgia,serif;background:#141210;color:#f3ebe1;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}img{width:100%;max-height:720px;object-fit:contain;background:#222}pre{font:12px/1.35 ui-monospace,Consolas,monospace;white-space:pre-wrap}</style>
<h1>Composition & Dynamics restage · ${stamp}</h1>
<p>job <code>${scene.jobId}</code> · ${report.elapsedMs} ms · ${scene.model}</p>
<main>
<figure><img src="source-full.png"/><figcaption>Authorized full source</figcaption></figure>
<figure><img src="product-reference.png"/><figcaption>Identity reference contact sheet</figcaption></figure>
<figure><img src="creative-restage.png"/><figcaption>Klein Creative Restage</figcaption></figure>
</main>
<pre>${JSON.stringify({arrangement:plan.dynamics.product.arrangement,identityAnchors:plan.dynamics.product.identityAnchors,camera:plan.dynamics.camera,scene:report.scene},null,2)}</pre>`);
await releaseKleinCache(scene.jobId,comfyUrl).catch(()=>{});
console.log('RAW',join(out,'creative-restage.png'));
console.log('JOB',scene.jobId);
process.exit(0);
